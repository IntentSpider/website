// IntentSpider State API — Cloudflare Worker (KV Storage)
// Handles chunked saving and loading to bypass 25MB limits.

const CORS_ORIGIN = 'https://intentspider.nekshadesilva.com';
const STATE_KEY_LEGACY = 'collective_state.bin';
const MANIFEST_KEY = 'collective_state.manifest';
const CHUNK_PREFIX = 'collective_state.chunk_';
const TRANSIENT_KEY = 'global_transient_state.bin';

function stateMetaHeaders(metadata) {
  const headers = corsHeaders();
  if (metadata?.generation) headers['X-State-Generation'] = metadata.generation;
  if (metadata?.updatedAt) headers['X-State-Updated-At'] = metadata.updatedAt;
  if (metadata?.size !== undefined) headers['X-State-Size'] = String(metadata.size);
  return headers;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // API key check
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.STATE_AUTH_KEY) {
      // For stats, we allow public read without API key
      if (url.pathname !== '/stats') {
         return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
      }
    }

    if (request.method === 'GET') {
      if (url.pathname === '/stats') return handleStats(env);
      if (url.pathname === '/state/manifest') return handleGetManifest(env);
      if (url.pathname.startsWith('/state/chunk/')) return handleGetChunk(url, env);
      if (url.pathname === '/state/transient') return handleGetTransient(env);
      
      // Backward compatibility for old fetch logic
      if (url.pathname === '/state') return handleGetLegacy(env);
    } else if (request.method === 'POST') {
      if (url.pathname === '/state/manifest') return handlePostManifest(request, env);
      if (url.pathname.startsWith('/state/chunk/')) return handlePostChunk(request, url, env);
      if (url.pathname === '/state/transient') return handlePostTransient(request, env);
      
      // Legacy POST
      if (url.pathname === '/state') return handlePostLegacy(request, env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  },
};

// ================================================================
// GET HANDLERS
// ================================================================

async function handleStats(env) {
  try {
    let size = 0;
    // Try manifest first
    const manifestStr = await env.STATE_KV.get(MANIFEST_KEY);
    if (manifestStr) {
        const manifest = JSON.parse(manifestStr);
        size = manifest.totalSize || 0;
    } else {
        // Fallback to legacy
        const { metadata } = await env.STATE_KV.getWithMetadata(STATE_KEY_LEGACY);
        size = metadata ? metadata.size : 0;
    }
    
    return new Response(JSON.stringify({
        modules: 9, 
        tokensIndexed: size > 0 ? Math.floor(size / 4) : 0, 
        live: size > 0 
    }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch(err) {
    return new Response(JSON.stringify({error: err.message}), {status: 500, headers: corsHeaders()});
  }
}

async function handleGetManifest(env) {
  try {
    const { value: manifestStr, metadata } = await env.STATE_KV.getWithMetadata(MANIFEST_KEY);
    if (manifestStr) {
      return new Response(manifestStr, { status: 200, headers: { ...stateMetaHeaders(metadata), 'Content-Type': 'application/json' } });
    }
    
    // Legacy migration check
    const { metadata } = await env.STATE_KV.getWithMetadata(STATE_KEY_LEGACY);
    if (metadata) {
      // Fake a manifest for the legacy file
      const fakeManifest = { totalSize: metadata.size, chunks: 1, legacy: true };
      return new Response(JSON.stringify(fakeManifest), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'No state found' }), { status: 404, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
}

async function handleGetChunk(url, env) {
  try {
    const chunkIdStr = url.pathname.replace('/state/chunk/', '');
    const isLegacy = url.searchParams.get('legacy') === 'true';
    
    let key = CHUNK_PREFIX + chunkIdStr;
    if (isLegacy && chunkIdStr === '0') {
        key = STATE_KEY_LEGACY;
    }

    const buffer = await env.STATE_KV.get(key, { type: 'arrayBuffer' });
    if (!buffer) {
      return new Response('Chunk not found', { status: 404, headers: corsHeaders() });
    }

    const headers = corsHeaders();
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Length'] = buffer.byteLength;
    return new Response(buffer, { status: 200, headers });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: corsHeaders() });
  }
}

async function handleGetLegacy(env) {
  try {
    const buffer = await env.STATE_KV.get(STATE_KEY_LEGACY, { type: 'arrayBuffer' });
    if (!buffer) return new Response('Not found', { status: 404, headers: corsHeaders() });
    const headers = corsHeaders();
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Length'] = buffer.byteLength;
    return new Response(buffer, { status: 200, headers });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: corsHeaders() });
  }
}

// ================================================================
// POST HANDLERS
// ================================================================

async function handlePostManifest(request, env) {
  try {
    const body = await request.json();
    if (!body.totalSize || !body.chunks || !body.generation) throw new Error("Invalid manifest");

    const expectedGeneration = request.headers.get('X-Expected-Generation') || '';
    const { metadata: current } = await env.STATE_KV.getWithMetadata(MANIFEST_KEY);
    const currentGeneration = current?.generation || '';
    if (expectedGeneration !== currentGeneration) {
      return new Response(JSON.stringify({
        error: 'State changed since this tab loaded',
        currentGeneration,
      }), {
        status: 409,
        headers: { ...stateMetaHeaders(current), 'Content-Type': 'application/json' },
      });
    }

    const updatedAt = new Date().toISOString();
    const metadata = { generation: body.generation, updatedAt, size: body.totalSize };
    await env.STATE_KV.put(MANIFEST_KEY, JSON.stringify({ ...body, updatedAt }), { metadata });
    return new Response(JSON.stringify({ ok: true, generation: body.generation, updatedAt }), {
      status: 200,
      headers: { ...stateMetaHeaders(metadata), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
}

async function handlePostChunk(request, url, env) {
  try {
    const chunkId = url.pathname.replace('/state/chunk/', '');
    const body = await request.arrayBuffer();
    
    if (!body || body.byteLength === 0) throw new Error("Empty chunk");

    await env.STATE_KV.put(CHUNK_PREFIX + chunkId, body);
    
    return new Response(JSON.stringify({ ok: true, size: body.byteLength }), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
}

async function handlePostLegacy(request, env) {
  try {
    const body = await request.arrayBuffer();
    await env.STATE_KV.put(STATE_KEY_LEGACY, body, {
      metadata: { size: body.byteLength, updated: new Date().toISOString() }
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: corsHeaders() });
  }
}
