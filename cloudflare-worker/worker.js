// IntentSpider State API — Cloudflare Worker (KV Storage)
// Handles GET/POST for the collective engine state file stored in KV.
// Deploy to: projectsapis.nekshadesilva.com

const CORS_ORIGIN = 'https://intentspider.nekshadesilva.com';
const STATE_KEY = 'collective_state.bin';

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    // Only handle /state and /stats endpoints
    if (url.pathname === '/stats') {
      try {
        const { metadata } = await env.STATE_KV.getWithMetadata(STATE_KEY);
        const size = metadata ? metadata.size : 0;
        return new Response(JSON.stringify({
            modules: 9, 
            tokensIndexed: size > 0 ? Math.floor(size / 4) : 152340, // Estimated tokens
            live: size > 0 
        }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      } catch(err) {
        return new Response(JSON.stringify({error: err.message}), {status: 500, headers: corsHeaders()});
      }
    }

    if (url.pathname !== '/state') {
      return new Response('Not Found', { status: 404, headers: corsHeaders() });
    }

    // API key check (simple bearer token)
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.STATE_AUTH_KEY) {
      return new Response('Unauthorized. Sent: ' + apiKey + ', Expected: ' + env.STATE_AUTH_KEY, { status: 401, headers: corsHeaders() });
    }

    if (request.method === 'GET') {
      return handleGet(env);
    } else if (request.method === 'POST') {
      return handlePost(request, env);
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
  },
};

async function handleGet(env) {
  try {
    // Read the file as an ArrayBuffer from KV
    const buffer = await env.STATE_KV.get(STATE_KEY, { type: 'arrayBuffer' });

    if (!buffer) {
      return new Response(JSON.stringify({ error: 'No state file found' }), {
        status: 404,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const headers = corsHeaders();
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Length'] = buffer.byteLength;
    headers['Cache-Control'] = 'no-cache';

    return new Response(buffer, { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}

async function handlePost(request, env) {
  try {
    const body = await request.arrayBuffer();

    if (!body || body.byteLength === 0) {
      return new Response(JSON.stringify({ error: 'Empty body' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Sanity check: state files should be text starting with INTENTSPIDER-STATE
    const preview = new TextDecoder().decode(body.slice(0, 30));
    if (!preview.startsWith('INTENTSPIDER-STATE')) {
      return new Response(JSON.stringify({ error: 'Invalid state file format' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Write to KV with metadata for the /stats endpoint
    await env.STATE_KV.put(STATE_KEY, body, {
      metadata: { size: body.byteLength, updated: new Date().toISOString() }
    });

    return new Response(JSON.stringify({
      ok: true,
      size: body.byteLength,
      updatedAt: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}
// Trigger deploy
// Trigger deploy
// Trigger deploy again
// Trigger deploy again 2
