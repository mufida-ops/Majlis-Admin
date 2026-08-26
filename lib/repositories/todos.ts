import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import { localDateKey } from '@/lib/format';
import type { TodoItemRow, TodoProgressUpdateRow, TodoLinkRow, TodoDailyCapacityRow, TodoLinkType } from '@/types/db';

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

export async function getTodo(id: string): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_items').select('*').eq('id', id).single();
  return unwrap(result) as TodoItemRow;
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

// --- Enhanced To-do fields (gated in the UI by workspace_members.enhanced_todo_enabled) ---

export async function updateTodoDetails(
  id: string,
  patch: Partial<Pick<TodoItemRow, 'why_it_matters' | 'estimated_minutes_remaining'>>
): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_items').update(patch).eq('id', id).select('*').single();
  return unwrap(result) as TodoItemRow;
}

export async function parkTodo(id: string, params: { return_at: string | null; restart_point: string }): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_items')
    .update({ status: 'parked', parked_at: new Date().toISOString(), return_at: params.return_at, restart_point: params.restart_point })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as TodoItemRow;
}

export async function resumeTodo(id: string): Promise<TodoItemRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_items')
    .update({ status: 'active', parked_at: null, return_at: null })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as TodoItemRow;
}

export async function listProgressUpdates(todoItemId: string): Promise<TodoProgressUpdateRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_progress_updates')
    .select('*')
    .eq('todo_item_id', todoItemId)
    .order('created_at', { ascending: false });
  return unwrap(result) as TodoProgressUpdateRow[];
}

// Logs the update AND stamps it onto the item itself, so lists that only
// show the item (not its full history) still show the latest status.
export async function addProgressUpdate(
  workspaceId: string,
  todoItemId: string,
  userId: string,
  note: string
): Promise<{ item: TodoItemRow; entry: TodoProgressUpdateRow }> {
  const supabase = requireSupabase();
  const [entryResult, itemResult] = await Promise.all([
    supabase
      .from('todo_progress_updates')
      .insert({ workspace_id: workspaceId, todo_item_id: todoItemId, user_id: userId, note })
      .select('*')
      .single(),
    supabase.from('todo_items').update({ progress_note: note }).eq('id', todoItemId).select('*').single()
  ]);
  return { entry: unwrap(entryResult) as TodoProgressUpdateRow, item: unwrap(itemResult) as TodoItemRow };
}

export async function listTodoLinks(todoItemId: string): Promise<TodoLinkRow[]> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_links').select('*').eq('todo_item_id', todoItemId).order('created_at', { ascending: true });
  return unwrap(result) as TodoLinkRow[];
}

export async function addTodoLink(
  workspaceId: string,
  todoItemId: string,
  userId: string,
  params: { link_type: TodoLinkType; label: string | null; url: string }
): Promise<TodoLinkRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_links')
    .insert({ workspace_id: workspaceId, todo_item_id: todoItemId, user_id: userId, ...params })
    .select('*')
    .single();
  return unwrap(result) as TodoLinkRow;
}

export async function deleteTodoLink(id: string): Promise<void> {
  const supabase = requireSupabase();
  const result = await supabase.from('todo_links').delete().eq('id', id);
  unwrap(result);
}

export async function getTodayCapacity(workspaceId: string, userId: string): Promise<TodoDailyCapacityRow | null> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_daily_capacity')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('day', localDateKey())
    .maybeSingle();
  return unwrap(result) as TodoDailyCapacityRow | null;
}

export async function setTodayCapacity(workspaceId: string, userId: string, capacityMinutes: number): Promise<TodoDailyCapacityRow> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('todo_daily_capacity')
    .upsert(
      { workspace_id: workspaceId, user_id: userId, day: localDateKey(), capacity_minutes: capacityMinutes, updated_at: new Date().toISOString() },
      { onConflict: 'workspace_id,user_id,day' }
    )
    .select('*')
    .single();
  return unwrap(result) as TodoDailyCapacityRow;
}
