import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { DecisionRow, DecisionStatus, OwnerType } from '@/types/db';

export async function listDecisions(workspaceId: string): Promise<DecisionRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('decisions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  return unwrap(result) as DecisionRow[];
}

export async function createDecision(input: {
  workspace_id: string;
  title: string;
  rationale?: string;
  project_id?: string | null;
  owner?: OwnerType | null;
  created_by: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('decisions').insert(input).select('*').single();
  return unwrap(result) as DecisionRow;
}

export async function setDecisionStatus(id: string, status: DecisionStatus) {
  const supabase = requireSupabase();
  const patch: Partial<DecisionRow> = { status };
  if (status === 'Agreed') patch.decided_at = new Date().toISOString();
  const result = await supabase.from('decisions').update(patch).eq('id', id).select('*').single();
  return unwrap(result) as DecisionRow;
}

export async function updateDecisionTitle(id: string, title: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('decisions').update({ title }).eq('id', id).select('*').single();
  return unwrap(result) as DecisionRow;
}

export async function deleteDecision(id: string) {
  const supabase = requireSupabase();
  const result = await supabase.from('decisions').delete().eq('id', id);
  unwrap(result);
}
