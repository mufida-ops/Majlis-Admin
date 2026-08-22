import { requireSupabase, unwrap } from '@/lib/repositories/helpers';
import type { AiActionRow } from '@/types/db';
import * as projects from '@/lib/repositories/projects';
import * as decisions from '@/lib/repositories/decisions';
import * as organisations from '@/lib/repositories/organisations';
import * as events from '@/lib/repositories/events';
import * as drops from '@/lib/repositories/drops';

export async function listProposedActions(workspaceId: string): Promise<AiActionRow[]> {
  const supabase = requireSupabase();
  const result = await supabase
    .from('ai_actions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'Proposed')
    .order('created_at', { ascending: false });
  return unwrap(result) as AiActionRow[];
}

export async function listActionsForDrop(dropId: string): Promise<AiActionRow[]> {
  const supabase = requireSupabase();
  const result = await supabase.from('ai_actions').select('*').eq('drop_id', dropId).order('created_at', { ascending: true });
  return unwrap(result) as AiActionRow[];
}

// Every action_type from the README's "Suggested AI actions" list maps to
// one existing repository call, so applying a proposal never bypasses the
// same write path a human editing the screen would use.
async function performAction(action: AiActionRow, actorUserId: string, workspaceId: string) {
  const p = action.payload as Record<string, any>;
  switch (action.action_type) {
    case 'create_task':
      return projects.createTask({
        workspace_id: workspaceId,
        project_id: p.project_id,
        title: p.title,
        owner_user_id: p.owner_user_id ?? null,
        start_at: p.start_at ?? null,
        due_at: p.due_at ?? null,
        created_by: actorUserId
      });
    case 'assign_task':
      return projects.updateTask(p.task_id, { owner_user_id: p.owner_user_id });
    case 'update_task':
      return projects.updateTask(p.task_id, { status: p.status });
    case 'create_decision':
      return decisions.createDecision({
        workspace_id: workspaceId,
        title: p.title,
        rationale: p.rationale,
        project_id: p.project_id ?? null,
        owner: p.owner ?? null,
        created_by: actorUserId
      });
    case 'resolve_decision':
      return decisions.setDecisionStatus(p.decision_id, p.status);
    case 'add_crm_note':
      return organisations.addCrmNote(p.organisation_id, p.note);
    case 'update_pipeline_stage':
      return organisations.updatePipelineStage(p.organisation_id, p.stage);
    case 'create_follow_up':
      return organisations.createFollowUp(p.organisation_id, p.next_action, p.next_action_at ?? null);
    case 'mark_waiting_for':
      return projects.updateTask(p.task_id, { status: 'Waiting' });
    case 'create_organisation': {
      const org = await organisations.createOrganisation({
        workspace_id: workspaceId,
        name: p.name,
        stage: p.stage || 'Lead',
        next_action: p.next_action ?? undefined,
        created_by: actorUserId
      });
      if (p.note) await organisations.addCrmNote(org.id, p.note);
      return org;
    }
    case 'create_event': {
      // Combined client-side (in the founder's own timezone) rather than by
      // the Edge Function or Claude, exactly like the Calendar screen's own
      // "New event" form does — the Edge Function only resolves *which*
      // calendar date "tomorrow" means, never a UTC instant.
      const allDay = Boolean(p.all_day) || !p.start_time;
      const startAt = new Date(`${p.start_date}T${allDay ? '00:00' : p.start_time}:00`);
      return events.createEvent({
        workspace_id: workspaceId,
        title: p.title,
        description: p.description ?? null,
        start_at: startAt.toISOString(),
        all_day: allDay,
        created_by: actorUserId
      });
    }
    case 'send_partner_message': {
      // Goes through the exact same path as typing it into Drop yourself:
      // a plain drop, summary-only (never proposes its own actions).
      const drop = await drops.createDrop({
        workspace_id: workspaceId,
        created_by: actorUserId,
        raw_text: p.message,
        urgent: Boolean(p.urgent)
      });
      requestDropParse(drop.id, false).catch(() => {});
      return drop;
    }
    case 'summarize_changes_since_last_seen':
      return null;
    default:
      return null;
  }
}

export async function applyAiAction(action: AiActionRow, actorUserId: string): Promise<AiActionRow> {
  const supabase = requireSupabase();
  await performAction(action, actorUserId, action.workspace_id);
  const result = await supabase
    .from('ai_actions')
    .update({ status: 'Applied', applied_by: actorUserId, applied_at: new Date().toISOString() })
    .eq('id', action.id)
    .select('*')
    .single();
  return unwrap(result) as AiActionRow;
}

export async function dismissAiAction(id: string): Promise<AiActionRow> {
  const supabase = requireSupabase();
  const result = await supabase.from('ai_actions').update({ status: 'Dismissed' }).eq('id', id).select('*').single();
  return unwrap(result) as AiActionRow;
}

// proposeActions=false is used right after saving a drop: it still gets a
// clean summary written for the co-founder's catch-up feed, but no AI
// suggestions are surfaced — a drop is only ever plain conversation until
// the founder explicitly taps "Action it" on it (proposeActions=true).
export async function requestDropParse(dropId: string, proposeActions: boolean = true) {
  const supabase = requireSupabase();
  const { error } = await supabase.functions.invoke('parse-drop', {
    body: { drop_id: dropId, propose_actions: proposeActions }
  });
  if (error) throw new Error(error.message);
}
