// Supabase Edge Function: parse-content-batch
//
// Turns a founder's rough (or fully detailed) description of upcoming
// content into a list of separate content items — pulling out everything a
// content card actually has a field for (description, script, campaign,
// tags), not just a title. Pure parsing — no database writes here, so no
// service role key is needed. The client shows the proposed list for
// review/editing, then creates each one itself via the normal
// createContentItem() repository call, so ownership/RLS/permissions all go
// through exactly the same path a manually-created item would.
//
// Deploy: supabase functions deploy parse-content-batch
// Secrets required: ANTHROPIC_API_KEY.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const PROPOSE_ITEMS_TOOL = {
  name: 'propose_items',
  description:
    "Split the founder's description of upcoming content into individual content items — one per distinct " +
    'piece of content (a single post, video, reel, carousel, etc). Never merge more than one piece of content ' +
    'into a single item. Preserve real detail from the text rather than summarizing it away — if the text ' +
    'already contains a full script, caption, or hook, copy it into the item close to verbatim rather than ' +
    "condensing it, and never invent detail that wasn't in the text.",
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A short, clear title for this one piece of content.' },
            due_date: {
              type: ['string', 'null'],
              description:
                'YYYY-MM-DD if a date or deadline was mentioned or clearly implied, resolved against today_date ' +
                '(e.g. "the 5th" means the 5th of the current or next month, whichever is not already past) — ' +
                'null if no date was given.'
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              description: "Best guess from the text's tone/urgency, or an explicit \"suggested priority\" — default to normal."
            },
            description: {
              type: ['string', 'null'],
              description:
                'What this piece of content is about and why — combine any "Purpose" and "Core message" the ' +
                'text gives into a couple of clear sentences. Null only if the text truly gives no context beyond the title.'
            },
            script: {
              type: ['string', 'null'],
              description:
                'The actual production content for this item, copied in full rather than summarized: a slide-' +
                'by-slide carousel script, a video script, a hook + caption + CTA, or whatever the text lays out ' +
                'for this specific item. Keep slide numbers/labels and line breaks so it reads exactly like the ' +
                'source. Null if the text gives no script/caption content for this item, only a plan.'
            },
            campaign: {
              type: ['string', 'null'],
              description: 'The named campaign this belongs to, if the text states one (e.g. "Campaign: September 2026 — Back to School") — null if none is named.'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Suggested tags/hashtags for this item, without the leading #, e.g. ["TheMajlisAcademy", "BackToSchool"]. Empty array if none given.'
            },
            notes: {
              type: ['string', 'null'],
              description:
                'Anything else from the text worth keeping that does not fit the fields above — audience, ' +
                'assets needed, people needed, format/platform, hook, or other detail. Null if nothing is left over.'
            }
          },
          required: ['title', 'priority']
        }
      }
    },
    required: ['items']
  }
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text, today_date } = await req.json();
    if (!text || !String(text).trim()) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
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

    const todayDate = String(today_date ?? new Date().toISOString().slice(0, 10));

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system:
          "You're helping a founder at Majlis Media Studio turn a description of upcoming content, typed or " +
          `pasted in their own words, into a clean, organized list of content items. Today's date is ${todayDate}. ` +
          'Split the text into one item per distinct piece of content — don\'t combine several posts/videos into ' +
          'one item. The input can be anything from a one-line rough plan to a fully written brief with scripts, ' +
          'captions and hashtags already in it — when the detail is already there, carry it into the right field ' +
          "(description/script/campaign/tags/notes) rather than dropping it, and don't add anything not implied " +
          'by the text. If the text only describes one piece of content, return a list of exactly one item.',
        tools: [PROPOSE_ITEMS_TOOL],
        tool_choice: { type: 'tool', name: 'propose_items' },
        messages: [{ role: 'user', content: String(text).trim() }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} ${errText}`);
    }

    const completion = await anthropicResponse.json();
    const toolUse = completion.content?.find((block: { type: string }) => block.type === 'tool_use');
    const items: Array<{
      title: string;
      due_date?: string | null;
      priority?: string;
      description?: string | null;
      script?: string | null;
      campaign?: string | null;
      tags?: string[];
      notes?: string | null;
    }> = toolUse?.input?.items ?? [];

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
