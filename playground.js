// playground.js — IntentSpider Webnet Playground v2.0
// Xterm.js quiz terminal + Mottie keyboard + WASM engine + Cloudflare R2 state sync.

(() => {
    "use strict";

    // ================================================================
    // Configuration
    // ================================================================

    const STATE_API_URL = 'https://projectsapis.nekshadesilva.com/state';
    const STATE_API_KEY = 'REPLACE_WITH_YOUR_API_KEY'; // Set this to match your Cloudflare Worker env var
    const STATE_SYNC_INTERVAL_MS = 60000; // Save state every 60 seconds of activity
    const CHAR_LIMIT = 200;

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
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // Quiz Terminal (white terminal inside phone screen)
    // ================================================================

    let quizTerm = null;
    let quizFitAddon = null;

    function initQuizTerminal() {
        if (typeof Terminal === 'undefined') return;

        quizTerm = new Terminal({
            theme: {
                background: '#FFFFFF',
                foreground: '#000000',
                cursor: '#0031A7',
                cursorAccent: '#FFFFFF',
                selectionBackground: 'rgba(0, 49, 167, 0.3)',
            },
            fontFamily: '"Courier New", monospace',
            fontSize: 11,
            convertEol: true,
            disableStdin: true, // We handle input ourselves
            cursorBlink: false,
            scrollback: 1000,
            wordWrap: true,
        });

        // Fit addon to auto-resize to container
        if (typeof FitAddon !== 'undefined') {
            quizFitAddon = new FitAddon.FitAddon();
            quizTerm.loadAddon(quizFitAddon);
        }

        quizTerm.open(quizContainer);

        if (quizFitAddon) {
            setTimeout(() => quizFitAddon.fit(), 100);
            // Refit on window resize
            window.addEventListener('resize', () => {
                if (quizFitAddon) quizFitAddon.fit();
            });
        }

        // Welcome message
        quizTerm.writeln('\x1b[1;34m╔══════════════════════════╗\x1b[0m');
        quizTerm.writeln('\x1b[1;34m║  IntentSpider Quiz v2.0  ║\x1b[0m');
        quizTerm.writeln('\x1b[1;34m╚══════════════════════════╝\x1b[0m');
        quizTerm.writeln('');
        quizTerm.writeln('Type your answer below and');
        quizTerm.writeln('press \x1b[1mSend\x1b[0m to submit.');
        quizTerm.writeln('');
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
            if (!quizTerm) return;
            const q = this.currentQuestion();
            const num = this.totalAnswered + 1;
            quizTerm.writeln(`\x1b[1;34mQ${num}:\x1b[0m ${q.text}`);
            quizTerm.writeln('');
            quizTerm.write('\x1b[32m> \x1b[0m'); // Green prompt
        }
    };

    // ================================================================
    // WASM Engine Bridge
    // ================================================================

    const Engine = {
        ready: false,
        ptr: null,
        mod: null,

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
            showNotification("Initializing WASM Engine...");

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

                this.ptr = this._create();
                logTerminal(`Engine instance created (ptr=0x${this.ptr.toString(16)}).`, "info");

                // Try loading collective state from R2 first, fall back to local
                await this.loadCollectiveState();

                this.ready = true;
                logTerminal("Engine is LIVE — type to predict.", "predict");
                showNotification("Engine is LIVE — type to predict.");

            } catch (err) {
                logTerminal(`WASM init failed: ${err.message}`, "error");
                logTerminal("Falling back to demo mode.", "error");
                showNotification(`ERR: WASM failed: ${err.message}`);
            }
        },

        async loadCollectiveState() {
            logTerminal("Fetching collective state from R2...", "info");
            try {
                const resp = await fetch(STATE_API_URL, {
                    method: 'GET',
                    headers: { 'X-API-Key': STATE_API_KEY },
                });

                if (resp.status === 404) {
                    logTerminal("No collective state found — trying local fallback.", "info");
                    await this.loadLocalState();
                    return;
                }

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const data = new Uint8Array(await resp.arrayBuffer());
                logTerminal(`Collective state downloaded (${(data.length / 1024).toFixed(1)} KB).`, "info");

                this.mod.FS.writeFile('/intentspider.state', data);
                const ok = this._loadState(this.ptr, '/intentspider.state');
                if (ok) {
                    logTerminal("Collective state loaded into engine.", "predict");
                    this.showDebug();
                } else {
                    logTerminal("Collective state load failed — trying local fallback.", "error");
                    await this.loadLocalState();
                }
            } catch (err) {
                logTerminal(`R2 fetch failed: ${err.message} — trying local fallback.`, "error");
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
            try {
                // Save to virtual FS
                const ok = this._saveState(this.ptr, '/intentspider_out.state');
                if (!ok) {
                    logTerminal("engine_save_state failed.", "error");
                    return;
                }

                // Read from virtual FS
                const data = this.mod.FS.readFile('/intentspider_out.state');
                logTerminal(`Uploading state (${(data.length / 1024).toFixed(1)} KB) to R2...`, "info");

                const resp = await fetch(STATE_API_URL, {
                    method: 'POST',
                    headers: {
                        'X-API-Key': STATE_API_KEY,
                        'Content-Type': 'application/octet-stream',
                    },
                    body: data,
                });

                if (resp.ok) {
                    const result = await resp.json();
                    logTerminal(`State saved to R2 (${result.size} bytes).`, "predict");
                } else {
                    logTerminal(`R2 save failed: HTTP ${resp.status}`, "error");
                }
            } catch (err) {
                logTerminal(`State sync error: ${err.message}`, "error");
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
        suggestions.forEach(s => { s.textContent = '—'; s.title = ''; });
    }

    // ================================================================
    // Input handling
    // ================================================================

    // Track what the user has typed for the current answer (separate from currentText for display)
    let quizAnswerLine = "";

    function updateDisplay() {
        inputDisplay.textContent = currentText;
    }

    function handleKey(key) {
        if (key === 'backspace') {
            if (currentText.length > 0) {
                currentText = currentText.slice(0, -1);
                quizAnswerLine = quizAnswerLine.slice(0, -1);
                Engine.onKey(8);
                // Erase character in quiz terminal
                if (quizTerm) quizTerm.write('\b \b');
            }
        } else if (key === 'space') {
            if (currentText.length >= CHAR_LIMIT) return;
            currentText += ' ';
            quizAnswerLine += ' ';
            Engine.onKey(32);

            if (!Engine.ready) {
                mockPredict();
                logTerminal(`Word committed: "${currentText.trim().split(' ').pop()}"`, "info");
            } else {
                Engine.commit();
            }
            // Echo to quiz terminal
            if (quizTerm) quizTerm.write(' ');
        } else if (key === 'enter') {
            submitAnswer();
        } else if (key === 'shift') {
            // Mottie Keyboard handles layout switching internally
        } else {
            if (currentText.length >= CHAR_LIMIT) return;
            let ch = key;
            currentText += ch;
            quizAnswerLine += ch;
            Engine.onKey(ch.charCodeAt(0));
            if (!Engine.ready) {
                logTerminal(`Key: '${ch}' (0x${ch.charCodeAt(0).toString(16)})`, "info");
            }
            // Echo to quiz terminal
            if (quizTerm) quizTerm.write(ch);
        }
        updateDisplay();
    }

    function submitAnswer() {
        const text = currentText.trim();
        if (text === '') return;

        // Commit any pending word to the engine
        Engine.onKey(32);
        Engine.commit();

        // Log the answer in the quiz terminal
        if (quizTerm) {
            quizTerm.writeln(''); // Newline after the answer
            quizTerm.writeln(`\x1b[90m[Answer recorded]\x1b[0m`);
            quizTerm.writeln('');
        }

        logTerminal(`Answer: "${text}"`, "info");

        // Reset for next question
        currentText = "";
        quizAnswerLine = "";
        updateDisplay();
        clearSuggestions();
        Engine.newSentence();

        // Advance to next question
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
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') return;

        // Native shortcut support
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyA') {
                e.preventDefault();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(document.getElementById('input-display'));
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            } else if (e.code === 'KeyX' || e.code === 'Backspace') {
                const selection = window.getSelection();
                if (selection.toString().trim().length > 0) {
                    if (e.code === 'KeyX') navigator.clipboard.writeText(selection.toString());
                    currentText = "";
                    quizAnswerLine = "";
                    Engine.newSentence();
                    updateDisplay();
                    e.preventDefault();
                    return;
                }
            } else if (e.code === 'KeyC') {
                return;
            } else if (e.code === 'KeyV') {
                return;
            }
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
        btn.addEventListener('click', () => {
            const word = btn.textContent;
            if (word === '—') return;

            if (Engine.ready) {
                const result = Engine.acceptSuggestion(idx + 1);
                if (result && result.sentence) {
                    let newText = result.sentence + ' ';
                    if (newText.length > CHAR_LIMIT) newText = newText.substring(0, CHAR_LIMIT);

                    // Calculate what was appended
                    const added = newText.substring(currentText.length);
                    currentText = newText;
                    quizAnswerLine += added;

                    // Echo the added text to quiz terminal
                    if (quizTerm && added) quizTerm.write(added);
                }
            } else {
                const words = currentText.trim().split(' ');
                if (words.length > 0 && words[words.length - 1] === '') words.pop();
                words.push(word);
                let newText = words.join(' ') + ' ';
                if (newText.length > CHAR_LIMIT) newText = newText.substring(0, CHAR_LIMIT);

                const added = newText.substring(currentText.length);
                currentText = newText;
                quizAnswerLine += added;
                mockPredict();

                if (quizTerm && added) quizTerm.write(added);
            }
            updateDisplay();
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

    // Save on page unload
    window.addEventListener('beforeunload', () => {
        if (Engine.ready && lastActivityTime > 0) {
            // Use sendBeacon for reliability during unload
            try {
                const ok = Engine._saveState(Engine.ptr, '/intentspider_out.state');
                if (ok) {
                    const data = Engine.mod.FS.readFile('/intentspider_out.state');
                    const blob = new Blob([data], { type: 'application/octet-stream' });

                    // sendBeacon doesn't support custom headers, so we fall back to sync XHR
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', STATE_API_URL, false); // synchronous
                    xhr.setRequestHeader('X-API-Key', STATE_API_KEY);
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.send(blob);
                }
            } catch (e) {
                // Best effort — page is closing
            }
        }
    });

    // ================================================================
    // Boot Sequence
    // ================================================================

    logTerminal("IntentSpider Webnet Playground v2.0", "info");
    logTerminal("Initializing...", "info");

    // Initialize quiz terminal
    initQuizTerminal();

    // Boot everything
    setTimeout(async () => {
        // Load questions
        await Quiz.load();

        // Initialize engine
        await Engine.init();
        if (!Engine.ready) {
            mockPredict();
        }

        // Show first question
        Quiz.showCurrentQuestion();

        // Start state sync
        startStateSyncTimer();

        // Track activity on any keypress
        document.addEventListener('keydown', trackActivity);
        document.addEventListener('click', trackActivity);

    }, 500);

})();
