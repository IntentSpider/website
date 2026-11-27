# CMakeLists.txt for compiling IntentSpider to WebAssembly via Emscripten
#
# Usage:
#   cd wasm/build
#   emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
#   emmake make -j4
#
# Output: intentspider.js + intentspider.wasm in the build directory

cmake_minimum_required(VERSION 3.16)
project(intentspider_wasm CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Path to the C++ source files (3 levels up from wasm/)
set(ENGINE_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../version1/src")

# Verify source directory exists
if(NOT EXISTS "${ENGINE_SRC_DIR}/engine.cpp")
  message(FATAL_ERROR "Cannot find engine source. Expected at: ${ENGINE_SRC_DIR}")
endif()

message(STATUS "Engine source directory: ${ENGINE_SRC_DIR}")

add_executable(intentspider
  intentspider_api.cpp
  ${ENGINE_SRC_DIR}/engine.cpp
  ${ENGINE_SRC_DIR}/graph.cpp
  ${ENGINE_SRC_DIR}/diffusion.cpp
  ${ENGINE_SRC_DIR}/tokenizer.cpp
  ${ENGINE_SRC_DIR}/valence.cpp
  ${ENGINE_SRC_DIR}/arbitration.cpp
  ${ENGINE_SRC_DIR}/arousal.cpp
  ${ENGINE_SRC_DIR}/embedding.cpp
  # NOTE: terminal.cpp is intentionally excluded — replaced by the WASM API
)

target_include_directories(intentspider PRIVATE ${ENGINE_SRC_DIR})

# Emscripten-specific linker flags
set_target_properties(intentspider PROPERTIES
  SUFFIX ".js"
  LINK_FLAGS "\
    -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','stringToUTF8','lengthBytesUTF8'] \
    -s EXPORTED_FUNCTIONS=['_engine_create','_engine_load_state','_engine_save_state','_engine_on_key','_engine_commit','_engine_accept','_engine_new_sentence','_engine_get_debug','_engine_get_sentence','_engine_get_buffer','_engine_get_suggestions','_engine_destroy','_malloc','_free'] \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s MAXIMUM_MEMORY=268435456 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='IntentSpiderModule' \
    -s ENVIRONMENT='web' \
    -s FILESYSTEM=1 \
    -s FORCE_FILESYSTEM=1 \
    -O2 \
    --no-entry \
  "
)

# Ensure we compile with optimization
target_compile_options(intentspider PRIVATE -O2)
