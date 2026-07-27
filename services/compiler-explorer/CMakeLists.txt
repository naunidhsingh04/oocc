cmake_minimum_required(VERSION 3.16)
project(oocc_compiler_explorer CXX)

# Off in production. On by default here because this whole project only
# exists to be traced — a plain `cmake ..` for local dev should just work.
# A release build MUST configure with -DOOCC_TRACE=OFF; see README.md.
option(OOCC_TRACE
    "Emit JSON trace data (tokens/AST/bytecode/VM steps). OFF for release builds."
    ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE RelWithDebInfo)
endif()

# Core: lexer, parser, compiler, VM. trace.cpp/pipeline.cpp are listed here
# too, but their entire contents are wrapped in `#ifdef OOCC_TRACE` — with
# the option OFF they compile to empty translation units, so no JSON code
# is ever generated into this target's object files. That is the actual
# mechanism behind "OOCC_TRACE=OFF pays nothing," not just the CMake
# option existing.
add_library(oocc_compiler_core STATIC
    src/lexer.cpp
    src/parser.cpp
    src/value.cpp
    src/opcode.cpp
    src/compiler.cpp
    src/vm.cpp
    src/trace.cpp
    src/pipeline.cpp
)
target_include_directories(oocc_compiler_core PUBLIC include third_party)

if(OOCC_TRACE)
    target_compile_definitions(oocc_compiler_core PUBLIC OOCC_TRACE)
endif()

if(EMSCRIPTEN)
    # emcmake cmake .. && cmake --build .
    #
    # -fexceptions is load-bearing: Emscripten disables C++ exceptions by
    # default (for code size/speed), which would turn every `throw
    # OoccError(...)` in lexer/parser/vm into an abrupt abort() instead of
    # unwinding into pipeline.cpp's try/catch. Every lex/parse/runtime
    # error path depends on exceptions actually working.
    target_compile_options(oocc_compiler_core PUBLIC -fexceptions)

    add_executable(oocc_compiler_wasm wasm/bindings.cpp)
    target_link_libraries(oocc_compiler_wasm PRIVATE oocc_compiler_core)
    set_target_properties(oocc_compiler_wasm PROPERTIES OUTPUT_NAME "oocc_compiler")
    target_link_options(oocc_compiler_wasm PRIVATE
        "-fexceptions"
        "-lembind"
        "SHELL:-s MODULARIZE=1"
        "SHELL:-s EXPORT_NAME=OOCCCompiler"
        "SHELL:-s ENVIRONMENT=node"
        "SHELL:-s SINGLE_FILE=1"
        "SHELL:-s ALLOW_MEMORY_GROWTH=1"
    )
else()
    add_executable(oocc_compiler tools/main.cpp)
    target_link_libraries(oocc_compiler PRIVATE oocc_compiler_core)

    enable_testing()
    add_executable(oocc_compiler_tests
        tests/test_main.cpp
        tests/test_lexer.cpp
        tests/test_parser.cpp
        tests/test_compiler.cpp
        tests/test_vm.cpp
        tests/test_errors.cpp
    )
    target_link_libraries(oocc_compiler_tests PRIVATE oocc_compiler_core)
    add_test(NAME oocc_compiler_tests COMMAND oocc_compiler_tests)
endif()
