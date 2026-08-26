// Supabase Edge Function: link-preview
//
// A pasted Canva/website link shows up in the app as a bare URL — this
// fetches that URL server-side (a browser can't, due to CORS) and pulls
// its og:image (falling back to twitter:image) meta tag, so the app can
// show a real thumbnail instead. Canva's own share pages set og:image to
// a render of the design specifically so links unfurl nicely when pasted
// into WhatsApp/Slack/Facebook — which is also the key to fetching it
// here: most sites only server-render those tags for a request that
// looks like one of those known "social preview" bots, and serve a bare
// client-rendered shell (no meta tags at all) to anything else. So this
// tries as Facebook's crawler first, then falls back to a normal browser
// UA for sites that do the opposite (block bots, serve real browsers).
//
// Best-effort only: any failure (unreachable URL, no meta tags, timeout)
// returns image_url: null rather than an error — a missing thumbnail
// should never block adding the link itself.
//
// Deploy: supabase functions deploy link-preview

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const USER_AGENTS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchHead(url: string, userAgent: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' }
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || !response.body) return '';

  // Meta tags are always near the top of <head> — read a bounded chunk
  // instead of the whole page, which can be much larger than needed.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  while (html.length < 60000) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return html;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: jsonHeaders });
    }

    let imageUrl: string | null = null;
    let title: string | null = null;

    for (const userAgent of USER_AGENTS) {
      try {
        const html = await fetchHead(url, userAgent);
        imageUrl = extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image');
        title = extractMetaContent(html, 'og:title');
        if (imageUrl) break;
      } catch {
        // try the next user agent
      }
    }

    return new Response(JSON.stringify({ image_url: imageUrl, title }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ image_url: null, error: err instanceof Error ? err.message : 'fetch failed' }), {
      headers: jsonHeaders
    });
  }
});
