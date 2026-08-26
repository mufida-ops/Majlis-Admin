import type { ActivityEventRow, DecisionRow, OrganisationRow } from '@/types/db';
import type { ProjectWithTasks } from '@/lib/repositories/projects';

export type ActivityHref = string | null;

type ClassifyInput = {
  me: { user_id: string; display_name: string };
  decisions: DecisionRow[];
  projects: ProjectWithTasks[];
  organisations: OrganisationRow[];
};

// Shared by the inline Catch-up on Home and the Catch-up history archive —
// same "does this need me" rules, same links, in one place instead of two
// copies drifting apart.
export function classifyActivity(
  activity: ActivityEventRow[],
  { me, decisions, projects, organisations }: ClassifyInput
): { needsYou: ActivityEventRow[]; fyi: ActivityEventRow[]; hrefs: Record<string, ActivityHref> } {
  const decisionById = new Map(decisions.map(d => [d.id, d]));
  const taskById = new Map(projects.flatMap(p => p.project_tasks.map(t => [t.id, t] as const)));
  const orgById = new Map(organisations.map(o => [o.id, o]));
  const projectById = new Map(projects.map(p => [p.id, p]));

  const needsYou: ActivityEventRow[] = [];
  const fyi: ActivityEventRow[] = [];
  const hrefs: Record<string, ActivityHref> = {};

  for (const event of activity) {
    if (event.actor_user_id === me.user_id) continue; // don't catch yourself up on your own changes

    let needsMe = false;
    if (event.entity_type === 'decision') {
      const d = decisionById.get(event.entity_id);
      needsMe = !!d && d.status === 'Waiting' && (d.owner === 'Both' || d.owner === me.display_name);
      hrefs[event.id] = '/(tabs)/decisions';
    } else if (event.entity_type === 'task') {
      const t = taskById.get(event.entity_id);
      needsMe = !!t && t.status !== 'Done' && t.owner_user_id === me.user_id;
      if (t) hrefs[event.id] = `/(tabs)/projects/${t.project_id}`;
    } else if (event.entity_type === 'project') {
      hrefs[event.id] = `/(tabs)/projects/${event.entity_id}`;
      const p = projectById.get(event.entity_id);
      needsMe = !!p && p.status === 'Blocked';
    } else if (event.entity_type === 'organisation') {
      const o = orgById.get(event.entity_id);
      needsMe = !!o && !!o.next_action_at && new Date(o.next_action_at).getTime() < Date.now() + 3 * 86400000;
      hrefs[event.id] = `/(tabs)/crm/${event.entity_id}`;
    } else if (event.entity_type === 'drop') {
      needsMe = event.action === 'urgent_drop';
    } else if (event.entity_type === 'event') {
      hrefs[event.id] = '/(tabs)/calendar';
    } else if (event.entity_type === 'message') {
      needsMe = true;
      const kind = event.metadata?.thread_kind as string | undefined;
      const anchorId = event.metadata?.anchor_id as string | undefined;
      if (kind && anchorId) hrefs[event.id] = `/thread?kind=${kind}&id=${anchorId}`;
    }

    (needsMe ? needsYou : fyi).push(event);
  }

  return { needsYou, fyi, hrefs };
}
