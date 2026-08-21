// Supabase Edge Function: parse-drop
//
// Turns one freeform Drop into zero or more structured, reviewable
// ai_actions rows (create_task, assign_task, create_decision, ...), using
// Claude with forced tool use so the output is always valid structured
// data instead of freeform text to parse. In the same call, it also asks
// for a short third-person summary of the drop, which replaces the raw
// (possibly long, rambling) text in the co-founder's Catch-up feed.
//
// Deploy: supabase functions deploy parse-drop
// Secrets required: ANTHROPIC_API_KEY (SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform).
// Optional: ANTHROPIC_MODEL (defaults to a fast/cheap model — this is a
// background parsing job, not the primary product surface).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const ACTION_TYPES = [
  'create_task',
  'assign_task',
  'update_task',
  'create_decision',
  'resolve_decision',
  'add_crm_note',
  'update_pipeline_stage',
  'create_follow_up',
  'mark_waiting_for',
  'create_event',
  'create_organisation'
] as const;

const PROPOSE_ACTIONS_TOOL = {
  name: 'propose_actions',
  description:
    "Propose structured follow-up actions extracted from a founder's freeform note. Only propose actions clearly supported by the text — an empty list is correct when nothing actionable was said.",
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          "One or two plain sentences, third person, summarising what this note says for the founder's co-founder to read in their catch-up feed — e.g. \"Mufida decided to move the cultural box before teacher CPD in Phase 2 and flagged the venue deposit as due Friday.\" Written even for short notes; for a already-short note this may just lightly rephrase it."
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action_type: { type: 'string', enum: ACTION_TYPES },
            confidence: { type: 'number', description: '0 to 1, how clearly the text supports this action' },
            payload: {
              type: 'object',
              description:
                'Fields depend on action_type: create_task {project_id, title, owner_user_id?, due_at?}; assign_task {task_id, owner_user_id}; update_task {task_id, status: Todo|Doing|Waiting|Done}; create_decision {title, rationale?, project_id?, owner: display name or "Both"}; resolve_decision {decision_id, status: Agreed|Discuss}; add_crm_note {organisation_id, note}; update_pipeline_stage {organisation_id, stage}; create_follow_up {organisation_id, next_action, next_action_at?}; mark_waiting_for {task_id}; create_event {title, start_date (YYYY-MM-DD — resolve words like "today"/"tomorrow"/"Friday" using today_date in the workspace context, never guess a date), start_time? (24h HH:MM, only if the note actually mentions a specific time), all_day? (true when no specific time was mentioned), description?}; create_organisation {name, stage? (one of Lead|Contacted|Meeting Booked|Proposal Sent|Negotiating|Won|Onboarding|Active Partner|Follow-up — default Lead unless the text clearly implies further along), note? (what the drop said about them, for CRM history), next_action?}. Only reference project_id/task_id/organisation_id/decision_id values given in the workspace context — never invent one; that includes organisations — if a company/school/contact the note describes is NOT already listed in organisations, propose create_organisation for it instead of add_crm_note/update_pipeline_stage/create_follow_up (which require an existing organisation_id).'
            }
          },
          required: ['action_type', 'payload']
        }
      }
    },
    required: ['summary', 'actions']
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { drop_id, propose_actions = true } = await req.json();
    if (!drop_id) {
      return new Response(JSON.stringify({ error: 'drop_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured for this project.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Service-role client: this function runs trusted server-side logic and
    // needs to read across the workspace for context and write ai_actions
    // regardless of which member's drop triggered it.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: drop, error: dropError } = await supabase.from('drops').select('*').eq('id', drop_id).single();
    if (dropError || !drop) throw new Error(dropError?.message ?? 'Drop not found.');

    const [{ data: members }, { data: projects }, { data: tasks }, { data: decisions }, { data: organisations }] =
      await Promise.all([
        supabase.from('workspace_members').select('user_id, display_name, timezone').eq('workspace_id', drop.workspace_id),
        supabase.from('projects').select('id, title').eq('workspace_id', drop.workspace_id),
        supabase
          .from('project_tasks')
          .select('id, title, status, project_id')
          .eq('workspace_id', drop.workspace_id)
          .neq('status', 'Done'),
        supabase.from('decisions').select('id, title, status').eq('workspace_id', drop.workspace_id).eq('status', 'Waiting'),
        supabase.from('organisations').select('id, name, stage').eq('workspace_id', drop.workspace_id)
      ]);

    const author = (members ?? []).find(m => m.user_id === drop.created_by);
    const authorTimezone = author?.timezone ?? 'Asia/Dubai';

    // Computed in the author's own timezone (not the server's, which is
    // arbitrary) so "today"/"tomorrow" in a dictated note resolve to the
    // calendar date the author actually meant.
    const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: authorTimezone }).format(d);
    const todayDate = localDate(new Date());
    const tomorrowDate = localDate(new Date(Date.now() + 86400000));

    const context = {
      author_name: author?.display_name ?? 'A founder',
      today_date: todayDate,
      tomorrow_date: tomorrowDate,
      members: (members ?? []).map(m => ({ user_id: m.user_id, name: m.display_name })),
      open_projects: (projects ?? []).map(p => ({ id: p.id, title: p.title })),
      open_tasks: (tasks ?? []).map(t => ({ id: t.id, title: t.title, status: t.status, project_id: t.project_id })),
      waiting_decisions: (decisions ?? []).map(d => ({ id: d.id, title: d.title })),
      organisations: (organisations ?? []).map(o => ({ id: o.id, name: o.name, stage: o.stage }))
    };

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [PROPOSE_ACTIONS_TOOL],
        tool_choice: { type: 'tool', name: 'propose_actions' },
        messages: [
          {
            role: 'user',
            content:
              `${context.author_name} wrote this note ("drop"), which may be a rough voice-dictated rant:\n\n"""${drop.raw_text}"""\n\n` +
              `Workspace context (only use these ids, never invent new ones; resolve relative dates like "today"/"tomorrow" using today_date/tomorrow_date, both already in ${context.author_name}'s own timezone):\n${JSON.stringify(context, null, 2)}\n\n` +
              'First, write the summary for their co-founder\'s catch-up feed. Then propose any structured follow-up actions this note clearly implies.'
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} ${errText}`);
    }

    const completion = await anthropicResponse.json();
    const toolUse = completion.content?.find((block: { type: string }) => block.type === 'tool_use');
    const summary: string | undefined = toolUse?.input?.summary;
    const actions: Array<{ action_type: string; confidence?: number; payload: Record<string, unknown> }> =
      toolUse?.input?.actions ?? [];

    // Claude occasionally hallucinates an id instead of correctly falling
    // back to create_organisation/create_task for something new — the
    // suggestion then looks perfectly normal on the Drop screen, but
    // applying it silently no-ops or fails (the id matches nothing). Rather
    // than trust the model's own id references, re-validate each one
    // against the same context it was given, and drop the action instead of
    // proposing something that can never actually apply.
    const knownIds = {
      project_id: new Set((projects ?? []).map(p => p.id)),
      task_id: new Set((tasks ?? []).map(t => t.id)),
      decision_id: new Set((decisions ?? []).map(d => d.id)),
      organisation_id: new Set((organisations ?? []).map(o => o.id)),
      owner_user_id: new Set((members ?? []).map(m => m.user_id))
    };
    const idFieldsToCheck: Array<keyof typeof knownIds> = ['project_id', 'task_id', 'decision_id', 'organisation_id', 'owner_user_id'];
    const hasOnlyKnownIds = (payload: Record<string, unknown>) =>
      idFieldsToCheck.every(field => {
        const value = payload[field];
        return value == null || typeof value !== 'string' || knownIds[field].has(value);
      });

    const rows = actions
      .filter(a => (ACTION_TYPES as readonly string[]).includes(a.action_type))
      .filter(a => hasOnlyKnownIds(a.payload ?? {}))
      .map(a => ({
        workspace_id: drop.workspace_id,
        drop_id: drop.id,
        action_type: a.action_type,
        payload: a.payload ?? {},
        confidence: typeof a.confidence === 'number' ? a.confidence : null
      }));

    // propose_actions=false means: just write the catch-up summary, don't
    // surface any structured suggestions — a plain drop is only ever a note
    // to the co-founder unless the founder explicitly taps "Action it" on
    // it, which re-calls this same function with propose_actions=true.
    if (propose_actions && rows.length > 0) {
      const { error: insertError } = await supabase.from('ai_actions').insert(rows);
      if (insertError) throw new Error(insertError.message);
    }

    await supabase.from('drops').update({ processed: true, summary: summary ?? null }).eq('id', drop.id);

    // The insert trigger already logged this drop to activity_events using
    // a raw-text snippet (before this summary existed); replace it now so
    // the co-founder's catch-up feed shows the clean version, not the rant.
    if (summary) {
      await supabase
        .from('activity_events')
        .update({ summary })
        .eq('workspace_id', drop.workspace_id)
        .eq('entity_type', 'drop')
        .eq('entity_id', drop.id);
    }

    return new Response(JSON.stringify({ proposed: rows.length, summary: summary ?? null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
