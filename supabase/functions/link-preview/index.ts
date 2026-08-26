// Supabase Edge Function: link-preview
//
// A pasted Canva/website link shows up in the app as a bare URL — this
// fetches a preview for it server-side (a browser can't, due to CORS) so
// the app can show a real thumbnail instead.
//
// Primary path: microlink.io's public API (no key required for this
// volume). A direct fetch from here was tried first and consistently came
// back empty for Canva links even while spoofing a known bot's user
// agent — confirmed (via a WhatsApp preview of the same link, which does
// show an image) that Canva does serve one, just not to this function's
// own request. The likely reason: bot-protection on Canva's side keyed to
// source IP reputation, not just the user-agent string — Supabase's
// infra doesn't have the standing WhatsApp/Facebook's crawler IPs do, and
// no amount of header-spoofing fixes that. Routing through a dedicated
// unfurling service sidesteps it, since that's exactly what it's built
// to get past. A direct og:image scrape is kept as a fallback for the
// rare case microlink itself can't reach something.
//
// Best-effort only: any failure (unreachable URL, no meta tags, rate
// limit, timeout) returns image_url: null rather than an error — a
// missing thumbnail should never block adding the link itself.
//
// Deploy: supabase functions deploy link-preview

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

async function fetchViaMicrolink(url: string): Promise<{ image_url: string | null; title: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    if (!response.ok) return { image_url: null, title: null };
    const json = await response.json();
    if (json.status !== 'success') return { image_url: null, title: null };
    const imageUrl = json.data?.image?.url ?? json.data?.logo?.url ?? null;
    const title = json.data?.title ?? null;
    return { image_url: imageUrl, title };
  } catch {
    return { image_url: null, title: null };
  } finally {
    clearTimeout(timeout);
  }
}

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

async function fetchViaDirectScrape(url: string): Promise<{ image_url: string | null; title: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok || !response.body) return { image_url: null, title: null };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (html.length < 60000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});

    return {
      image_url: extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image'),
      title: extractMetaContent(html, 'og:title')
    };
  } catch {
    return { image_url: null, title: null };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: jsonHeaders });
    }

    let result = await fetchViaMicrolink(url);
    if (!result.image_url) result = await fetchViaDirectScrape(url);

    return new Response(JSON.stringify(result), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ image_url: null, error: err instanceof Error ? err.message : 'fetch failed' }), {
      headers: jsonHeaders
    });
  }
});
