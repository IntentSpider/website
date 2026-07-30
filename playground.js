// playground.js — IntentSpider Webnet Playground
// Connects virtual/physical keyboard to the WASM engine via cwrap,
// with graceful fallback when the WASM binary isn't served.

(() => {
    "use strict";

    // ---- DOM handles ----
    const inputDisplay  = document.getElementById('input-display');
    const chatContent   = document.getElementById('chat-content');
    const terminalPanel = document.getElementById('terminal-panel');
    let term = null;
    if (typeof Terminal !== 'undefined') {
        term = new Terminal({
            theme: { background: '#000000', foreground: '#ffffff' },
            fontFamily: 'monospace',
            fontSize: 12,
            convertEol: true
        });
        term.open(terminalPanel);
        term.writeln('>> IntentSpider WASM Bridge Initializing...');
        term.writeln('>> Waiting for engine connection...');
    }

    const suggestions   = [
        document.getElementById('sug-1'),
        document.getElementById('sug-2'),
        document.getElementById('sug-3')
    ];

    const notificationBanner = document.getElementById('notification-banner');
    const notificationText = document.getElementById('notification-text');

    let currentText = "";
    let shiftActive = false;

    function showNotification(msg) {
        if (!notificationBanner) return;
        notificationText.textContent = msg;
        notificationBanner.style.display = 'flex';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            notificationBanner.style.display = 'none';
        }, 5000);
    }

    // ---- Terminal output ----
    function logTerminal(msg, type = "info") {
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
        const line = `[${ts}] ${msg}`;
        if (term) {
            term.writeln(line);
        } else {
            console.log(line);
        }
    }

    // ---- WASM Engine Bridge ----
    const Engine = {
        ready: false,
        ptr: null,      // opaque WasmEngine*
        mod: null,      // Emscripten Module instance

        // cwrap'd functions (set after Module init)
        _create: null,
        _loadState: null,
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
            showNotification("Initializing WASM Engine...");

            if (typeof IntentSpiderModule !== 'function') {
                const type = typeof IntentSpiderModule;
                logTerminal(`IntentSpiderModule not found (type: ${type}) — running in demo mode.`, "error");
                showNotification(`Engine not found (Type: ${type}). Running in demo mode.`);
                return;
            }

            try {
                this.mod = await IntentSpiderModule({
                    // Print/printErr go to terminal
                    print: (text) => logTerminal(text, "info"),
                    printErr: (text) => logTerminal(text, "error"),
                });

                // Wrap all exported C functions
                this._create       = this.mod.cwrap('engine_create',        'number', []);
                this._loadState    = this.mod.cwrap('engine_load_state',    'number', ['number', 'string']);
                this._onKey        = this.mod.cwrap('engine_on_key',        null,     ['number', 'number', 'number']);
                this._commit       = this.mod.cwrap('engine_commit',        'string', ['number', 'number']);
                this._accept       = this.mod.cwrap('engine_accept',        'string', ['number', 'number', 'number']);
                this._newSentence  = this.mod.cwrap('engine_new_sentence',  null,     ['number']);
                this._getDebug     = this.mod.cwrap('engine_get_debug',     'string', ['number']);
                this._getSentence  = this.mod.cwrap('engine_get_sentence',  'string', ['number']);
                this._getBuffer    = this.mod.cwrap('engine_get_buffer',    'string', ['number']);
                this._getSuggestions= this.mod.cwrap('engine_get_suggestions','string',['number']);
                this._destroy      = this.mod.cwrap('engine_destroy',       null,     ['number']);

                logTerminal("WASM module loaded successfully.", "info");

                // Create engine instance
                this.ptr = this._create();
                logTerminal(`Engine instance created (ptr=0x${this.ptr.toString(16)}).`, "info");

                // Load the state file
                await this.loadStateFile();

                this.ready = true;
                logTerminal("Engine is LIVE — type to predict.", "predict");
                showNotification("Engine is LIVE — type to predict.");

            } catch (err) {
                logTerminal(`WASM init failed: ${err.message}`, "error");
                logTerminal("Falling back to demo mode.", "error");
                showNotification(`ERR: WASM failed: ${err.message}`);
            }
        },

        async loadStateFile() {
            logTerminal("Fetching intentspider.state (~8.5 MB)...", "info");
            try {
                const response = await fetch('assets/intentspider.state');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = new Uint8Array(await response.arrayBuffer());
                logTerminal(`State file downloaded (${(data.length / 1048576).toFixed(1)} MB).`, "info");

                // Write into Emscripten's virtual filesystem
                this.mod.FS.writeFile('/intentspider.state', data);
                logTerminal("State file written to virtual FS.", "info");

                // Load via engine API
                const ok = this._loadState(this.ptr, '/intentspider.state');
                if (ok) {
                    logTerminal("State loaded into engine successfully.", "predict");
                    // Show initial debug
                    this.showDebug();
                } else {
                    logTerminal("engine_load_state returned failure.", "error");
                    showNotification("Failed to load state into engine.");
                }
            } catch (err) {
                logTerminal(`Could not load state: ${err.message}`, "error");
                logTerminal("Engine will start with empty state.", "error");
                showNotification("Could not load state file.");
            }
        },

        onKey(charCode) {
            if (!this.ready) return;
            const ts = performance.now() / 1000;
            this._onKey(this.ptr, charCode, ts);
        },

        commit() {
            if (!this.ready) return null;
            const ts = performance.now() / 1000;
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

        acceptSuggestion(index) {
            if (!this.ready) return null;
            const ts = performance.now() / 1000;
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
                    suggestions[i].textContent = '—';
                    suggestions[i].title = '';
                }
            }
        }
    };

    // ---- Fallback mock predictions ----
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
        suggestions.forEach(s => { s.textContent = '—'; s.title = ''; });
    }

    // ---- Input handling ----
    function updateDisplay() {
        inputDisplay.textContent = currentText;
    }

    function handleKey(key) {
        if (key === 'backspace') {
            if (currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                Engine.onKey(8); // backspace ASCII
            }
        } else if (key === 'space') {
            // Commit the current word
            Engine.onKey(32);
            if (!Engine.ready) {
                mockPredict();
                logTerminal(`Word committed: "${currentText.split(' ').pop()}"`, "info");
            }
            const result = Engine.commit();
            currentText += ' ';
        } else if (key === 'enter') {
            submitMessage();
        } else if (key === 'shift') {
            // Mottie Keyboard handles layout switching internally
        } else {
            let ch = key;
            currentText += ch;
            Engine.onKey(ch.charCodeAt(0));
            if (!Engine.ready) {
                logTerminal(`Key: '${ch}' (0x${ch.charCodeAt(0).toString(16)})`, "info");
            }
        }
        updateDisplay();
    }

    function submitMessage() {
        const text = currentText.trim();
        if (text === '') return;

        // Commit any pending word
        Engine.onKey(32);
        Engine.commit();

        // Add user message bubble
        const msg = document.createElement('div');
        msg.className = 'message-bubble user';
        msg.textContent = text;
        chatContent.appendChild(msg);
        chatContent.scrollTop = chatContent.scrollHeight;

        // Start new sentence
        currentText = "";
        updateDisplay();
        clearSuggestions();
        Engine.newSentence();

        // System response
        setTimeout(() => {
            const reply = document.createElement('div');
            reply.className = 'message-bubble system';
            reply.textContent = "Intent recognized.";
            chatContent.appendChild(reply);
            chatContent.scrollTop = chatContent.scrollHeight;
        }, 400);
    }

    // ---- Virtual Keyboard Events (Mottie Keyboard) ----
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
                '{space} {accept}'
            ],
            'shift': [
                'Q W E R T Y U I O P',
                'A S D F G H J K L',
                '{shift} Z X C V B N M {bksp}',
                '{space} {accept}'
            ]
        },
        display: {
            'bksp': 'Del',
            'accept': 'Enter',
            'shift': 'Shift',
            'space': 'Space'
        }
    });

    // Intercept clicks on Mottie keyboard buttons to feed into our engine pipeline
    $('#mottie-keyboard-container').on('mousedown', '.ui-keyboard-button', function(e) {
        let action = $(this).attr('data-action');
        let value = $(this).attr('data-value');
        
        let key = value || action;
        if (!key) return;
        
        if (key === 'space') key = 'space';
        else if (key === 'accept') key = 'enter';
        else if (key === 'bksp') key = 'backspace';
        else if (key === 'shift') key = 'shift';
        
        handleKey(key);
    });

    // ---- Physical Keyboard Integration ----
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            handleKey('space');
        } else if (e.code === 'Enter') {
            e.preventDefault();
            handleKey('enter');
        } else if (e.code === 'Backspace') {
            e.preventDefault();
            handleKey('backspace');
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            handleKey(e.key);
        }
    });

    // ---- Suggestion Clicks ----
    suggestions.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            const word = btn.textContent;
            if (word === '—') return;

            if (Engine.ready) {
                // Accept through the engine (1-based index)
                const result = Engine.acceptSuggestion(idx + 1);
                if (result && result.sentence) {
                    // Replace current text with the engine's sentence
                    currentText = result.sentence + ' ';
                }
            } else {
                // Demo mode: just append the word
                const words = currentText.trim().split(' ');
                if (words.length > 0 && words[words.length - 1] === '') words.pop();
                words.push(word);
                currentText = words.join(' ') + ' ';
                mockPredict();
            }
            updateDisplay();
        });
    });

    // ---- App Switcher ----
    document.getElementById('btn-chat').addEventListener('click', (e) => {
        document.querySelectorAll('.app-switcher button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chatContent.innerHTML = '<div class="message-bubble system">Hello! Type below to test the IntentSpider prediction engine.</div>';
        currentText = "";
        updateDisplay();
        Engine.newSentence();
    });

    document.getElementById('btn-search').addEventListener('click', (e) => {
        document.querySelectorAll('.app-switcher button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        chatContent.innerHTML = '<div class="message-bubble system">Search Intent mode active. Type your query.</div>';
        currentText = "";
        updateDisplay();
        Engine.newSentence();
    });

    // ---- Boot ----
    logTerminal("IntentSpider Webnet Playground v1.0", "info");
    logTerminal("Initializing...", "info");

    // Delay init slightly to let the DOM settle
    setTimeout(async () => {
        await Engine.init();
        if (!Engine.ready) {
            mockPredict();
        }
    }, 500);

})();
