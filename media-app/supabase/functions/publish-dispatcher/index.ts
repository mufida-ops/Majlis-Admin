// Publish dispatcher — the only place that ever calls a real social API.
// Invoke on a schedule (Supabase cron / dashboard scheduled trigger, e.g.
// every 5 minutes) with the service role key, never from the client.
//
// Responsibilities, matching ARCHITECTURE.md "Publishing architecture":
//   1. Walk `schedules` rows that are due.
//   2. For a platform that isn't connected yet, mark the post
//      "ready_to_post_manually" (Section 25) — never fake a publish attempt.
//   3. For a connected platform, create a `publishing_jobs` row and hand it
//      to that platform's adapter. Every platform is handled independently:
//      one failing never touches another platform's row (Section 22).
//
// Real adapters get dropped into ADAPTERS below one at a time (Instagram ->
// LinkedIn -> TikTok, see ../../docs/social-api-requirements.md), each
// reading its own secrets via Deno.env — never client-visible.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

type Platform = 'instagram' | 'tiktok' | 'linkedin';

interface PublishResult {
  status: 'published' | 'processing' | 'failed' | 'not_connected';
  liveUrl?: string;
  errorMessage?: string;
}

async function notConnectedAdapter(): Promise<PublishResult> {
  return { status: 'not_connected' };
}

// Swap an entry for a real implementation as each platform is approved —
// nothing else in this file, or in the Expo app, needs to change.
const ADAPTERS: Record<Platform, () => Promise<PublishResult>> = {
  instagram: notConnectedAdapter,
  tiktok: notConnectedAdapter,
  linkedin: notConnectedAdapter
};

Deno.serve(async () => {
  const now = new Date().toISOString();

  const { data: dueSchedules, error: schedError } = await supabase
    .from('schedules')
    .select('id, platform_post_id, platform, content_item_id')
    .eq('status', 'pending')
    .lte('scheduled_at', now);
  if (schedError) return json({ error: schedError.message }, 500);

  const { data: connections } = await supabase.from('platform_connections').select('platform, is_connected');
  const connectedSet = new Set((connections ?? []).filter((c) => c.is_connected).map((c) => c.platform));

  const results: Record<string, string> = {};

  for (const schedule of dueSchedules ?? []) {
    if (!connectedSet.has(schedule.platform)) {
      await supabase.from('platform_posts').update({ publication_status: 'ready_to_post_manually' }).eq('id', schedule.platform_post_id);
      await supabase.from('schedules').update({ status: 'completed' }).eq('id', schedule.id);
      results[schedule.id] = 'not_connected -> ready_to_post_manually';
      continue;
    }

    await supabase.from('schedules').update({ status: 'due' }).eq('id', schedule.id);
    const { data: job } = await supabase
      .from('publishing_jobs')
      .insert({ platform_post_id: schedule.platform_post_id, schedule_id: schedule.id, trigger_source: 'schedule', status: 'queued' })
      .select('id')
      .single();
    results[schedule.id] = `queued job ${job?.id}`;
  }

  const { data: queuedJobs } = await supabase
    .from('publishing_jobs')
    .select('id, platform_post_id, platform_posts(platform)')
    .eq('status', 'queued');

  for (const job of queuedJobs ?? []) {
    const platform = (job as any).platform_posts?.platform as Platform | undefined;
    if (!platform) continue;

    await supabase.from('publishing_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id);
    await supabase.from('platform_posts').update({ publication_status: 'uploading' }).eq('id', job.platform_post_id);

    const result = await ADAPTERS[platform]();

    if (result.status === 'published') {
      await supabase.from('publishing_jobs').update({ status: 'succeeded', finished_at: new Date().toISOString() }).eq('id', job.id);
      await supabase.from('platform_posts').update({
        publication_status: 'published', live_url: result.liveUrl ?? null, published_at: new Date().toISOString(), error_message: null
      }).eq('id', job.platform_post_id);
      await supabase.from('schedules').update({ status: 'completed' }).eq('platform_post_id', job.platform_post_id);
    } else if (result.status === 'not_connected') {
      await supabase.from('publishing_jobs').update({ status: 'failed', error_message: 'Not connected', finished_at: new Date().toISOString() }).eq('id', job.id);
      await supabase.from('platform_posts').update({ publication_status: 'ready_to_post_manually' }).eq('id', job.platform_post_id);
    } else {
      await supabase.from('publishing_jobs').update({ status: 'failed', error_message: result.errorMessage ?? 'Unknown error', finished_at: new Date().toISOString() }).eq('id', job.id);
      await supabase.from('platform_posts').update({ publication_status: 'failed', error_message: result.errorMessage ?? 'Unknown error' }).eq('id', job.platform_post_id);
    }
  }

  return json({ ok: true, schedules: results, jobsProcessed: (queuedJobs ?? []).length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
