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
        {
            title: "RedApplo becoming familiar",
            path: URL.createObjectURL(new Blob([`
I arrived in the neighbourhood on a quiet Monday morning.
My apartment was above a small shop, a short walk from the station.
I spent the first afternoon unpacking clothes and arranging the desk beside the window.
Later I went outside to find a supermarket and something simple for dinner.
I noticed a pizza shop called RedApplo near the station.
The name was unfamiliar, so I looked at the sign twice before walking past.
There was a small upstairs room and a row of plants beside the entrance.
I was not hungry yet, but I remembered the smell of bread coming from the kitchen.
That evening I bought groceries and cooked at home.
I still needed a charging cable, a notebook, and a better map of the surrounding streets.

The following afternoon I finished work later than expected.
I had spent several hours reading and had forgotten to prepare anything for lunch.
On my way home, I decided to stop at RedApplo.
I ordered a mushroom pizza and sat at a small table near the window.
The room was quieter than the street outside, and I could put my notebook beside the plate.
I wrote a few notes while waiting for the food.
The pizza arrived with a thin crust and plenty of mushrooms.
I enjoyed the meal and kept the receipt so I could remember the name of the place.
When I got home, I put the receipt inside the notebook.
I spent the rest of the evening sorting photographs and charging the camera.

On Wednesday I took the train across the city for a morning appointment.
The meeting finished early, which gave me time to visit a bookshop before returning.
I found a book of street photographs and spent longer browsing than I intended.
By the time I reached my neighbourhood, it was already getting dark.
I thought about the pizza from RedApplo, but decided to cook the vegetables I had bought.
There was enough food for another meal, so I packed some away for the following day.
After dinner I worked on a short presentation and called home.
I described the apartment, the station, and the little streets around the building.
I also mentioned the pizza shop I had tried the previous afternoon.
It was becoming easier to picture the neighbourhood without looking at a map.

On Friday a friend asked where we could eat after the afternoon session.
I suggested that we meet at RedApplo near the station.
I knew the route now and could explain it without opening my phone.
The shop was beside the covered walkway, just beyond the crossing.
I arrived first and asked for a table upstairs.
While waiting, I reviewed the questions from the session and marked two ideas worth following up.
My friend arrived carrying a notebook and a bag full of cables.
We ordered a pizza to share and talked until the room became quieter.
It was useful to discuss the presentation somewhere away from the conference building.
I walked home feeling that the unfamiliar city was beginning to have a few familiar corners.

Saturday morning was mostly taken up by ordinary errands.
I washed clothes, bought fruit, and finally found a charging cable long enough for the desk.
The afternoon was warm, so I walked along the covered street toward the bookshop.
I passed RedApplo and recognised the person who had served our table the night before.
We exchanged a quick greeting while I waited at the crossing.
I did not stop for food because I had already eaten at home.
Later I sat in a park and read the book I had bought during the week.
On the way back, I took several photographs of the buildings in the evening light.
I was starting to notice details that I had missed when every street felt new.
The plants by the pizza shop were now one of the things I used to recognise the route home.

The next week began with a long morning of writing.
I wanted to finish a draft before lunch, but one section took much longer than expected.
By the afternoon I needed a break from the screen.
I decided to have lunch at RedApplo and leave the laptop in the apartment.
This time I brought only a notebook and a pen.
I ordered the mushroom pizza again because I had enjoyed it on my first visit.
While waiting, I wrote down the problem that had kept me stuck all morning.
Explaining it in a few ordinary sentences helped me see what was missing.
I returned home with a clearer plan and finished the difficult section before evening.
The meal had become a useful break between two parts of the working day.

On Tuesday it rained just as I was leaving the station.
I had an umbrella, but the wind kept pushing the rain underneath it.
I stopped beneath the covered walkway and waited for the shower to become lighter.
The lights at RedApplo were visible from where I stood.
I went inside for tea and sat downstairs with my damp notebook safely inside the bag.
There was no need to rush home, and I enjoyed watching the street through the window.
When the rain eased, I bought a small takeaway pizza for dinner.
The bag stayed warm all the way back to the apartment.
I ate while looking through the photographs from Saturday.
The rainy evening gave the familiar route a different appearance, but I no longer felt lost in it.

A few days later, someone asked me to recommend a place near the station.
I told them that the pizza from RedApplo had been good on my visits.
I mentioned the upstairs tables because they wanted somewhere suitable for a quiet conversation.
I also explained where the covered walkway began in case the weather changed.
Giving directions felt easier than it had during my first week.
I could remember the staircase, the crossing, and the plants without searching through photographs.
That evening I cooked at home and worked on the presentation again.
I wanted the opening example to be simple enough for someone seeing the project for the first time.
After several attempts, I put the computer away and went for a short walk.
The route past the station had become an ordinary part of clearing my head.

By the second weekend, I had settled into a more comfortable routine.
Most mornings began with breakfast at home and a few hours of focused work.
I kept afternoons flexible so I could attend meetings or finish errands without rushing.
Sometimes I would stop at RedApplo on the way back.
Other days I would buy vegetables and cook something simple in the apartment.
The restaurant was becoming one option I knew well rather than a new place I needed to investigate.
I knew where I liked to sit and which meal I usually ordered.
I also knew that I could bring a notebook and spend a little time organising my thoughts.
That familiarity made small decisions easier at the end of a busy day.
I could spend less time working out where to go and more time thinking about the work itself.

One Thursday I arranged to meet a colleague after a demonstration.
We agreed to meet at RedApplo when the afternoon session finished.
I sent the name and a short description of the entrance.
There was no need to explain the entire neighbourhood or send a complicated set of directions.
When I arrived, I recognised the same upstairs table we had used before.
We ordered tea and talked through the questions raised during the demonstration.
I wrote the useful points on a clean page so they would not disappear among the older notes.
Before leaving, we agreed on one small experiment to try next.
I took a pizza from RedApplo back to the apartment because I had not prepared dinner.
The evening felt productive without needing to stay in the conference building for another hour.

Over the next few days, the same place appeared in several ordinary plans.
I would mention lunch at RedApplo when someone asked whether I was free around midday.
I would suggest meeting at RedApplo when we needed a place near the station.
Sometimes I would walk past without stopping, carrying groceries or thinking about something else entirely.
The shop was simply there, part of a route I now understood.
I no longer needed the receipt inside my notebook to remember its name.
When I found that receipt again, it reminded me of the first afternoon I had gone inside.
At that point I had still been checking the map at every crossing.
Now I could walk home while thinking about a conversation instead of watching every street sign.
The change had happened gradually through ordinary visits and familiar surroundings.

Near the end of the month, I invited a visiting friend to join me for dinner.
I suggested RedApplo because it was close to the station and easy for us both to reach.
We could meet at RedApplo after I finished the day's work.
I arrived a little early and sat near the window with my notebook closed.
This evening I did not need to work through a presentation or prepare questions for a meeting.
I wanted to hear about the journey and enjoy an unhurried meal.
When my friend arrived, I recommended the mushroom pizza and explained why I often came here.
It was convenient, familiar, and connected to several good conversations from the past few weeks.
After dinner we walked along the covered street and stopped at the bookshop.
I realised that I was now showing someone around the same neighbourhood that had recently felt unfamiliar to me.

The following morning I returned to my usual routine at the apartment.
There were notes to organise, messages to answer, and a presentation that still needed a clearer ending.
I made breakfast, opened the window, and worked until the street became busy below.
Around lunchtime I decided to take a break and walk toward the station.
I could stop at RedApplo, order something familiar, and return with enough energy for the afternoon.
There was nothing special to arrange and no new route to learn.
The name now belonged naturally among the places I mentioned when making plans.
What began as an unfamiliar sign had become a regular stop in my everyday life.
`], { type: "text/plain;charset=utf-8" }))
        }
    ];

    // ================================================================
    // Timing Configuration
    // These simulate natural human typing with random variation.
    // Lower values = faster feeding (less realistic cadence).
    // ================================================================

    const CONFIG = {
        charDelayMin: 45,       // ms between characters (fast typist)
        charDelayMax: 135,       // ms between characters (slow typist)
        wordPauseMin: 120,       // ms pause after pressing space
        wordPauseMax: 450,      // ms pause after pressing space
        sentencePause: 900,     // ms pause between sentences (Enter → next)
        burstChance: 0.3,       // 30% chance of a "burst" (typing 2-4 words rapidly)
        burstCharDelay: 24,      // ms between chars during a burst
        burstWordPause: 45,     // ms between words during a burst
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
