// IntentSpider State API — Cloudflare Worker
// Handles GET/POST for the collective engine state file stored in R2.
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

    // Only handle /state endpoint
    if (url.pathname !== '/state') {
      return new Response('Not Found', { status: 404, headers: corsHeaders() });
    }

    // API key check (simple bearer token)
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
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
    const object = await env.STATE_BUCKET.get(STATE_KEY);

    if (!object) {
      return new Response(JSON.stringify({ error: 'No state file found' }), {
        status: 404,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    const headers = corsHeaders();
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Length'] = object.size;
    headers['ETag'] = object.httpEtag;
    headers['Last-Modified'] = object.uploaded.toUTCString();
    headers['Cache-Control'] = 'no-cache';

    return new Response(object.body, { status: 200, headers });
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

    await env.STATE_BUCKET.put(STATE_KEY, body, {
      httpMetadata: {
        contentType: 'application/octet-stream',
      },
      customMetadata: {
        updatedAt: new Date().toISOString(),
        sizeBytes: String(body.byteLength),
      },
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
