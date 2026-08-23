// Invoke once a day (Supabase scheduled trigger). Calls the SQL function
// that fans out "due soon" / "overdue" notifications — see
// generate_deadline_notifications() in supabase/schema.sql. Kept as its own
// tiny function (rather than inline SQL cron) so it's easy to point a
// dashboard-configured schedule at without touching the database directly.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async () => {
  const { error } = await supabase.rpc('generate_deadline_notifications');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }));
});
