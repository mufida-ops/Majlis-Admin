import { supabase } from '@/lib/supabase';
import type { Comment, Profile } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listComments(contentItemId: string) {
  const { data, error } = await db()
    .from('comments')
    .select('*')
    .eq('content_item_id', contentItemId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Comment[];
}

/** Parses `@Full Name` mentions against the given team roster and returns the matched user ids. */
export function parseMentions(body: string, team: Profile[]): Profile[] {
  const matches: Profile[] = [];
  for (const person of team) {
    const pattern = new RegExp(`@${person.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(body)) matches.push(person);
  }
  return matches;
}

export async function postComment(input: {
  contentItemId: string;
  authorId: string;
  body: string;
  team: Profile[];
  parentCommentId?: string | null;
  mediaVersionId?: string | null;
}): Promise<Comment> {
  const client = db();
  const { data, error } = await client
    .from('comments')
    .insert({
      content_item_id: input.contentItemId,
      author_id: input.authorId,
      body: input.body,
      parent_comment_id: input.parentCommentId ?? null,
      media_version_id: input.mediaVersionId ?? null
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const comment = data as Comment;

  const mentioned = parseMentions(input.body, input.team).filter((p) => p.id !== input.authorId);
  if (mentioned.length > 0) {
    const { error: mentionError } = await client
      .from('mentions')
      .insert(mentioned.map((p) => ({ comment_id: comment.id, mentioned_user_id: p.id })));
    if (mentionError) throw mentionError;
  }

  return comment;
}

export async function updateComment(id: string, body: string) {
  const { error } = await db().from('comments').update({ body, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteComment(id: string) {
  const { error } = await db().from('comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
