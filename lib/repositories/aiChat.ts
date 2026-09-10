import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { AiActionRow, AiChatMessageRow } from '@/types/db';

export async function listChatMessages(workspaceId: string, userId: string): Promise<AiChatMessageRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return unwrap(result) as AiChatMessageRow[];
}

/**
 * Wipes this member's entire AI chat history, starting the conversation
 * fresh. Also removes any of their still-pending suggestions from that
 * chat (ai_actions.chat_message_id cascades) — anything already Accepted
 * is unaffected since accepting already applied it elsewhere.
 */
export async function clearChatHistory(workspaceId: string, userId: string): Promise<void> {
  const supabase = requireSupabase();
  const result = await supabase.from('ai_chat_messages').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  unwrap(result);
}

export async function sendChatMessage(
  workspaceId: string,
  userId: string,
  message: string
): Promise<{ userMessage: AiChatMessageRow; assistantMessage: AiChatMessageRow; actions: AiActionRow[] }> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { workspace_id: workspaceId, user_id: userId, message }
  });
  if (error) throw new Error(error.message);
  return data as { userMessage: AiChatMessageRow; assistantMessage: AiChatMessageRow; actions: AiActionRow[] };
}
