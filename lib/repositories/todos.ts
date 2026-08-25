import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { TodoItemRow } from '@/types/db';

export async function listTodos(workspaceId: string, userId: string): Promise<TodoItemRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return unwrap(result) as TodoItemRow[];
}

export async function createTodo(workspaceId: string, userId: string, body: string): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_items')
    .insert({ workspace_id: workspaceId, user_id: userId, body })
    .select('*')
    .single();
  return unwrap(result) as TodoItemRow;
}

export async function updateTodoBody(id: string, body: string): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_items').update({ body }).eq('id', id).select('*').single();
  return unwrap(result) as TodoItemRow;
}

// completed_at is set the moment a to-do is checked off, and cleared if it's
// ever unchecked — so "date completed" reflects when it actually finished,
// not the last time it was touched.
export async function setTodoDone(id: string, done: boolean): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_items')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as TodoItemRow;
}

export async function deleteTodo(id: string): Promise<void> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_items').delete().eq('id', id);
  unwrap(result);
}
