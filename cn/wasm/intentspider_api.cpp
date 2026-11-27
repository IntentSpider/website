// intentspider_api.cpp
// Thin C wrapper around the IntentSpider Engine for WebAssembly export.
// Replaces the blocking terminal I/O loop (main.cpp) with an event-driven API
// that JavaScript can call per-keystroke.

#include <emscripten/emscripten.h>

#include <cstring>
#include <sstream>
#include <string>
#include <iomanip>
#include <vector>

// Include the engine directly - no terminal.h needed
#include "config.h"
#include "engine.h"
#include "tokenizer.h"

using namespace intentspider;

// ---- Persistent state visible to the exported C API ----

struct WasmEngine {
    Config cfg;
    Engine engine;
    std::string buf;                       // current typed buffer
    std::vector<Suggestion> lastShown;     // last prediction row
    bool debugMode = true;                 // always send debug info
    std::string lastJSON;                  // scratch buffer for returned strings
    std::string lastDebug;
    std::string lastSentence;

    WasmEngine() : engine(cfg) {}
};

// ---- JSON helpers ----

static std::string escapeJSON(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}

static std::string suggestionsToJSON(const WasmEngine* w) {
    std::ostringstream os;
    os << "[";
    for (size_t i = 0; i < w->lastShown.size(); ++i) {
        if (i > 0) os << ",";
        os << "{\"index\":" << (i + 1)
           << ",\"token\":\"" << escapeJSON(w->engine.tokenizer().text(w->lastShown[i].token)) << "\""
           << ",\"score\":" << std::fixed << std::setprecision(4) << w->lastShown[i].score
           << "}";
    }
    os << "]";
    return os.str();
}

static std::string debugToJSON(const WasmEngine* w) {
    const DebugInfo& d = w->engine.debug();
    std::ostringstream os;
    os << std::fixed << std::setprecision(4);
    os << "{";
    os << "\"val_prime\":" << d.val_prime;
    os << ",\"entropy\":" << d.entropy;
    os << ",\"h_norm\":" << d.h_norm;
    os << ",\"necessity\":" << d.necessity;
    os << ",\"arousal\":" << d.arousal;
    os << ",\"alpha_eff\":" << d.alpha_eff;
    os << ",\"streak\":" << d.streak;
    os << ",\"prey\":" << d.prey;
    os << ",\"substates\":" << d.substates;
    os << ",\"gated\":" << (d.gated ? "true" : "false");
    os << ",\"arbitrated\":" << (d.arbitrated ? "true" : "false");
    os << ",\"shock\":" << (d.shock ? "true" : "false");
    os << ",\"shock_window\":" << (d.shock_window ? "true" : "false");
    os << ",\"graph_nodes\":" << w->engine.graph().adjacency().size();

    // Count total edges
    size_t edgeCount = 0;
    for (const auto& [u, edges] : w->engine.graph().adjacency())
        edgeCount += edges.size();
    os << ",\"graph_edges\":" << edgeCount;

    os << ",\"vocabulary\":" << w->engine.tokenizer().size();
    os << ",\"sentence\":\"" << escapeJSON(w->engine.sentenceText()) << "\"";
    os << ",\"buffer\":\"" << escapeJSON(w->buf) << "\"";
    os << "}";
    return os.str();
}

// ---- Exported C API ----

extern "C" {

// Create a new engine instance. Returns an opaque pointer.
EMSCRIPTEN_KEEPALIVE
void* engine_create() {
    auto* w = new WasmEngine();
    return static_cast<void*>(w);
}

// Load state from a string buffer (the contents of intentspider.state).
// Returns 1 on success, 0 on failure.
EMSCRIPTEN_KEEPALIVE
int engine_load_state(void* ptr, const char* path) {
    auto* w = static_cast<WasmEngine*>(ptr);
    return w->engine.load(std::string(path)) ? 1 : 0;
}

// Save state to a file in the virtual filesystem.
// Returns 1 on success, 0 on failure.
EMSCRIPTEN_KEEPALIVE
int engine_save_state(void* ptr, const char* path) {
    auto* w = static_cast<WasmEngine*>(ptr);
    return w->engine.save(std::string(path)) ? 1 : 0;
}

// Feed a single keystroke. `key` is the ASCII char code.
// `timestamp` is performance.now()/1000 (seconds since page load).
// This updates cadence/arousal tracking.
EMSCRIPTEN_KEEPALIVE
void engine_on_key(void* ptr, int key, double timestamp) {
    auto* w = static_cast<WasmEngine*>(ptr);
    bool is_backspace = (key == 8 || key == 127);
    w->engine.onKey(timestamp, is_backspace);

    if (is_backspace) {
        if (!w->buf.empty()) {
            w->buf.pop_back();
            if (!w->lastShown.empty()) w->lastShown.clear();
        }
    } else if (key >= 32 && key < 127) {
        w->buf.push_back(static_cast<char>(key));
        if (!w->lastShown.empty()) w->lastShown.clear();
    }
}

// Process the current buffer as a word (called on space/enter).
// Tokenizes, observes, and runs prediction.
// Returns a JSON string with predictions.
EMSCRIPTEN_KEEPALIVE
const char* engine_commit(void* ptr, double timestamp) {
    auto* w = static_cast<WasmEngine*>(ptr);

    if (!w->buf.empty()) {
        auto toks = w->engine.tokenizer().tokenize(w->buf);
        w->buf.clear();
        if (!toks.empty()) {
            w->engine.observeTyped(toks, timestamp);
        }
    }

    if (!w->engine.sentence().empty()) {
        w->lastShown = w->engine.predict(timestamp);
    }

    // Build JSON response
    std::ostringstream os;
    os << "{\"suggestions\":" << suggestionsToJSON(w)
       << ",\"debug\":" << debugToJSON(w)
       << ",\"gated\":" << (w->engine.debug().gated ? "true" : "false")
       << ",\"sentence\":\"" << escapeJSON(w->engine.sentenceText()) << "\""
       << "}";
    w->lastJSON = os.str();
    return w->lastJSON.c_str();
}

// Accept a suggestion by index (1-based: 1, 2, or 3).
EMSCRIPTEN_KEEPALIVE
const char* engine_accept(void* ptr, int index, double timestamp) {
    auto* w = static_cast<WasmEngine*>(ptr);
    if (index >= 1 && index <= static_cast<int>(w->lastShown.size())) {
        w->engine.accept(w->lastShown[index - 1].token, timestamp);
        w->lastShown.clear();
    }

    // Return updated state
    std::ostringstream os;
    os << "{\"suggestions\":" << suggestionsToJSON(w)
       << ",\"debug\":" << debugToJSON(w)
       << ",\"sentence\":\"" << escapeJSON(w->engine.sentenceText()) << "\""
       << "}";
    w->lastJSON = os.str();
    return w->lastJSON.c_str();
}

// Start a new sentence (equivalent to :new command).
EMSCRIPTEN_KEEPALIVE
void engine_new_sentence(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    w->engine.clearSentence();
    w->lastShown.clear();
    w->buf.clear();
}

// Get current debug info as JSON.
EMSCRIPTEN_KEEPALIVE
const char* engine_get_debug(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    w->lastDebug = debugToJSON(w);
    return w->lastDebug.c_str();
}

// Get the current sentence text.
EMSCRIPTEN_KEEPALIVE
const char* engine_get_sentence(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    w->lastSentence = w->engine.sentenceText();
    return w->lastSentence.c_str();
}

// Get current buffer contents.
EMSCRIPTEN_KEEPALIVE
const char* engine_get_buffer(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    return w->buf.c_str();
}

// Get the current prediction suggestions as JSON array.
EMSCRIPTEN_KEEPALIVE
const char* engine_get_suggestions(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    w->lastJSON = suggestionsToJSON(w);
    return w->lastJSON.c_str();
}

// Destroy the engine instance.
EMSCRIPTEN_KEEPALIVE
void engine_destroy(void* ptr) {
    auto* w = static_cast<WasmEngine*>(ptr);
    delete w;
}

}  // extern "C"
