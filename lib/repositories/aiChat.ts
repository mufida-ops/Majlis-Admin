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

export async function sendChatMessage(
  workspaceId: string,
  userId: string,
  message: string
): Promise<{ userMessage: AiChatMessageRow; assistantMessage: AiChatMessageRow; action: AiActionRow | null }> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { workspace_id: workspaceId, user_id: userId, message }
  });
  if (error) throw new Error(error.message);
  return data as { userMessage: AiChatMessageRow; assistantMessage: AiChatMessageRow; action: AiActionRow | null };
}
