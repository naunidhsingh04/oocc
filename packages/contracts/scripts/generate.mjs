#!/usr/bin/env node
/**
 * pnpm gen:contracts — projects packages/contracts/{trace,viz-plan}.schema.json
 * into Pydantic v2 models (packages/contracts/python) and TypeScript types
 * (packages/contracts/ts). Run via `pnpm gen:contracts` from the repo root;
 * CI re-runs this and fails the build if the generated output is stale
 * (`pnpm gen:contracts:check`, a `git diff --exit-code` on the generated dirs).
 */
import { compileFromFile } from "json-schema-to-typescript";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(here, "..");
const repoRoot = resolve(contractsDir, "../..");

const SCHEMAS = [
  {
    name: "trace",
    schemaFile: "trace.schema.json",
    pyModule: "trace_model",
    // Simple pattern-constrained-string RootModels used as `dict[...]` keys
    // (locals/fields keyed by Identifier, heap keyed by HeapRef) need to be
    // hashable, which Pydantic v2 RootModels are not by default.
    frozenRootModels: ["HeapRef", "FrameId", "Identifier", "ChangedPath"],
  },
  {
    name: "viz_plan",
    schemaFile: "viz-plan.schema.json",
    pyModule: "viz_plan_model",
    frozenRootModels: ["PanelRole", "Binding"],
  },
  {
    name: "analysis",
    schemaFile: "analysis.schema.json",
    pyModule: "analysis_model",
  },
];

const GENERATED_HEADER = `/* eslint-disable */
/**
 * AUTO-GENERATED — do not hand-edit.
 * Source: packages/contracts/{{SCHEMA_FILE}}
 * Regenerate with \`pnpm gen:contracts\` from the repo root.
 */

`;

/**
 * json-schema-to-typescript emits a "This interface was referenced by
 * `X`'s JSON-Schema via the `definition` "Y"." aside on every named $def
 * (sometimes `X` is even literally "undefined" — a known cosmetic quirk).
 * It's pure backtrace clutter on top of our own descriptions. Strip it.
 */
function stripBackreferenceComments(source) {
  return source
    .replace(
      /\n \*\n \* This interface was referenced by `[^`]*`'s JSON-Schema\n \* via the `definition` "[^"]*"\.(?=\n \*\/)/g,
      "",
    )
    .replace(
      /\n \* This interface was referenced by `[^`]*`'s JSON-Schema\n \* via the `definition` "[^"]*"\.(?=\n \*\/)/g,
      "",
    )
    .replace(/\/\*\*\n \*\/\n/g, "");
}

async function generateTypeScript() {
  const outDir = resolve(contractsDir, "ts/src/generated");
  await mkdir(outDir, { recursive: true });

  for (const { name, schemaFile } of SCHEMAS) {
    const schemaPath = resolve(contractsDir, schemaFile);
    const ts = await compileFromFile(schemaPath, {
      unreachableDefinitions: true,
      additionalProperties: false,
      bannerComment: "",
      style: { singleQuote: false },
    });
    const header = GENERATED_HEADER.replace("{{SCHEMA_FILE}}", schemaFile);
    await writeFile(resolve(outDir, `${name}.ts`), header + stripBackreferenceComments(ts));
    console.log(`[gen:contracts] wrote ts/src/generated/${name}.ts`);
  }
}

/**
 * Insert `model_config = ConfigDict(frozen=True)` as the first line of each
 * named RootModel class body, so instances are hashable (Pydantic v2
 * RootModels aren't, by default — that breaks the moment one is used as a
 * `dict[...]` key, e.g. a non-empty Step.locals). Matches by class name up
 * to the first `\n):\n`, i.e. the closing of `class Name(\n  RootModel[...]\n):`,
 * which is distinctive enough not to appear inside the constr() pattern
 * strings these classes wrap.
 */
function freezeRootModels(source, names) {
  let result = source;
  for (const name of names) {
    const pattern = new RegExp(`(class ${name}\\([\\s\\S]*?\\):\\n)`);
    if (!pattern.test(result)) {
      throw new Error(`freezeRootModels: expected to find "class ${name}(...):" in generated output`);
    }
    result = result.replace(pattern, `$1    model_config = ConfigDict(frozen=True)\n`);
  }
  return result;
}

async function generatePython() {
  const outDir = resolve(contractsDir, "python/src/oocc_contracts/generated");
  await mkdir(outDir, { recursive: true });

  for (const { schemaFile, pyModule, frozenRootModels } of SCHEMAS) {
    const schemaPath = resolve(contractsDir, schemaFile);
    const outPath = resolve(outDir, `${pyModule}.py`);

    execFileSync(
      "uv",
      [
        "run",
        "--package",
        "oocc-contracts",
        "datamodel-codegen",
        "--input",
        schemaPath,
        "--input-file-type",
        "jsonschema",
        "--schema-version",
        "2020-12",
        "--output-model-type",
        "pydantic_v2.BaseModel",
        "--target-python-version",
        "3.12",
        "--use-standard-collections",
        "--use-union-operator",
        "--use-schema-description",
        "--use-title-as-name",
        // Annotated[str, StringConstraints(...)] instead of bare constr(...)
        // annotations — the latter is a runtime function call standing in
        // for a type, which mypy can never understand (not a pydantic.mypy
        // gap; this is the documented, mypy-compatible, forward path for
        // Pydantic v2, per datamodel-codegen's own --help).
        "--use-annotated",
        "--custom-file-header",
        [
          "# AUTO-GENERATED -- do not hand-edit.",
          `# Source: packages/contracts/${schemaFile}`,
          "# Regenerate with `pnpm gen:contracts` from the repo root.",
        ].join("\n"),
        "--output",
        outPath,
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );

    if (frozenRootModels?.length) {
      const generated = await readFile(outPath, "utf8");
      await writeFile(outPath, freezeRootModels(generated, frozenRootModels));
    }
    console.log(`[gen:contracts] wrote python/src/oocc_contracts/generated/${pyModule}.py`);
  }

  const initPath = resolve(outDir, "__init__.py");
  await writeFile(
    initPath,
    "# AUTO-GENERATED -- do not hand-edit.\n# Regenerate with `pnpm gen:contracts` from the repo root.\n",
  );
}

/**
 * Copy the canonical schema JSON alongside the generated code in both
 * languages, so each validator can load its schema from within its own
 * package (never reaching outside it) instead of walking parent directories.
 */
async function copySchemas() {
  const targets = [
    resolve(contractsDir, "ts/src/generated"),
    resolve(contractsDir, "python/src/oocc_contracts/generated"),
  ];

  for (const { schemaFile } of SCHEMAS) {
    const contents = await readFile(resolve(contractsDir, schemaFile), "utf8");
    for (const targetDir of targets) {
      await mkdir(targetDir, { recursive: true });
      await writeFile(resolve(targetDir, schemaFile), contents);
    }
  }
  console.log("[gen:contracts] copied schema JSON into ts/src/generated and python/.../generated");
}

async function main() {
  await generateTypeScript();
  await generatePython();
  await copySchemas();
  console.log("[gen:contracts] done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
