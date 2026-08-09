// IntentSpider State API — Cloudflare Worker (KV Storage)
// Handles chunked saving and loading to bypass 25MB limits.

const CORS_ORIGIN = 'https://intentspider.nekshadesilva.com';
const STATE_KEY_LEGACY = 'collective_state.bin';
const MANIFEST_KEY = 'collective_state.manifest';
const CHUNK_PREFIX = 'collective_state.chunk_';
const TRANSIENT_KEY = 'global_transient_state.bin'; // legacy singleton
const TRANSIENT_PREFIX = 'global_transient_state.';

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
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-State-Generation, X-Expected-Generation',
    'Access-Control-Expose-Headers': 'X-State-Generation, X-State-Updated-At, X-State-Size',
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
      if (url.pathname === '/state/transient') return handleGetTransient(url, env);
      
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
    let tokensIndexed = 0;
    const manifestStr = await env.STATE_KV.get(MANIFEST_KEY);
    if (manifestStr) {
      const manifest = JSON.parse(manifestStr);
      size = manifest.totalSize || 0;
      // New clients persist the engine's real committed-token counter. Retain the
      // historical size estimate only for snapshots created before state v4.
      tokensIndexed = Number.isSafeInteger(manifest.tokensIndexed)
        ? manifest.tokensIndexed
        : (size > 0 ? Math.floor(size / 4) : 0);
    } else {
      const { metadata } = await env.STATE_KV.getWithMetadata(STATE_KEY_LEGACY);
      size = metadata ? metadata.size : 0;
      tokensIndexed = size > 0 ? Math.floor(size / 4) : 0;
    }

    return new Response(JSON.stringify({
      modules: 9,
      tokensIndexed,
      live: size > 0,
    }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders() });
  }
}

async function handleGetManifest(env) {
  try {
    const { value: manifestStr, metadata } = await env.STATE_KV.getWithMetadata(MANIFEST_KEY);
    if (manifestStr) {
      return new Response(manifestStr, { status: 200, headers: { ...stateMetaHeaders(metadata), 'Content-Type': 'application/json' } });
    }
    
    // Legacy migration check
    const { metadata: legacyMetadata } = await env.STATE_KV.getWithMetadata(STATE_KEY_LEGACY);
    if (legacyMetadata) {
      // Fake a manifest for the legacy file
      const fakeManifest = { totalSize: legacyMetadata.size, chunks: 1, legacy: true };
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
    
    const generation = url.searchParams.get('generation');
    let key = generation
      ? `${CHUNK_PREFIX}${generation}.${chunkIdStr}`
      : CHUNK_PREFIX + chunkIdStr;
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

async function handleGetTransient(url, env) {
  try {
    const { value: manifestStr, metadata: manifestMetadata } = await env.STATE_KV.getWithMetadata(MANIFEST_KEY);
    const manifest = manifestStr ? JSON.parse(manifestStr) : null;
    const currentGeneration = manifest?.generation || manifestMetadata?.generation || '';
    const requestedGeneration = url.searchParams.get('generation') || currentGeneration;
    if (currentGeneration && requestedGeneration !== currentGeneration) {
      return new Response(JSON.stringify({ error: 'Requested transient is not current' }), {
        status: 409,
        headers: { ...stateMetaHeaders(manifestMetadata), 'Content-Type': 'application/json' },
      });
    }
    const key = requestedGeneration ? TRANSIENT_PREFIX + requestedGeneration : TRANSIENT_KEY;
    const { value: buffer, metadata } = await env.STATE_KV.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!buffer) return new Response('Not found', { status: 404, headers: corsHeaders() });
    const headers = stateMetaHeaders(metadata || manifestMetadata);
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
    if (!body.totalSize || !body.chunks) throw new Error("Invalid manifest");
    if (body.tokensIndexed !== undefined &&
        (!Number.isSafeInteger(body.tokensIndexed) || body.tokensIndexed < 0)) {
      throw new Error("Invalid token count");
    }

    const updatedAt = new Date().toISOString();
    const metadata = { generation: body.generation || '', updatedAt, size: body.totalSize };

    // Generation-aware clients get optimistic concurrency protection. Legacy
    // v13 clients remain accepted until every cached page has upgraded.
    if (body.generation) {
      const expectedGeneration = request.headers.get('X-Expected-Generation') || '';
      const { value: currentManifestStr, metadata: current } =
        await env.STATE_KV.getWithMetadata(MANIFEST_KEY);
      const currentGeneration = current?.generation || '';
      // Empty expected generation is the controlled migration path for clients
      // that loaded a legacy manifest with no generation. Once generations are
      // present, only the exact reader generation may advance the state.
      if (currentGeneration && expectedGeneration !== currentGeneration) {
        return new Response(JSON.stringify({
          error: 'State changed since this tab loaded',
          currentGeneration,
        }), {
          status: 409,
          headers: { ...stateMetaHeaders(current), 'Content-Type': 'application/json' },
        });
      }

      // Counts are cumulative. A format migration or stale client may know less
      // history, but it must never make the public counter move backwards.
      if (currentManifestStr) {
        const currentManifest = JSON.parse(currentManifestStr);
        const currentTokens = Number.isSafeInteger(currentManifest.tokensIndexed)
          ? currentManifest.tokensIndexed
          : (currentManifest.totalSize > 0 ? Math.floor(currentManifest.totalSize / 4) : 0);
        if (body.tokensIndexed === undefined || body.tokensIndexed < currentTokens) {
          body.tokensIndexed = currentTokens;
        }

        // Normal profiles update only the shared graph. Carry the current global
        // person's package forward to the new tokenizer-identical generation so
        // switching graph generations does not erase that persona.
        if (body.updatesTransient !== true && currentGeneration) {
          const currentTransient = await env.STATE_KV.get(
            TRANSIENT_PREFIX + currentGeneration,
            { type: 'arrayBuffer' }
          );
          if (currentTransient) {
            const transientMetadata = {
              generation: body.generation,
              updatedAt,
              size: currentTransient.byteLength,
            };
            await env.STATE_KV.put(
              TRANSIENT_PREFIX + body.generation,
              currentTransient,
              { metadata: transientMetadata }
            );
          }
        }
      }
    }

    delete body.updatesTransient;
    await env.STATE_KV.put(MANIFEST_KEY, JSON.stringify({ ...body, updatedAt }), { metadata });
    return new Response(JSON.stringify({ ok: true, generation: body.generation || '', updatedAt }), {
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
    const generation = request.headers.get('X-State-Generation');
    const body = await request.arrayBuffer();
    
    if (!generation) throw new Error("Missing state generation");
    if (!body || body.byteLength === 0) throw new Error("Empty chunk");

    await env.STATE_KV.put(`${CHUNK_PREFIX}${generation}.${chunkId}`, body);
    
    return new Response(JSON.stringify({ ok: true, size: body.byteLength, generation }), { status: 200, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } });
  }
}

async function handlePostTransient(request, env) {
  try {
    const generation = request.headers.get('X-State-Generation');
    if (!generation) throw new Error('Missing state generation');
    // Stage the person package under its immutable generation before publishing
    // the manifest. If the manifest compare-and-swap later fails, this object is
    // merely orphaned; readers can never observe a graph without its paired state.
    const body = await request.arrayBuffer();
    if (!body || body.byteLength === 0) throw new Error('Empty transient state');
    const metadata = { generation, updatedAt: new Date().toISOString(), size: body.byteLength };
    await env.STATE_KV.put(TRANSIENT_PREFIX + generation, body, { metadata });
    return new Response(JSON.stringify({ ok: true, generation, size: body.byteLength }), {
      status: 200,
      headers: { ...stateMetaHeaders(metadata), 'Content-Type': 'application/json' },
    });
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
