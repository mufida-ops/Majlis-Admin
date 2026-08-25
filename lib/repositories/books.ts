import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { normalizeImageForWeb } from '@/lib/normalizeImageForWeb';
import type { BookRow, BookLinkRow, BookBoxItemRow, BookItemKey, BookBoxType } from '@/types/db';

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

/** Adds a link (usually Canva) to one of a book's 8 fixed item sections — a section can hold several. */
export async function addBookLink(input: {
  workspace_id: string;
  book_id: string;
  item_key: BookItemKey;
  url: string;
  label?: string;
  created_by: string;
}): Promise<BookLinkRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('book_links').insert(input).select('*').single();
  return unwrap(result) as BookLinkRow;
}

/** Attaches a photo instead of a link to one of a book's item sections. */
export async function addBookLinkPhoto(
  input: { workspace_id: string; book_id: string; item_key: BookItemKey; label?: string; created_by: string },
  file: { uri: string; name: string; mimeType: string }
): Promise<BookLinkRow> {
  const supabase = requireSupabase();
  const normalized = await normalizeImageForWeb(file.uri, file.mimeType);
  const ext = normalized.mimeType === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() ?? 'jpg');
  const path = `${input.book_id}/${input.item_key}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const { error: uploadError } = await supabase.storage.from(BOOK_FILE_BUCKET).upload(path, blob, { contentType: normalized.mimeType });
  if (uploadError) throw new Error(uploadError.message);
  const result = await supabase
    .from('book_links')
    .insert({ workspace_id: input.workspace_id, book_id: input.book_id, item_key: input.item_key, label: input.label, file_path: path })
    .select('*')
    .single();
  return unwrap(result) as BookLinkRow;
}

export async function deleteBookLink(id: string): Promise<void> {
  const supabase = requireSupabase();
  unwrap(await supabase.from('book_links').delete().eq('id', id));
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
