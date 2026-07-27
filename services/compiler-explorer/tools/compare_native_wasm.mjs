#!/usr/bin/env node
// Runs the native `--emit=all` CLI and the WASM `compile()` export over
// every example program and diffs the two outputs byte-for-byte. This is
// the "native and WASM produce byte-identical output for the ten example
// programs" check from the Track B brief, wired into CI as a dedicated
// step (see .github/workflows/ci.yml's `compiler-explorer` job).
//
// Usage:
//   node tools/compare_native_wasm.mjs \
//     --native build/oocc_compiler[.exe] \
//     --wasm build-wasm/oocc_compiler.js \
//     [--examples examples]
//
// Exit code 0 iff every example's native and WASM output matches after
// normalization (see normalize() below for exactly what's normalized and
// why -- it is deliberately narrow).

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { native: null, wasm: null, examples: "examples" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--native") args.native = argv[++i];
    else if (argv[i] === "--wasm") args.wasm = argv[++i];
    else if (argv[i] === "--examples") args.examples = argv[++i];
  }
  if (!args.native || !args.wasm) {
    console.error(
      "usage: compare_native_wasm.mjs --native <path> --wasm <oocc_compiler.js> [--examples <dir>]"
    );
    process.exit(2);
  }
  return args;
}

// The native CLI writes its JSON via `std::cout << ... << std::endl`,
// which appends a trailing "\n" that the WASM `compile()` string (a bare
// return value) never has. That is the *only* normalization applied --
// everything else (field order, number formatting, whitespace inside the
// JSON) must already match exactly, because both paths call the same
// oocc::run_pipeline() (see include/oocc_compiler/pipeline.hpp).
function normalize(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

async function loadWasmModule(wasmJsPath) {
  const factory = (await import(pathToFileURL(resolve(wasmJsPath)).href)).default;
  return factory();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const exampleDir = resolve(args.examples);
  const files = readdirSync(exampleDir)
    .filter((f) => f.endsWith(".ooc"))
    .sort();

  if (files.length === 0) {
    console.error(`no .ooc files found in ${exampleDir}`);
    process.exit(2);
  }

  const Module = await loadWasmModule(args.wasm);

  let failures = 0;
  for (const file of files) {
    const path = join(exampleDir, file);
    const source = readFileSync(path, "utf8");

    let nativeOut;
    try {
      nativeOut = execFileSync(resolve(args.native), ["--emit=all", path], {
        encoding: "utf8",
      });
    } catch (e) {
      // A nonzero exit (e.g. the deliberate parse-error example) still
      // prints the JSON to stdout; execFileSync throws but still
      // captures stdout on the error object.
      nativeOut = e.stdout ?? "";
    }

    const wasmOut = Module.compile(source, "all");

    const a = normalize(nativeOut);
    const b = normalize(wasmOut);

    if (a === b) {
      console.log(`OK    ${basename(file)}`);
    } else {
      failures++;
      console.error(`MISMATCH ${basename(file)}`);
      const aLines = a.split("\n");
      const bLines = b.split("\n");
      const max = Math.max(aLines.length, bLines.length);
      for (let i = 0; i < max; i++) {
        if (aLines[i] !== bLines[i]) {
          console.error(`  line ${i + 1}:`);
          console.error(`    native: ${aLines[i]}`);
          console.error(`    wasm:   ${bLines[i]}`);
          break;
        }
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures}/${files.length} example(s) mismatched.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} examples match byte-for-byte (native == wasm).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
