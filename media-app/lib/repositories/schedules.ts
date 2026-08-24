import { supabase } from '@/lib/supabase';
import type { PlatformName, PublishingJob, Schedule } from '@/types/db';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function upsertSchedule(input: {
  platformPostId: string;
  contentItemId: string;
  platform: PlatformName;
  scheduledAt: string;
  createdBy: string;
}): Promise<Schedule> {
  const client = db();
  const { data: existing } = await client.from('schedules').select('*').eq('platform_post_id', input.platformPostId).maybeSingle();
  if (existing) {
    const { data, error } = await client
      .from('schedules')
      .update({ scheduled_at: input.scheduledAt, status: 'pending' })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Schedule;
  }
  const { data, error } = await client
    .from('schedules')
    .insert({
      platform_post_id: input.platformPostId,
      content_item_id: input.contentItemId,
      platform: input.platform,
      scheduled_at: input.scheduledAt,
      created_by: input.createdBy
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Schedule;
}

export async function listSchedulesBetween(startIso: string, endIso: string, contentItemId?: string) {
  let q = db().from('schedules').select('*').gte('scheduled_at', startIso).lte('scheduled_at', endIso);
  if (contentItemId) q = q.eq('content_item_id', contentItemId);
  const { data, error } = await q.order('scheduled_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Schedule[];
}

export async function cancelSchedule(id: string) {
  const { error } = await db().from('schedules').update({ status: 'cancelled' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listJobsForPost(platformPostId: string) {
  const { data, error } = await db().from('publishing_jobs').select('*').eq('platform_post_id', platformPostId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublishingJob[];
}

/** Queues a manual retry — a fresh job row, never mutating the failed attempt (Section 22: retry one platform without touching the others). */
export async function retryPublish(platformPostId: string, requestedBy: string) {
  const { error } = await db().from('publishing_jobs').insert({
    platform_post_id: platformPostId,
    trigger_source: 'manual_retry',
    requested_by: requestedBy,
    status: 'queued'
  });
  if (error) throw new Error(error.message);
}

export async function publishNow(platformPostId: string, requestedBy: string) {
  const { error } = await db().from('publishing_jobs').insert({
    platform_post_id: platformPostId,
    trigger_source: 'publish_now',
    requested_by: requestedBy,
    status: 'queued'
  });
  if (error) throw new Error(error.message);
}
