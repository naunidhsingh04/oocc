#pragma once
#include <stdexcept>
#include <string>

#include "oocc_compiler/span.hpp"

namespace oocc {

// Stage that raised a structured error. Mirrors the three places the
// pipeline can fail: scanning characters, building the AST, and running
// the compiled bytecode.
enum class ErrorStage { Lex, Parse, Runtime };

inline const char* to_string(ErrorStage stage) {
    switch (stage) {
        case ErrorStage::Lex:
            return "LexError";
        case ErrorStage::Parse:
            return "ParseError";
        case ErrorStage::Runtime:
            return "RuntimeError";
    }
    return "Error";
}

// A structured, span-carrying failure. Every failure mode in this project
// (lex/parse/runtime) throws one of these instead of a bare message, so
// the CLI and WASM bindings can always report a source span alongside
// the text — never just a string, per the Track B brief's requirement
// that errors "carry a source span... not just a message string."
class OoccError : public std::runtime_error {
public:
    OoccError(ErrorStage stage, std::string message, Span span)
        : std::runtime_error(std::move(message)), stage_(stage), span_(span) {}

    ErrorStage stage() const { return stage_; }
    const Span& span() const { return span_; }
    const std::string& message() const {
        // std::runtime_error::what() already holds this; kept as a named
        // accessor for readability at call sites.
        static thread_local std::string cached;
        cached = what();
        return cached;
    }

private:
    ErrorStage stage_;
    Span span_;
};

}  // namespace oocc
