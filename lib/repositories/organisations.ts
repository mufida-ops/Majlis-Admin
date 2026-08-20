import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { ContactRow, OrganisationRow } from '@/types/db';

export type OrganisationWithContacts = OrganisationRow & { contacts: ContactRow[] };

export async function listOrganisations(workspaceId: string): Promise<OrganisationWithContacts[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('organisations')
    .select('*, contacts(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  return unwrap(result) as unknown as OrganisationWithContacts[];
}

export async function getOrganisation(id: string): Promise<OrganisationWithContacts> {
  const supabase = requireSupabase();
  const result = await supabase.from('organisations').select('*, contacts(*)').eq('id', id).single();
  return unwrap(result) as unknown as OrganisationWithContacts;
}

export async function createOrganisation(input: {
  workspace_id: string;
  name: string;
  stage: string;
  owner_user_id?: string | null;
  next_action?: string | null;
  created_by: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('organisations').insert(input).select('*').single();
  return unwrap(result) as OrganisationRow;
}

export async function updateOrganisation(
  id: string,
  patch: Partial<
    Pick<OrganisationRow, 'stage' | 'owner_user_id' | 'next_action' | 'next_action_at' | 'notes' | 'last_contact_at'>
  >
) {
  const supabase = requireSupabase();
  const result = await supabase
    .from('organisations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  return unwrap(result) as OrganisationRow;
}

export async function addCrmNote(id: string, note: string) {
  return updateOrganisation(id, { notes: note });
}

export async function updatePipelineStage(id: string, stage: string) {
  return updateOrganisation(id, { stage, last_contact_at: new Date().toISOString() });
}

export async function createFollowUp(id: string, nextAction: string, nextActionAt?: string | null) {
  return updateOrganisation(id, { next_action: nextAction, next_action_at: nextActionAt ?? null });
}

export async function addContact(input: {
  workspace_id: string;
  organisation_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}) {
  const supabase = requireSupabase();
  const result = await supabase.from('contacts').insert(input).select('*').single();
  return unwrap(result) as ContactRow;
}
