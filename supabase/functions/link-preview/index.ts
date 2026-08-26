// Supabase Edge Function: link-preview
//
// A pasted Canva/website link shows up in the app as a bare URL — this
// fetches that URL server-side (a browser can't, due to CORS) and pulls
// its og:image (falling back to twitter:image) meta tag, so the app can
// show a real thumbnail instead. Canva's own share pages always set
// og:image to a render of the design, which is what makes this work well
// for the Canva links FS2 is mostly full of.
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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: jsonHeaders });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MajlisFounderOS-LinkPreview/1.0)' }
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !response.body) {
      return new Response(JSON.stringify({ image_url: null }), { headers: jsonHeaders });
    }

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

    const imageUrl = extractMetaContent(html, 'og:image') ?? extractMetaContent(html, 'twitter:image');
    const title = extractMetaContent(html, 'og:title');

    return new Response(JSON.stringify({ image_url: imageUrl, title }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ image_url: null, error: err instanceof Error ? err.message : 'fetch failed' }), {
      headers: jsonHeaders
    });
  }
});
