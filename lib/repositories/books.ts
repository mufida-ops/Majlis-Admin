import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { normalizeImageForWeb } from '@/lib/normalizeImageForWeb';
import type { BookRow, BookLinkRow, BookBoxItemRow, BookItemSectionRow, BookBoxType } from '@/types/db';

const BOOK_COVER_BUCKET = 'book-covers';
const BOOK_FILE_BUCKET = 'book-files';

export type BookWithContents = BookRow & { book_links: BookLinkRow[]; book_box_items: BookBoxItemRow[] };

export async function listBooks(workspaceId: string): Promise<BookRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('books')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  return unwrap(result) as BookRow[];
}

export async function getBook(id: string): Promise<BookWithContents> {
  const supabase = requireSupabase();
  const result = await supabase.from('books').select('*, book_links(*), book_box_items(*)').eq('id', id).single();
  return unwrap(result) as unknown as BookWithContents;
}

export async function createBook(input: { workspace_id: string; title: string; created_by: string }): Promise<BookRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('books').insert(input).select('*').single();
  return unwrap(result) as BookRow;
}

export async function updateBook(id: string, patch: Partial<Pick<BookRow, 'title' | 'cover_image_path' | 'order_index'>>): Promise<BookRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('books')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as BookRow;
}

export async function deleteBook(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('books').delete().eq('id', id));
}

export async function setBookCoverImage(bookId: string, file: { uri: string; name: string; mimeType: string }): Promise<BookRow> {
  const supabase = requireSupabase();
  const normalized = await normalizeImageForWeb(file.uri, file.mimeType);
  const ext = normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
  const path = `${bookId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(BOOK_COVER_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (error) throw new Error(error.message);
  return updateBook(bookId, { cover_image_path: path });
}

export async function removeBookCoverImage(bookId: string): Promise<BookRow> {
  return updateBook(bookId, { cover_image_path: null });
}

export async function getBookCoverUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(BOOK_COVER_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// --- The checklist itself (book_item_sections) — editable, not a fixed list ---

export async function listBookItemSections(workspaceId: string): Promise<BookItemSectionRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('book_item_sections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('order_index', { ascending: true });
  return unwrap(result) as BookItemSectionRow[];
}

function slugifySectionKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  // A short random suffix keeps the key unique even if two sections share a
  // label — the key is only ever used internally, never shown in the UI.
  return `${base || 'section'}_${Date.now().toString(36).slice(-4)}`;
}

/** Adds a new checklist section (e.g. "Story map") — appears on every book from now on, no code change needed. */
export async function addBookItemSection(workspaceId: string, label: string, createdBy: string): Promise<BookItemSectionRow> {
  const supabase = requireSupabase();
  const existing = await listBookItemSections(workspaceId);
  const order_index = existing.length > 0 ? Math.max(...existing.map(s => s.order_index)) + 1 : 0;
  const result = await supabase
    .from('book_item_sections')
    .insert({ workspace_id: workspaceId, key: slugifySectionKey(label), label: label.trim(), order_index, created_by: createdBy })
    .select('*')
    .single();
  return unwrap(result) as BookItemSectionRow;
}

/** Removes a checklist section from every book — also removes any links already added under it (cascades). */
export async function deleteBookItemSection(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('book_item_sections').delete().eq('id', id));
}

// Best-effort thumbnail for a pasted link — reads the source page's own
// og:image, so a failure here (unreachable link, no meta tag) should never
// block adding the link itself.
async function fetchLinkPreviewImage(url: string): Promise<string | null> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error) return null;
    return (data as { image_url: string | null } | null)?.image_url ?? null;
  } catch {
    return null;
  }
}

/** Adds a link (usually Canva) to one of a book's checklist sections — a section can hold several. */
export async function addBookLink(input: {
  workspace_id: string;
  book_id: string;
  section_id: string;
  url: string;
  label?: string;
  created_by: string;
}): Promise<BookLinkRow> {
  const supabase = requireSupabase();
  const preview_image_url = await fetchLinkPreviewImage(input.url);
  const result = await supabase.from('book_links').insert({ ...input, preview_image_url }).select('*').single();
  return unwrap(result) as BookLinkRow;
}

/** Attaches a photo instead of a link to one of a book's item sections. */
export async function addBookLinkPhoto(
  input: { workspace_id: string; book_id: string; section_id: string; label?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<BookLinkRow> {
  const supabase = requireSupabase();
  const normalized = await normalizeImageForWeb(file.uri, file.mimeType);
  const ext = normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
  const path = `${input.book_id}/${input.section_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error: uploadError } = await supabase.storage.from(BOOK_FILE_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (uploadError) throw new Error(uploadError.message);
  const result = await supabase
    .from('book_links')
    .insert({ workspace_id: input.workspace_id, book_id: input.book_id, section_id: input.section_id, label: input.label, file_path: path })
    .select('*')
    .single();
  return unwrap(result) as BookLinkRow;
}

export async function deleteBookLink(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('book_links').delete().eq('id', id));
}

/** Attaches an arbitrary document (PDF, etc.) instead of a link — e.g. an ISBN certificate. Only image files get the HEIC/web-decode fix; everything else uploads as-is. */
export async function addBookLinkFile(
  input: { workspace_id: string; book_id: string; section_id: string; label?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<BookLinkRow> {
  const supabase = requireSupabase();
  const isImage = file.mimeType.startsWith('image/');
  const normalized = isImage ? await normalizeImageForWeb(file.uri, file.mimeType) : { uri: file.uri, mimeType: file.mimeType };
  const ext = isImage && normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'bin');
  const path = `${input.book_id}/${input.section_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error: uploadError } = await supabase.storage.from(BOOK_FILE_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (uploadError) throw new Error(uploadError.message);
  const result = await supabase
    .from('book_links')
    .insert({
      workspace_id: input.workspace_id,
      book_id: input.book_id,
      section_id: input.section_id,
      label: input.label ?? file.name,
      file_path: path
    })
    .select('*')
    .single();
  return unwrap(result) as BookLinkRow;
}

export async function getBookFileUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from(BOOK_FILE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Adds a physical item (Story box or Cultural box) — name, optional price, optional photo. */
export async function addBookBoxItem(
  input: { workspace_id: string; book_id: string; box_type: BookBoxType; name: string; price?: number | null; created_by: string },
  file?: { uri: string; name: string; mimeType: string } | null
): Promise<BookBoxItemRow> {
  const supabase = requireSupabase();
  let imagePath: string | null = null;
  if (file) {
    const normalized = await normalizeImageForWeb(file.uri, file.mimeType);
    const ext = normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
    const path = `${input.book_id}/${input.box_type}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const response = await fetch(normalized.uri);
    const blob = await response.blob();
    const { error: uploadError } = await supabase.storage.from(BOOK_FILE_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
    if (uploadError) throw new Error(uploadError.message);
    imagePath = path;
  }
  const result = await supabase
    .from('book_box_items')
    .insert({
      workspace_id: input.workspace_id,
      book_id: input.book_id,
      box_type: input.box_type,
      name: input.name,
      price: input.price ?? null,
      image_path: imagePath
    })
    .select('*')
    .single();
  return unwrap(result) as BookBoxItemRow;
}

export async function deleteBookBoxItem(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('book_box_items').delete().eq('id', id));
}
