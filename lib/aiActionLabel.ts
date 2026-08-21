import type { AiActionRow } from '@/types/db';

export function describeAiAction(action: AiActionRow): string {
  const p = action.payload as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  switch (action.action_type) {
    case 'create_task':
      return `New task: "${str(p.title)}"${p.due_at ? ` · due ${str(p.due_at)}` : ''}`;
    case 'assign_task':
      return 'Reassign a task';
    case 'update_task':
      return `Mark a task "${str(p.status)}"`;
    case 'create_decision':
      return `New decision: "${str(p.title)}"`;
    case 'resolve_decision':
      return `Mark a decision "${str(p.status)}"`;
    case 'add_crm_note':
      return `CRM note: "${str(p.note)}"`;
    case 'update_pipeline_stage':
      return `Move CRM stage to "${str(p.stage)}"`;
    case 'create_follow_up':
      return `CRM follow-up: "${str(p.next_action)}"`;
    case 'mark_waiting_for':
      return 'Mark a task as waiting';
    case 'create_organisation':
      return `New CRM entry: "${str(p.name)}"${p.stage ? ` · ${str(p.stage)}` : ''}`;
    case 'create_event': {
      const when = str(p.start_date) + (p.all_day || !p.start_time ? '' : ` ${str(p.start_time)}`);
      return `New calendar event: "${str(p.title)}"${when ? ` · ${when}` : ''}`;
    }
    case 'summarize_changes_since_last_seen':
      return 'Summarise recent changes';
    default:
      return action.action_type;
  }
}
