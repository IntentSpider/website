/**
 * IntentSpider Book Feeder
 * ========================
 * Paste this entire script into the browser DevTools console on the Playground page.
 * It will fetch public-domain books from Project Gutenberg and feed them into
 * the IntentSpider engine word-by-word, exactly as if a human were typing them.
 *
 * 
 * The engine learns graph structure (word associations) AND cadence/arousal patterns
 * from the simulated typing, making predictions dramatically richer.
 *
 * Usage:
 *   1. Open the Playground page in Chrome
 *   2. Open DevTools (F12) → Console tab
 *   3. Paste this entire script and press Enter
 *   4. Watch it type! It will process all books sequentially.
 *
 * To stop early: type  window.__BOOK_FEEDER_STOP = true  in the console.
 */

(async function IntentSpiderBookFeeder() {
    'use strict';

    // ================================================================
    // Book List — Project Gutenberg IDs
    // Add or remove books here. Each entry: { id, title }
    // Find more at: https://www.gutenberg.org/
    // ================================================================

    const DATASETS = [
        { path: "assets/dataset-another.txt", title: "Alice's Adventures in Wonderland — Lewis Carroll" }
        // Add more local datasets here if you download them
    ];

    // ================================================================
    // Timing Configuration
    // These simulate natural human typing with random variation.
    // Lower values = faster feeding (less realistic cadence).
    // ================================================================

    const CONFIG = {
        charDelayMin: 15,       // ms between characters (fast typist)
        charDelayMax: 45,       // ms between characters (slow typist)
        wordPauseMin: 40,       // ms pause after pressing space
        wordPauseMax: 150,      // ms pause after pressing space
        sentencePause: 300,     // ms pause between sentences (Enter → next)
        burstChance: 0.3,       // 30% chance of a "burst" (typing 2-4 words rapidly)
        burstCharDelay: 8,      // ms between chars during a burst
        burstWordPause: 15,     // ms between words during a burst
        progressEvery: 50,      // log progress every N sentences
        maxSentenceWords: 40,   // skip sentences longer than this (likely not real prose)
    };

    // ================================================================
    // Stop flag — set window.__BOOK_FEEDER_STOP = true to abort
    // ================================================================
    window.__BOOK_FEEDER_STOP = false;

    // ================================================================
    // Helpers
    // ================================================================

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Dispatch a synthetic keyboard event that the existing keydown listener will catch
    function pressKey(key, code, keyCode) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key, code, keyCode, which: keyCode,
            bubbles: true, cancelable: true, composed: true
        }));
        // Small delay then keyup
        setTimeout(() => {
            document.dispatchEvent(new KeyboardEvent('keyup', {
                key, code, keyCode, which: keyCode,
                bubbles: true, cancelable: true, composed: true
            }));
        }, 5);
    }

    function typeChar(ch) {
        const upper = ch.toUpperCase();
        const code = (upper >= 'A' && upper <= 'Z')
            ? 'Key' + upper
            : 'Digit' + ch;
        pressKey(ch, code, ch.charCodeAt(0));
    }

    function pressSpace() {
        pressKey(' ', 'Space', 32);
    }

    function pressEnter() {
        pressKey('Enter', 'Enter', 13);
    }

    // ================================================================
    // Fetch a local dataset
    // ================================================================

    async function fetchDataset(path) {
        // Fetch from the local path to avoid CORS issues entirely
        const resp = await fetch(path);
        if (resp.ok) {
            const text = await resp.text();
            if (text.length > 100) return text;
        }
        throw new Error(`Could not fetch dataset from ${path}`);
    }

    // ================================================================
    // Text Processing
    // ================================================================

    function cleanGutenbergText(text) {
        // Remove Project Gutenberg header
        const startMarkers = ['*** START OF THE PROJECT GUTENBERG', '*** START OF THIS PROJECT GUTENBERG'];
        for (const marker of startMarkers) {
            const idx = text.indexOf(marker);
            if (idx !== -1) {
                const lineEnd = text.indexOf('\n', idx);
                text = text.substring(lineEnd + 1);
                break;
            }
        }

        // Remove Project Gutenberg footer
        const endMarkers = ['*** END OF THE PROJECT GUTENBERG', '*** END OF THIS PROJECT GUTENBERG', 'End of the Project Gutenberg', 'End of Project Gutenberg'];
        for (const marker of endMarkers) {
            const idx = text.indexOf(marker);
            if (idx !== -1) {
                text = text.substring(0, idx);
                break;
            }
        }

        return text.trim();
    }

    function extractSentences(text) {
        // Normalize whitespace: collapse newlines and multiple spaces
        let normalized = text
            .replace(/\r\n/g, '\n')
            .replace(/\n{2,}/g, '\n')        // keep paragraph breaks as single newline
            .replace(/[ \t]+/g, ' ')          // collapse horizontal whitespace
            .replace(/\n /g, '\n')
            .replace(/ \n/g, '\n');

        // Split on sentence-ending punctuation followed by whitespace
        // This handles: "word. Next", "word! Next", "word? Next"
        const raw = normalized.split(/(?<=[.!?])\s+/);

        const sentences = [];
        for (const s of raw) {
            const cleaned = s.replace(/\n/g, ' ').trim();
            if (cleaned.length < 5) continue;                          // too short
            const words = cleaned.split(/\s+/).filter(w => w.length > 0);
            if (words.length < 2) continue;                            // need at least 2 words
            if (words.length > CONFIG.maxSentenceWords) continue;      // skip abnormally long
            // Only keep sentences with mostly ASCII printable characters
            const asciiRatio = cleaned.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127).length / cleaned.length;
            if (asciiRatio < 0.9) continue;
            sentences.push(words);
        }

        return sentences;
    }

    // ================================================================
    // Typing Simulation
    // ================================================================

    async function typeSentence(words) {
        if (window.__BOOK_FEEDER_STOP) return false;

        let w = 0;
        while (w < words.length) {
            if (window.__BOOK_FEEDER_STOP) return false;

            // Decide chunk size: usually 1 word, sometimes a burst of 2-4 words
            let chunkSize = 1;
            if (Math.random() < CONFIG.burstChance && w + 1 < words.length) {
                chunkSize = rand(2, Math.min(4, words.length - w));
            }

            const isBurst = chunkSize > 1;

            for (let c = 0; c < chunkSize && w < words.length; c++, w++) {
                const word = words[w];

                // Type each character of the word
                for (let i = 0; i < word.length; i++) {
                    const ch = word[i];
                    // Only type printable ASCII
                    if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
                        typeChar(ch);
                        const delay = isBurst
                            ? CONFIG.burstCharDelay
                            : rand(CONFIG.charDelayMin, CONFIG.charDelayMax);
                        await sleep(delay);
                    }
                }

                // Press space after word (except the very last word of the sentence)
                if (w < words.length - 1) {
                    pressSpace();
                    const pause = isBurst
                        ? CONFIG.burstWordPause
                        : rand(CONFIG.wordPauseMin, CONFIG.wordPauseMax);
                    await sleep(pause);
                }
            }
        }

        // Submit sentence with Enter
        pressEnter();
        await sleep(CONFIG.sentencePause);
        return true;
    }

    // ================================================================
    // Main Loop
    // ================================================================

    const style = 'font-size: 16px; font-weight: bold; color: #0031A7;';
    const styleGreen = 'font-size: 14px; color: #2e7d32;';
    const styleRed = 'font-size: 14px; color: #c62828;';
    const styleInfo = 'font-size: 12px; color: #555;';

    console.log('%c🕷️ IntentSpider Book Feeder', style);
    console.log('%cTo stop: window.__BOOK_FEEDER_STOP = true', styleInfo);
    console.log(`%cQueued ${DATASETS.length} datasets for processing.`, styleInfo);
    console.log('');

    let totalSentences = 0;
    let totalDatasets = 0;
    const startTime = Date.now();

    for (let b = 0; b < DATASETS.length; b++) {
        if (window.__BOOK_FEEDER_STOP) {
            console.log('%c⏹ Stopped by user.', styleRed);
            break;
        }

        const dataset = DATASETS[b];
        console.log(`%c📖 [${b + 1}/${DATASETS.length}] Fetching: ${dataset.title}...`, styleInfo);

        try {
            const raw = await fetchDataset(dataset.path);
            const clean = cleanGutenbergText(raw);
            const sentences = extractSentences(clean);

            console.log(`%c   Found ${sentences.length} sentences. Typing...`, styleInfo);

            let fed = 0;
            for (let s = 0; s < sentences.length; s++) {
                if (window.__BOOK_FEEDER_STOP) break;

                const ok = await typeSentence(sentences[s]);
                if (!ok) break;
                fed++;
                totalSentences++;

                if (fed % CONFIG.progressEvery === 0) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                    console.log(`%c   ⏳ ${fed}/${sentences.length} sentences (${elapsed}s elapsed, ${totalSentences} total)`, styleInfo);
                }
            }

            if (!window.__BOOK_FEEDER_STOP) {
                console.log(`%c   ✅ Finished: ${dataset.title} (${fed} sentences)`, styleGreen);
                totalDatasets++;
            }

        } catch (err) {
            console.log(`%c   ❌ Failed: ${dataset.title} — ${err.message}`, styleRed);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log(`%c🕷️ Book Feeder Complete`, style);
    console.log(`%c   Datasets: ${totalDatasets}/${DATASETS.length}`, styleGreen);
    console.log(`%c   Sentences: ${totalSentences}`, styleGreen);
    console.log(`%c   Time: ${totalTime}s`, styleGreen);
    console.log(`%c   The engine's graph is now significantly richer!`, styleGreen);

})();
