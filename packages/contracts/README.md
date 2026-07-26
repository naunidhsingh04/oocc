# packages/contracts

⚠️ **Shared** — see `CLAUDE.md`. This package is append-only and versioned:
existing fields, enum members, and `$defs` must never be removed or
repurposed after release. Add new optional fields or enum members only, and
bump `schema_version`'s minor component in the same PR. Changing a field
silently breaks the other person's week.

## Source of truth

- `trace.schema.json` — the execution trace envelope (docs/PRD.md §3.1-3.3)
- `viz-plan.schema.json` — the panel plan (docs/PRD.md §4.3)

Both are JSON Schema draft 2020-12. Everything else in this package is
**generated** from them and must never be hand-edited:

```
python/src/oocc_contracts/generated/   Pydantic v2 models + a copy of the schema JSON
ts/src/generated/                      TypeScript types + a copy of the schema JSON
```

Generated output (including the copied schema JSON) **is committed**. That's
what lets CI catch drift: `pnpm gen:contracts:check` regenerates everything
into a clean checkout and fails the build on any diff, so a schema edit that
wasn't followed by regeneration is caught immediately instead of silently
shipping stale types.

## Regenerating

```sh
pnpm gen:contracts
```

Runs `packages/contracts/scripts/generate.mjs`, which projects both schemas
through `datamodel-code-generator` (Pydantic v2, `--use-annotated`) and
`json-schema-to-typescript`, then copies the schema JSON alongside each
language's generated code so the validators below never reach outside their
own package.

## Validators

Both languages export a validator that checks a raw payload against the
JSON Schema — not just the generated types — because the schema encodes
conditional rules (e.g. `error` required when `status` is `runtime_error`/
`compile_error`; `returned` present iff `event == "return"`) that the
generated Pydantic/TS types can't express on their own:

- Python: `oocc_contracts.validate_trace(data)` / `validate_viz_plan(data)`
  (raises `ContractValidationError`), backed by `jsonschema`.
- TypeScript: `validateTrace(data)` / `validateVizPlan(data)` from
  `@oocc/contracts` (throws `ContractValidationError`), backed by `ajv`.

## A schema/example reconciliation worth knowing about

docs/PRD.md §3.2's value-encoding rule says a JSON `null` is `{"val": null}`
and a Python `None` is `{"val": null, "repr": "None"}` — but the same
section's worked `TreeNode` example shows `"right": null` unwrapped. `Value`
accepts both forms (bare `null` or `{val}`/`{ref}`) to reconcile this; the
Python and TS generators always *emit* the wrapped form (`{"val": null,
"repr": "None"}`), never bare `null`, so this is a read-side accommodation
only.
