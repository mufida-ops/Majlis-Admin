import { supabase } from '@/lib/supabase';
import { listContentItemSummaries, type ContentItemSummary } from './contentItems';
import { latestMediaThumbnails } from './media';
import { todayInOrgTz } from '@/lib/timezone';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export interface HomeData {
  myTasks: ContentItemSummary[];
  dueToday: ContentItemSummary[];
  overdue: ContentItemSummary[];
  waitingForMe: ContentItemSummary[];
  awaitingApproval: ContentItemSummary[];
  scheduledToday: ContentItemSummary[];
  recentlyPublished: ContentItemSummary[];
  thumbnails: Map<string, { storagePath: string; kind: 'video' | 'image' | 'pdf' | 'other' }>;
}

export async function loadHomeData(userId: string, isAdmin: boolean): Promise<HomeData> {
  const all = await listContentItemSummaries();
  const today = todayInOrgTz();

  const assignedIds = new Set<string>();
  const { data: assignments } = await db().from('content_assignments').select('content_item_id').eq('user_id', userId);
  for (const a of assignments ?? []) assignedIds.add(a.content_item_id);

  const isMine = (item: ContentItemSummary) =>
    item.owner_id === userId || item.approver_id === userId || item.publisher_id === userId || assignedIds.has(item.id);

  const myTasks = all.filter((i) => isMine(i) && i.stage !== 'published');
  const dueToday = myTasks.filter((i) => i.due_date === today);
  const overdue = myTasks.filter((i) => !!i.due_date && i.due_date < today);
  const waitingForMe = all.filter((i) =>
    (i.stage === 'approval' && i.approver_id === userId) ||
    (i.stage === 'editing' && i.approval_state === 'changes_requested' && i.owner_id === userId) ||
    (i.stage === 'approved' && i.publisher_id === userId)
  );
  const awaitingApproval = isAdmin
    ? all.filter((i) => i.stage === 'approval')
    : all.filter((i) => i.stage === 'approval' && i.approver_id === userId);

  const { data: scheduledPosts } = await db()
    .from('platform_posts')
    .select('content_item_id')
    .gte('scheduled_at', `${today}T00:00:00Z`)
    .lte('scheduled_at', `${today}T23:59:59Z`);
  const scheduledIds = new Set((scheduledPosts ?? []).map((p) => p.content_item_id));
  const scheduledToday = all.filter((i) => scheduledIds.has(i.id));

  const recentlyPublished = all.filter((i) => i.stage === 'published').slice(0, 6);

  const thumbIds = [...myTasks, ...dueToday, ...overdue, ...waitingForMe, ...awaitingApproval, ...scheduledToday, ...recentlyPublished]
    .map((i) => i.id);
  const thumbnails = await latestMediaThumbnails(Array.from(new Set(thumbIds)));

  return { myTasks, dueToday, overdue, waitingForMe, awaitingApproval, scheduledToday, recentlyPublished, thumbnails };
}
