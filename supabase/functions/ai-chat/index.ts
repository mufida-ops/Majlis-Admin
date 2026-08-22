// Supabase Edge Function: ai-chat
//
// A founder's private, ongoing conversation with the AI assistant — unlike
// parse-drop (a one-shot pass over a single saved note), this keeps message
// history and replies conversationally, optionally proposing ONE structured
// action per turn for the founder to review on the AI Actions screen.
//
// Deploy: supabase functions deploy ai-chat
// Secrets required: ANTHROPIC_API_KEY (SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform).
// Optional: ANTHROPIC_MODEL.

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
  'create_organisation',
  'send_partner_message'
] as const;

const RESPOND_TOOL = {
  name: 'respond',
  description: "Reply to the founder's chat message, optionally proposing one structured follow-up action.",
  input_schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description:
          "Your conversational reply, shown directly to the founder in the chat. Natural, warm, concise — a couple of sentences at most unless they asked something that needs more. If you're proposing an action below, say so in the reply (e.g. \"I'll add that to your calendar — take a look below.\")."
      },
      action: {
        type: ['object', 'null'],
        description:
          'At most one structured action this specific message clearly calls for — omit (null) for plain conversation, a question, or anything not clearly actionable. Never propose more than one action per turn.',
        properties: {
          action_type: { type: 'string', enum: ACTION_TYPES },
          confidence: { type: 'number', description: '0 to 1, how clearly the message supports this action' },
          payload: {
            type: 'object',
            description:
              'Fields depend on action_type: create_task {project_id, title, owner_user_id?, due_at?}; assign_task {task_id, owner_user_id}; update_task {task_id, status: Todo|Doing|Waiting|Done}; create_decision {title, rationale?, project_id?, owner: display name or "Both"}; resolve_decision {decision_id, status: Agreed|Discuss}; add_crm_note {organisation_id, note}; update_pipeline_stage {organisation_id, stage}; create_follow_up {organisation_id, next_action, next_action_at?}; mark_waiting_for {task_id}; create_event {title, start_date (YYYY-MM-DD — resolve words like "today"/"tomorrow"/"Friday" using today_date in the workspace context, never guess a date), start_time? (24h HH:MM, only if a specific time was mentioned), all_day? (true when no specific time was mentioned), description?}; create_organisation {name, stage? (one of Lead|Contacted|Meeting Booked|Proposal Sent|Negotiating|Won|Onboarding|Active Partner|Follow-up — default Lead unless clearly further along), note?, next_action?}; send_partner_message {message, urgent? (true only if this genuinely cannot wait — most late-night or "just thinking out loud" messages should be false, since false respects the co-founder\'s quiet hours and just waits for their next catch-up instead of interrupting them)} — use this when the founder wants something passed along to their co-founder rather than acted on in the workspace (e.g. "tell Victoria I\'m thinking about X", "let Mufida know Y", any message meant for the other person, especially late-night ones they don\'t want to send straight to WhatsApp). Only reference project_id/task_id/organisation_id/decision_id values given in the workspace context — never invent one; if a company/school/contact isn\'t already listed in organisations, propose create_organisation for it instead.'
          }
        },
        required: ['action_type', 'payload']
      }
    },
    required: ['reply']
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { workspace_id, user_id, message } = await req.json();
    if (!workspace_id || !user_id || !message || !String(message).trim()) {
      return new Response(JSON.stringify({ error: 'workspace_id, user_id and message are required' }), {
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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: userMessage, error: insertUserError } = await supabase
      .from('ai_chat_messages')
      .insert({ workspace_id, user_id, role: 'user', content: String(message).trim() })
      .select('*')
      .single();
    if (insertUserError) throw new Error(insertUserError.message);

    const [
      { data: history },
      { data: members },
      { data: projects },
      { data: tasks },
      { data: decisions },
      { data: organisations },
      { data: recentActivity }
    ] = await Promise.all([
      supabase
        .from('ai_chat_messages')
        .select('role, content')
        .eq('workspace_id', workspace_id)
        .eq('user_id', user_id)
        .order('created_at', { ascending: true })
        .limit(40),
      supabase.from('workspace_members').select('user_id, display_name, timezone').eq('workspace_id', workspace_id),
      supabase.from('projects').select('id, title, status').eq('workspace_id', workspace_id),
      supabase.from('project_tasks').select('id, title, status, project_id').eq('workspace_id', workspace_id),
      supabase.from('decisions').select('id, title, status').eq('workspace_id', workspace_id),
      supabase
        .from('organisations')
        .select('id, name, stage, last_contact_at, next_action, next_action_at, notes')
        .eq('workspace_id', workspace_id),
      // Real history for "when did we..." / "what happened with..." questions —
      // the open-items lists above only cover current state, not the past.
      supabase
        .from('activity_events')
        .select('summary, created_at')
        .eq('workspace_id', workspace_id)
        .order('created_at', { ascending: false })
        .limit(40)
    ]);

    const author = (members ?? []).find(m => m.user_id === user_id);
    const authorTimezone = author?.timezone ?? 'Asia/Dubai';
    const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: authorTimezone }).format(d);
    const openTasks = (tasks ?? []).filter(t => t.status !== 'Done');
    const waitingDecisions = (decisions ?? []).filter(d => d.status === 'Waiting');

    const context = {
      author_name: author?.display_name ?? 'A founder',
      today_date: localDate(new Date()),
      tomorrow_date: localDate(new Date(Date.now() + 86400000)),
      members: (members ?? []).map(m => ({ user_id: m.user_id, name: m.display_name })),
      open_projects: (projects ?? []).map(p => ({ id: p.id, title: p.title, status: p.status })),
      open_tasks: openTasks.map(t => ({ id: t.id, title: t.title, status: t.status, project_id: t.project_id })),
      waiting_decisions: waitingDecisions.map(d => ({ id: d.id, title: d.title })),
      organisations: (organisations ?? []).map(o => ({
        id: o.id,
        name: o.name,
        stage: o.stage,
        last_contact_at: o.last_contact_at,
        next_action: o.next_action,
        next_action_at: o.next_action_at,
        notes: o.notes
      })),
      // Newest first, timestamped — use this to answer questions about what
      // happened and when (a CRM contact, a decision, a task change, etc.).
      recent_history: (recentActivity ?? []).map(e => ({ when: e.created_at, what: e.summary }))
    };

    const anthropicMessages = (history ?? []).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content
    }));

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
        system:
          `You're ${context.author_name}'s AI Assistant inside Majlis, a shared founder workspace app. You're ` +
          `chatting one-on-one and privately with them — this conversation is not seen by their co-founder. Be ` +
          `warm, direct, and concise.\n\n` +
          `You can do three kinds of things here:\n` +
          `1. Answer questions using the workspace context below — including recent_history, which is real dated ` +
          `history (CRM contact, decisions, task changes, etc.), so answer "when did we..." / "what happened ` +
          `with..." questions from there rather than guessing or saying you don't know.\n` +
          `2. Give honest advice or thinking-partner input when they ask "should I do this or that" — reason it ` +
          `through with them like a sharp co-founder would, using the real context you have, not generic advice.\n` +
          `3. When their message clearly calls for a concrete action (a task, decision, CRM update, calendar ` +
          `event, or passing a message to their co-founder), propose it via the tool's optional "action" field so ` +
          `it can be reviewed before anything is created or sent — never claim you've already done something.\n\n` +
          `For plain conversation, a question, or advice, just reply and leave action out — don't force an action ` +
          `where none was asked for.\n\n` +
          `Workspace context (only use these ids, never invent new ones; resolve relative dates like "today"/` +
          `"tomorrow" using today_date/tomorrow_date, both already in ${context.author_name}'s own timezone):\n` +
          JSON.stringify(context, null, 2),
        tools: [RESPOND_TOOL],
        tool_choice: { type: 'tool', name: 'respond' },
        messages: anthropicMessages
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} ${errText}`);
    }

    const completion = await anthropicResponse.json();
    const toolUse = completion.content?.find((block: { type: string }) => block.type === 'tool_use');
    const reply: string = toolUse?.input?.reply ?? "Sorry, I couldn't come up with a reply just then — try again?";
    const proposedAction: { action_type: string; confidence?: number; payload: Record<string, unknown> } | null =
      toolUse?.input?.action ?? null;

    // Same guardrail as parse-drop: never let a suggestion reference an id
    // that doesn't actually exist in the workspace, even if Claude proposed
    // one — re-validate against the real data rather than trust the model.
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

    const validAction =
      proposedAction &&
      (ACTION_TYPES as readonly string[]).includes(proposedAction.action_type) &&
      hasOnlyKnownIds(proposedAction.payload ?? {})
        ? proposedAction
        : null;

    const { data: assistantMessage, error: insertAssistantError } = await supabase
      .from('ai_chat_messages')
      .insert({ workspace_id, user_id, role: 'assistant', content: reply })
      .select('*')
      .single();
    if (insertAssistantError) throw new Error(insertAssistantError.message);

    let actionRow = null;
    if (validAction) {
      const { data, error: insertActionError } = await supabase
        .from('ai_actions')
        .insert({
          workspace_id,
          chat_message_id: assistantMessage.id,
          action_type: validAction.action_type,
          payload: validAction.payload ?? {},
          confidence: typeof validAction.confidence === 'number' ? validAction.confidence : null
        })
        .select('*')
        .single();
      if (insertActionError) throw new Error(insertActionError.message);
      actionRow = data;
    }

    return new Response(JSON.stringify({ userMessage, assistantMessage, action: actionRow }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
