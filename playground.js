// playground.js — IntentSpider Webnet Playground v2.0
// Xterm.js quiz terminal + Mottie keyboard + WASM engine + Cloudflare R2 state sync.

(() => {
    "use strict";

    // ================================================================
    // Configuration
    // ================================================================

    const STATE_API_URL = 'https://intentspiderapis.nekshadesilva.com/state';
    const STATE_API_KEY = 'is_demo_2025_xyz'; // Set this to match your Cloudflare Worker env var
    const STATE_SYNC_INTERVAL_MS = 10000; // Save state every 10 seconds of activity
    const CHAR_LIMIT = 200;

    const urlParams = new URLSearchParams(window.location.search);
    const isGlobalPerson = urlParams.get('global_person') === 'true';
    const epochSeconds = () => Date.now() / 1000;

    // ================================================================
    // DOM handles
    // ================================================================

    const inputDisplay  = document.getElementById('input-display');
    const terminalPanel = document.getElementById('terminal-panel');
    const quizContainer = document.getElementById('quiz-terminal');

    const suggestions   = [
        document.getElementById('sug-1'),
        document.getElementById('sug-2'),
        document.getElementById('sug-3')
    ];

    
    const notificationBanner = document.getElementById('notification-banner');
    const notificationText = document.getElementById('notification-text');

    let currentText = "";

    function showNotification(msg) {
        if (!notificationBanner) return;
        notificationText.textContent = msg;
        notificationBanner.style.display = 'flex';
        window.scrollTo(0, 0);
        setTimeout(() => {
            notificationBanner.style.display = 'none';
        }, 5000);
    }

    // ================================================================
    // Debug Terminal (bottom black panel — unchanged)
    // ================================================================

    let debugTerm = null;
    if (typeof Terminal !== 'undefined') {
        debugTerm = new Terminal({
            theme: { background: '#000000', foreground: '#ffffff' },
            fontFamily: 'monospace',
            fontSize: 12,
            convertEol: true,
            disableStdin: true,
        });
        debugTerm.open(terminalPanel);
        debugTerm.writeln('>> IntentSpider WASM Bridge Initializing...');
        debugTerm.writeln('>> Waiting for engine connection...');
    }

    function logTerminal(msg, type = "info") {
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
        const line = `[${ts}] ${msg}`;
        if (debugTerm) {
            debugTerm.writeln(line);
        } else {
            console.log(line);
        }
    }

    // ================================================================
    // Chat Bubble Interface (wc-bubble based)
    // ================================================================

    const chatMessages = document.getElementById('chat-messages');

    function addChatBubble(text, isUser = false) {
        const bubble = document.createElement('chat-bubble');
        if (isUser) {
            bubble.setAttribute('right', '');
        }
        bubble.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(bubble);

        // Hide the avatar inside the Shadow DOM while keeping the tail
        setTimeout(() => {
            if (bubble.shadowRoot) {
                const style = document.createElement('style');
                style.textContent = `
                    .avatar-container { display: none !important; }
                    svg { display: none !important; }
                    img { display: none !important; }
                `;
                bubble.shadowRoot.appendChild(style);
            }
        }, 50);

        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function initChatInterface() {
        const toggleLink = document.getElementById('global-person-toggle');
        const toggleIcon = document.getElementById('global-toggle-icon');
        const toggleText = document.getElementById('global-toggle-text');
        const profileModeText = document.getElementById('profile-mode-text');
        
        if (toggleLink) {
            if (isGlobalPerson) {
                toggleIcon.src = 'assets/static/toggleon-playground-23.png';
                toggleText.textContent = 'Turn off global user profile';
                if (profileModeText) {
                    profileModeText.innerHTML = `The global user profile is turned on. This is the main branch of this research preview. All users share this single profile. This may lead to more accurate predictions, but the suggestions may not be personalized for you and may include unexpected results. To test personally, please turn off the global profile mode.`;
                }
                toggleLink.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = window.location.pathname; 
                };
            } else {
                toggleIcon.src = 'assets/static/toggleoff-playground-23.png';
                toggleText.textContent = 'Turn on global user profile';
                if (profileModeText) {
                    profileModeText.innerHTML = `This is currently you are starting from the beginning so you have to answer at least 30 to 40 questions in order to <a href="about.html#heating-initial-start" id="heat-graph-link">heat the graph</a>.`;
                }
                toggleLink.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = window.location.pathname + '?global_person=true';
                };
            }
        }
    }

    // ================================================================
    // Quiz Manager
    // ================================================================

    const Quiz = {
        questions: [],
        shuffled: [],
        currentIndex: 0,
        totalAnswered: 0,
        loaded: false,

        async load() {
            try {
                const resp = await fetch('questions.json?v=11');
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                this.questions = data.questions;
                this.shuffle();
                this.loaded = true;
                logTerminal(`Loaded ${this.questions.length} quiz questions.`, "info");
            } catch (err) {
                logTerminal(`Failed to load questions: ${err.message}`, "error");
                // Fallback to a single hardcoded question
                this.questions = [
                    { id: 0, cluster: "fallback", text: "Describe your favorite animal and explain what makes it special to you." }
                ];
                this.shuffle();
                this.loaded = true;
            }
        },

        shuffle() {
            // Fisher-Yates shuffle
            this.shuffled = [...this.questions];
            for (let i = this.shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.shuffled[i], this.shuffled[j]] = [this.shuffled[j], this.shuffled[i]];
            }
            this.currentIndex = 0;
        },

        currentQuestion() {
            if (this.currentIndex >= this.shuffled.length) {
                this.shuffle(); // Wrap around with new shuffle
            }
            return this.shuffled[this.currentIndex];
        },

        advance() {
            this.currentIndex++;
            this.totalAnswered++;
            if (this.currentIndex >= this.shuffled.length) {
                this.shuffle();
            }
        },

        showCurrentQuestion() {
            const q = this.currentQuestion();
            addChatBubble(q.text, false);
        }
    };

    // ================================================================
    // WASM Engine Bridge
    // ================================================================

    const Engine = {
        ready: false,
        ptr: null,
        mod: null,
        loadedGeneration: '',
        loadedManifestTokens: null,
        syncInFlight: false,
        syncQueued: false,

        _create: null,
        _loadState: null,
        _saveState: null,
        _onKey: null,
        _commit: null,
        _accept: null,
        _newSentence: null,
        _getDebug: null,
        _getSentence: null,
        _getBuffer: null,
        _getSuggestions: null,
        _destroy: null,

        async init() {
            logTerminal("Initializing WASM bridge...", "info");
            showNotification("Loading Webassembly codes.");

            if (typeof IntentSpiderModule !== 'function') {
                const type = typeof IntentSpiderModule;
                logTerminal(`IntentSpiderModule not found (type: ${type}) — running in demo mode.`, "error");
                showNotification(`Engine not found (Type: ${type}). Running in demo mode.`);
                return;
            }

            try {
                this.mod = await IntentSpiderModule({
                    print: (text) => logTerminal(text, "info"),
                    printErr: (text) => logTerminal(text, "error"),
                });

                this._create       = this.mod.cwrap('engine_create',        'number', []);
                this._loadState    = this.mod.cwrap('engine_load_state',    'number', ['number', 'string']);
                this._saveState    = this.mod.cwrap('engine_save_state',    'number', ['number', 'string']);
                this._normalizeTimestamps = this.mod.cwrap('engine_normalize_timestamps', null, ['number', 'number']);
                this._getTokensObserved = this.mod.cwrap('engine_get_tokens_observed', 'number', ['number']);
                this._onKey        = this.mod.cwrap('engine_on_key',        null,     ['number', 'number', 'number']);
                this._commit       = this.mod.cwrap('engine_commit',        'string', ['number', 'number']);
                this._accept       = this.mod.cwrap('engine_accept',        'string', ['number', 'number', 'number']);
                this._newSentence  = this.mod.cwrap('engine_new_sentence',  null,     ['number']);
                this._getDebug     = this.mod.cwrap('engine_get_debug',     'string', ['number']);
                this._getSentence  = this.mod.cwrap('engine_get_sentence',  'string', ['number']);
                this._getBuffer    = this.mod.cwrap('engine_get_buffer',    'string', ['number']);
                this._getSuggestions= this.mod.cwrap('engine_get_suggestions','string',['number']);
                this._destroy      = this.mod.cwrap('engine_destroy',       null,     ['number']);
                // Transient state bindings (for global user heated state)
                // Wrapped in try/catch for backward compatibility with older WASM builds
                try {
                    this._saveTransient = this.mod.cwrap('engine_save_transient', 'number', ['number', 'string']);
                    this._loadTransient = this.mod.cwrap('engine_load_transient', 'number', ['number', 'string']);
                } catch (e) {
                    logTerminal("Transient state functions not available in this WASM build.", "info");
                    this._saveTransient = null;
                    this._loadTransient = null;
                }

                logTerminal("WASM module loaded successfully.", "info");

                this.ptr = this._create();
                logTerminal(`Engine instance created (ptr=0x${this.ptr.toString(16)}).`, "info");

                // Try loading collective state from R2 first, fall back to local
                await this.loadCollectiveState();

                // If global user mode, also load the heated transient state
                if (isGlobalPerson) {
                    await this.loadTransientState();
                }

                this.ready = true;
                logTerminal("Data loaded. IntentSpider Engine Ready to Start. ", "predict");
                showNotification("Data loaded. IntentSpider Engine Ready to Start.");

            } catch (err) {
                logTerminal(`Error in loading function ${err.message}`, "error");
                logTerminal("Failed.", "error");
                showNotification(`Failed. ${err.message}`);
            }
        },

        async loadCollectiveState() {
            logTerminal("Fetching collective state manifest...", "info");
            try {
                // Fetch Manifest
                const manifestResp = await fetch(STATE_API_URL + '/manifest', {
                    method: 'GET',
                    headers: { 'X-API-Key': STATE_API_KEY },
                });

                if (manifestResp.status === 404) {
                    logTerminal("No collective state found — trying local fallback.", "info");
                    await this.loadLocalState();
                    return;
                }
                if (!manifestResp.ok) throw new Error(`HTTP ${manifestResp.status}`);

                const manifest = await manifestResp.json();
                const numChunks = manifest.chunks || 1;
                const isLegacy = manifest.legacy === true;
                this.loadedGeneration = manifest.generation || manifestResp.headers.get('X-State-Generation') || '';
                this.loadedManifestTokens = Number.isSafeInteger(manifest.tokensIndexed)
                    ? manifest.tokensIndexed
                    : (manifest.totalSize > 0 ? Math.floor(manifest.totalSize / 4) : null);
                
                logTerminal(`Manifest found: ${numChunks} chunks, ${(manifest.totalSize / 1024 / 1024).toFixed(2)} MB total. Downloading...`, "info");

                // Download the immutable chunks named by this exact manifest generation.
                const chunkPromises = [];
                for (let i = 0; i < numChunks; i++) {
                    const chunkParams = new URLSearchParams();
                    if (isLegacy) chunkParams.set('legacy', 'true');
                    if (this.loadedGeneration) chunkParams.set('generation', this.loadedGeneration);
                    const query = chunkParams.toString();
                    const chunkUrl = `${STATE_API_URL}/chunk/${i}${query ? `?${query}` : ''}`;
                    chunkPromises.push(fetch(chunkUrl, {
                        headers: { 'X-API-Key': STATE_API_KEY }
                    }).then(r => {
                        if (!r.ok) throw new Error(`Chunk ${i} failed`);
                        return r.arrayBuffer();
                    }));
                }

                const chunkBuffers = await Promise.all(chunkPromises);
                
                // Stitch chunks together
                const totalBuffer = new Uint8Array(manifest.totalSize);
                let offset = 0;
                for (let i = 0; i < chunkBuffers.length; i++) {
                    const chunk = new Uint8Array(chunkBuffers[i]);
                    if (offset + chunk.byteLength > totalBuffer.byteLength) {
                        throw new Error(`Chunk ${i} exceeds manifest size`);
                    }
                    totalBuffer.set(chunk, offset);
                    offset += chunk.byteLength;
                }
                if (offset !== manifest.totalSize) {
                    throw new Error(`State size mismatch: expected ${manifest.totalSize}, received ${offset}`);
                }

                logTerminal(`All chunks downloaded and stitched.`, "info");

                this.mod.FS.writeFile('/intentspider.state', totalBuffer);
                const ok = this._loadState(this.ptr, '/intentspider.state');
                if (ok) {
                    this._normalizeTimestamps(this.ptr, epochSeconds());
                    logTerminal("Collective state loaded into engine.", "predict");
                    this.showDebug();
                } else {
                    logTerminal("Collective state load failed — trying local fallback.", "error");
                    await this.loadLocalState();
                }
            } catch (err) {
                logTerminal(`Fetch failed: ${err.message} — trying local fallback.`, "error");
                await this.loadLocalState();
            }
        },

        async loadLocalState() {
            logTerminal("Fetching local state file...", "info");
            try {
                const response = await fetch('assets/intentspider.state');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = new Uint8Array(await response.arrayBuffer());
                logTerminal(`Local state file downloaded (${(data.length / 1048576).toFixed(1)} MB).`, "info");

                this.mod.FS.writeFile('/intentspider.state', data);
                const ok = this._loadState(this.ptr, '/intentspider.state');
                if (ok) {
                    this._normalizeTimestamps(this.ptr, epochSeconds());
                    this.loadedGeneration = '';
                    logTerminal("Local state loaded into engine.", "predict");
                    this.showDebug();
                } else {
                    logTerminal("engine_load_state returned failure.", "error");
                }
            } catch (err) {
                logTerminal(`Could not load local state: ${err.message}`, "error");
                logTerminal("Engine will start with empty state.", "error");
            }
        },

        async saveCollectiveState() {
            if (!this.ready) return;
            if (this.syncInFlight) {
                this.syncQueued = true;
                return;
            }

            this.syncInFlight = true;
            try {
                // Freeze the graph before any network await. Only global-person mode
                // owns the separate heated package; normal profiles must not overwrite it.
                const graphOk = this._saveState(this.ptr, '/intentspider_out.state');
                if (!graphOk) throw new Error('engine_save_state failed');

                let transientData = null;
                if (isGlobalPerson) {
                    const transientOk = this._saveTransient &&
                        this._saveTransient(this.ptr, '/transient_out.state');
                    if (!transientOk) throw new Error('engine_save_transient failed');
                    transientData = this.mod.FS.readFile('/transient_out.state');
                }

                const graphData = this.mod.FS.readFile('/intentspider_out.state');
                const generation = (crypto.randomUUID ? crypto.randomUUID() :
                    `${Date.now()}-${Math.random().toString(16).slice(2)}`);
                const CHUNK_SIZE = 10 * 1024 * 1024;
                const numChunks = Math.ceil(graphData.length / CHUNK_SIZE);
                const tokensIndexed = Math.max(0, Math.trunc(this._getTokensObserved(this.ptr)));

                logTerminal(`Uploading state (${(graphData.length / 1024 / 1024).toFixed(2)} MB) in ${numChunks} chunk(s)...`, "info");

                await Promise.all(Array.from({ length: numChunks }, (_, i) => {
                    const start = i * CHUNK_SIZE;
                    const chunkData = graphData.slice(start, Math.min(start + CHUNK_SIZE, graphData.length));
                    return fetch(`${STATE_API_URL}/chunk/${i}`, {
                        method: 'POST',
                        headers: {
                            'X-API-Key': STATE_API_KEY,
                            'X-State-Generation': generation,
                            'Content-Type': 'application/octet-stream',
                        },
                        body: chunkData,
                    }).then(resp => {
                        if (!resp.ok) throw new Error(`Chunk ${i} HTTP ${resp.status}`);
                    });
                }));

                // A global-person writer stages its exact paired heated package. For a
                // normal writer the Worker carries the existing package forward unchanged.
                if (isGlobalPerson) {
                    const transientResp = await fetch(`${STATE_API_URL}/transient`, {
                        method: 'POST',
                        headers: {
                            'X-API-Key': STATE_API_KEY,
                            'X-State-Generation': generation,
                            'Content-Type': 'application/octet-stream',
                        },
                        body: transientData,
                    });
                    if (!transientResp.ok) throw new Error(`Transient HTTP ${transientResp.status}`);
                }

                // The manifest is the atomic graph/person commit. A stale tab cannot
                // replace a newer snapshot because it must name what it originally read.
                const manifestResp = await fetch(`${STATE_API_URL}/manifest`, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': STATE_API_KEY,
                        'X-Expected-Generation': this.loadedGeneration,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        totalSize: graphData.length,
                        chunks: numChunks,
                        generation,
                        tokensIndexed,
                        updatesTransient: isGlobalPerson,
                    }),
                });

                if (manifestResp.status === 409) {
                    const conflict = await manifestResp.json().catch(() => ({}));
                    throw new Error(`state changed in another tab (${conflict.currentGeneration || 'new generation'}); refresh before taking over`);
                }
                if (!manifestResp.ok) throw new Error(`Manifest HTTP ${manifestResp.status}`);
                this.loadedGeneration = generation;

                logTerminal(`Graph and global-person state saved as generation ${generation.slice(0, 8)}.`, "predict");
            } catch (err) {
                logTerminal(`State sync error: ${err.message}`, "error");
            } finally {
                this.syncInFlight = false;
                if (this.syncQueued) {
                    this.syncQueued = false;
                    queueMicrotask(() => this.saveCollectiveState());
                }
            }
        },

        async loadTransientState() {
            if (!this._loadTransient) return;
            logTerminal("Loading global user transient (heated) state...", "info");
            try {
                const transientQuery = this.loadedGeneration
                    ? `?generation=${encodeURIComponent(this.loadedGeneration)}`
                    : '';
                const resp = await fetch(`${STATE_API_URL}/transient${transientQuery}`, {
                    method: 'GET',
                    headers: { 'X-API-Key': STATE_API_KEY },
                });
                if (resp.status === 404) {
                    logTerminal("No transient state found (fresh global session).", "info");
                    return;
                }
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const transientGeneration = resp.headers.get('X-State-Generation') || '';
                if (this.loadedGeneration && transientGeneration !== this.loadedGeneration) {
                    logTerminal("Transient state belongs to a different graph generation; skipped safely.", "info");
                    return;
                }

                const data = new Uint8Array(await resp.arrayBuffer());
                if (data.length === 0) return;
                this.mod.FS.writeFile('/transient.state', data);
                const ok = this._loadTransient(this.ptr, '/transient.state');
                if (!ok) {
                    logTerminal("Transient state file was invalid, starting fresh.", "info");
                    return;
                }

                const sentence = this._getSentence(this.ptr) || '';
                const buffer = this._getBuffer(this.ptr) || '';
                currentText = sentence + (sentence && buffer ? ' ' : '') + buffer;
                cursorPos = currentText.length;
                selectAll = false;
                updateDisplay();
                this.updateSuggestions(JSON.parse(this._getSuggestions(this.ptr) || '[]'));
                logTerminal(`Transient heated state loaded (${data.length} bytes).`, "predict");
            } catch (err) {
                logTerminal(`Transient state load skipped: ${err.message}`, "info");
            }
        },

        onKey(charCode) {
            if (!this.ready) return;
            const ts = epochSeconds();
            this._onKey(this.ptr, charCode, ts);
        },

        commit() {
            if (!this.ready) return null;
            const ts = epochSeconds();
            const json = this._commit(this.ptr, ts);
            try {
                const result = JSON.parse(json);
                this.updateSuggestions(result.suggestions);
                this.showDebugFromResult(result);
                return result;
            } catch (e) {
                logTerminal(`commit parse error: ${e.message}`, "error");
                return null;
            }
        },

        // Silent commit: rebuilds engine state without updating the UI suggestion bar.
        // Used exclusively during syncEngine replay to avoid spurious prediction display.
        commitSilent() {
            if (!this.ready) return null;
            const ts = epochSeconds();
            const json = this._commit(this.ptr, ts);
            try {
                return JSON.parse(json);
            } catch (e) {
                return null;
            }
        },

        acceptSuggestion(index) {
            if (!this.ready) return null;
            const ts = epochSeconds();
            const json = this._accept(this.ptr, index, ts);
            try {
                const result = JSON.parse(json);
                this.updateSuggestions(result.suggestions);
                this.showDebugFromResult(result);
                return result;
            } catch (e) {
                logTerminal(`accept parse error: ${e.message}`, "error");
                return null;
            }
        },

        newSentence() {
            if (!this.ready) {
                logTerminal("New sentence (demo mode).", "info");
                return;
            }
            this._newSentence(this.ptr);
            clearSuggestions();
            logTerminal("--- NEW SENTENCE ---", "predict");
            this.showDebug();
        },

        showDebug() {
            if (!this.ready) return;
            const json = this._getDebug(this.ptr);
            try {
                const d = JSON.parse(json);
                this.showDebugFromResult({ debug: d });
            } catch (e) { /* ignore */ }
        },

        showDebugFromResult(result) {
            if (!result || !result.debug) return;
            const d = result.debug;
            logTerminal(
                `[dbg] val'=${d.val_prime?.toFixed(3)} H=${d.entropy?.toFixed(3)} ` +
                `arousal=${d.arousal?.toFixed(3)} α_eff=${d.alpha_eff?.toFixed(3)} ` +
                `streak=${d.streak} prey=${d.prey} nodes=${d.graph_nodes} edges=${d.graph_edges} ` +
                `vocab=${d.vocabulary} ${d.gated ? 'GATED' : ''} ${d.shock ? 'SHOCK' : ''}`,
                "predict"
            );
            if (result.sentence) {
                logTerminal(`[sent] "${result.sentence}"`, "info");
            }
        },

        updateSuggestions(sugs) {
            for (let i = 0; i < 3; i++) {
                if (sugs && sugs[i]) {
                    suggestions[i].textContent = sugs[i].token;
                    suggestions[i].title = `Score: ${sugs[i].score?.toFixed(4)}`;
                } else {
                    suggestions[i].textContent = '';
                    suggestions[i].title = '';
                }
            }
        }
    };

    // ================================================================
    // Fallback mock predictions
    // ================================================================

    const MOCK_WORDS = [
        "the", "of", "and", "to", "a", "in", "is", "that", "it", "for",
        "was", "on", "are", "with", "as", "at", "be", "this", "have", "from"
    ];
    function mockPredict() {
        const shuffled = [...MOCK_WORDS].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3; i++) {
            suggestions[i].textContent = shuffled[i];
            suggestions[i].title = '';
        }
    }

    function clearSuggestions() {
        suggestions.forEach(s => { s.textContent = ''; s.title = ''; });
    }

    // ================================================================
    // Input handling
    // ================================================================

    // Track what the user has typed for the current answer (separate from currentText for display)
    let quizAnswerLine = "";
    let cursorPos = 0;
    let selectAll = false;

    function escapeHTML(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function updateDisplay() {
        if (selectAll) {
            inputDisplay.innerHTML = `<span style="background-color: #b3d4fc; color: black;">${escapeHTML(currentText) || '&nbsp;'}</span>`;
        } else {
            const left = currentText.substring(0, cursorPos);
            const right = currentText.substring(cursorPos);
            inputDisplay.innerHTML = `${escapeHTML(left)}<span class="cursor">|</span>${escapeHTML(right)}`;
        }
    }

    // handleKey: processes a single key event.
    // For normal typing (cursor at end), we use direct Engine.onKey/commit
    // exactly like the native terminal — each word is observed ONCE.
    // For editing in the middle (cursor not at end), we only update the text
    // visually without touching the engine, to avoid re-reinforcing the graph.
    function handleKey(key) {
        const atEnd = (cursorPos === currentText.length);

        if (selectAll && key !== 'shift') {
            // Clear everything: reset text, cursor, and engine
            currentText = "";
            cursorPos = 0;
            selectAll = false;
            if (Engine.ready) Engine.newSentence();
            clearSuggestions();
            updateDisplay();
            return;
        }

        if (key === 'backspace') {
            if (cursorPos > 0) {
                currentText = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                cursorPos--;
                if (atEnd) {
                    Engine.onKey(8);
                    clearSuggestions();
                }
            }
        } else if (key === 'space') {
            if (currentText.length >= CHAR_LIMIT) return;
            currentText = currentText.substring(0, cursorPos) + ' ' + currentText.substring(cursorPos);
            cursorPos++;
            if (atEnd) {
                Engine.onKey(32);
                if (!Engine.ready) {
                    mockPredict();
                } else {
                    Engine.commit();
                }
            }
        } else if (key === 'enter') {
            submitAnswer();
        } else if (key === 'shift') {
            // Mottie Keyboard handles layout switching internally
        } else {
            if (currentText.length >= CHAR_LIMIT) return;
            currentText = currentText.substring(0, cursorPos) + key + currentText.substring(cursorPos);
            cursorPos++;
            if (atEnd) {
                Engine.onKey(key.charCodeAt(0));
            }
        }
        updateDisplay();
    }

    function submitAnswer() {
        const text = currentText.trim();
        if (text === '') return;
        if (!Engine.ready) return; // Wait until ready

        Engine.onKey(32);
        Engine.commit();
        addChatBubble(text, true);
        logTerminal(`Answer: "${text}"`, "info");

        currentText = "";
        cursorPos = 0;
        selectAll = false;
        updateDisplay();
        clearSuggestions();
        Engine.newSentence();

        Quiz.advance();
        Quiz.showCurrentQuestion();
    }

    // ================================================================
    // Mottie Virtual Keyboard
    // ================================================================

    const mottieInput = $('#mottie-hidden-input');
    mottieInput.keyboard({
        alwaysOpen: true,
        usePreview: false,
        appendTo: '#mottie-keyboard-container',
        layout: 'custom',
        customLayout: {
            'normal': [
                'q w e r t y u i o p',
                'a s d f g h j k l',
                '{shift} z x c v b n m {bksp}',
                '{space} {enter}'
            ],
            'shift': [
                'Q W E R T Y U I O P',
                'A S D F G H J K L',
                '{shift} Z X C V B N M {bksp}',
                '{space} {enter}'
            ]
        },
        display: {
            'bksp': 'Del',
            'enter': 'Send 💬',
            'shift': 'Shift',
            'space': 'Space'
        }
    }).on('keyboardChange', function(e, keyboard, el) {
        let key = keyboard.last.key;
        if (!key) return;
        
        if (key === 'space') key = 'space';
        else if (key === 'accept' || key === 'enter') key = 'enter';
        else if (key === 'bksp') key = 'backspace';
        else if (key === 'shift') key = 'shift';
        
        handleKey(key);
    });

    // ================================================================
    // Physical Keyboard Integration
    // ================================================================

    document.getElementById('input-display').tabIndex = 0;
    
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyA') {
                e.preventDefault();
                selectAll = true;
                updateDisplay();
                return;
            }
            if (e.code === 'KeyX' || e.code === 'Backspace' || e.code === 'Delete') {
                if (selectAll) {
                    if (e.code === 'KeyX') navigator.clipboard.writeText(currentText);
                    e.preventDefault();
                    selectAll = false;
                    currentText = '';
                    cursorPos = 0;
                    if (Engine.ready) Engine.newSentence();
                    clearSuggestions();
                    updateDisplay();
                    return;
                }
            }
            if (e.code === 'KeyC') {
                if (selectAll) {
                    e.preventDefault();
                    navigator.clipboard.writeText(currentText);
                    return;
                }
            }
        }

        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            if (selectAll) {
                selectAll = false;
                cursorPos = 0;
            } else if (cursorPos > 0) {
                cursorPos--;
            }
            updateDisplay();
            return;
        }

        if (e.code === 'ArrowRight') {
            e.preventDefault();
            if (selectAll) {
                selectAll = false;
                cursorPos = currentText.length;
            } else if (cursorPos < currentText.length) {
                cursorPos++;
            }
            updateDisplay();
            return;
        }
        
        if (e.code === 'Delete') {
            e.preventDefault();
            if (selectAll) {
                selectAll = false;
                currentText = '';
                cursorPos = 0;
                if (Engine.ready) Engine.newSentence();
                clearSuggestions();
            } else if (cursorPos < currentText.length) {
                currentText = currentText.substring(0, cursorPos) + currentText.substring(cursorPos + 1);
                // Don't touch engine — visual edit only
            }
            updateDisplay();
            return;
        }

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            if (e.code === 'Enter') {
                e.preventDefault();
                handleKey('enter');
            }
            return;
        }

        let virtualKey = null;

        if (e.code === 'Space') {
            e.preventDefault();
            handleKey('space');
            virtualKey = 'space';
        } else if (e.code === 'Enter') {
            e.preventDefault();
            handleKey('enter');
            virtualKey = 'enter';
        } else if (e.code === 'Backspace') {
            e.preventDefault();
            handleKey('backspace');
            virtualKey = 'bksp';
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            handleKey(e.key);
            virtualKey = e.key.toLowerCase();
        } else if (e.key === 'Shift') {
            virtualKey = 'shift';
        }

        if (virtualKey) {
            const safeKey = virtualKey.replace(/[^a-zA-Z0-9]/g, '');
            let btn = $(`#mottie-keyboard-container .ui-keyboard-${safeKey}`);
            if (btn.length) {
                btn.addClass('ui-state-active ui-state-hover');
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        let virtualKey = null;
        if (e.code === 'Space') virtualKey = 'space';
        else if (e.code === 'Enter') virtualKey = 'enter';
        else if (e.code === 'Backspace') virtualKey = 'bksp';
        else if (e.key.length === 1) virtualKey = e.key.toLowerCase();
        else if (e.key === 'Shift') virtualKey = 'shift';

        if (virtualKey) {
            const safeKey = virtualKey.replace(/[^a-zA-Z0-9]/g, '');
            let btn = $(`#mottie-keyboard-container .ui-keyboard-${safeKey}`);
            if (btn.length) {
                btn.removeClass('ui-state-active ui-state-hover');
            }
        }
    });

    // ================================================================
    // Paste handler
    // ================================================================

    document.addEventListener('paste', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        let paste = (e.clipboardData || window.clipboardData).getData('text');
        for (let i = 0; i < paste.length; i++) {
            handleKey(paste[i]);
        }
    });

    // ================================================================
    // Suggestion Clicks
    // ================================================================

    suggestions.forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const word = btn.textContent;
            if (word === '' || word === '—') return;

            if (Engine.ready) {
                // Use the proper C++ engine_accept() API.
                // This adds the accepted token to sent_ with exactly ONE reinforcement
                // event (selectionEvent), matching the native terminal behavior.
                // It also clears lastShown, so suggestions will be empty after this.
                const result = Engine.acceptSuggestion(idx + 1);
                if (result && result.sentence) {
                    currentText = result.sentence + ' ';
                    cursorPos = currentText.length;
                }
            } else {
                // Demo mode: manually append the suggestion word
                const words = currentText.trim().split(' ');
                if (words.length > 0 && words[words.length - 1] === '') words.pop();
                words.push(word);
                currentText = words.join(' ') + ' ';
                cursorPos = currentText.length;
                mockPredict();
            }

            selectAll = false;
            updateDisplay();

            const hiddenInput = document.getElementById('mottie-hidden-input');
            const displayInput = document.getElementById('input-display');
            if (hiddenInput) hiddenInput.focus();
            if (displayInput) displayInput.focus();
        });
    });

    // ================================================================
    // State Sync Timer
    // ================================================================

    let lastActivityTime = 0;
    let stateSyncTimer = null;

    function trackActivity() {
        lastActivityTime = Date.now();
    }

    function startStateSyncTimer() {
        if (stateSyncTimer) return;
        stateSyncTimer = setInterval(() => {
            // Only save if there was activity in the last interval
            if (Date.now() - lastActivityTime < STATE_SYNC_INTERVAL_MS * 2) {
                Engine.saveCollectiveState();
            }
        }, STATE_SYNC_INTERVAL_MS);
    }

    // Modern way to save on page exit
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && Engine.ready && lastActivityTime > 0) {
            // Because chunked uploads are async and large, visibilitychange is unreliable for saving.
            // We rely on the 10-second auto-save loop to guarantee integrity.
            // But we can trigger a best-effort save here if we want.
            Engine.saveCollectiveState();
        }
    });

    // ================================================================
    // Boot Sequence
    // ================================================================

    logTerminal("IntentSpider Webnet Playground v2.0", "info");
    logTerminal("Initializing...", "info");

    // Initialize chat interface
    initChatInterface();

    // Boot everything
    setTimeout(async () => {
        // Load questions
        await Quiz.load();

        // Initialize engine
        await Engine.init();
        if (!Engine.ready) {
            mockPredict();
        }

        // Wait 3 seconds for the aesthetic loading screen
        setTimeout(() => {
            document.getElementById('chat-loading').style.display = 'none';
            const chatMsgs = document.getElementById('chat-messages');
            chatMsgs.style.display = 'flex';

            // Show first question
            Quiz.showCurrentQuestion();
        }, 3000);

        // Start state sync
        startStateSyncTimer();

        // Track activity on any keypress
        document.addEventListener('keydown', trackActivity);
        document.addEventListener('click', trackActivity);

    }, 500);

})();
