import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { Analysis } from "./generated/analysis";
import analysisSchema from "./generated/analysis.schema.json";
import type { Trace } from "./generated/trace";
import traceSchema from "./generated/trace.schema.json";
import type { VizPlan } from "./generated/viz_plan";
import vizPlanSchema from "./generated/viz-plan.schema.json";

// `strictRequired` is disabled because our `if`/`then` conditionals (e.g.
// "error" required when status is runtime_error/compile_error) reference a
// property declared on the parent schema rather than restated inside the
// `then` branch — valid JSON Schema (and this repo's Python validator,
// backed by the `jsonschema` package, accepts it under the same rules), but
// Ajv's strict mode flags it as an unusual pattern. Every other strict check
// stays on.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);

const validateTraceSchema = ajv.compile<Trace>(traceSchema);
const validateVizPlanSchema = ajv.compile<VizPlan>(vizPlanSchema);
const validateAnalysisSchema = ajv.compile<Analysis>(analysisSchema);

export class ContractValidationError extends Error {
  readonly schemaFilename: string;
  readonly errors: string[];

  constructor(schemaFilename: string, errors: string[]) {
    super(`${schemaFilename} failed schema validation:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    this.name = "ContractValidationError";
    this.schemaFilename = schemaFilename;
    this.errors = errors;
  }
}

/**
 * Validate a raw trace payload against trace.schema.json.
 *
 * Throws ContractValidationError on any schema violation, including the
 * conditional rules (e.g. `returned` present iff `event === "return"`) that
 * the generated Trace type alone does not enforce at compile time.
 */
export function validateTrace(data: unknown): Trace {
  if (!validateTraceSchema(data)) {
    throw new ContractValidationError(
      "trace.schema.json",
      (validateTraceSchema.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()),
    );
  }
  return data;
}

/** Validate a raw viz-plan payload against viz-plan.schema.json. */
export function validateVizPlan(data: unknown): VizPlan {
  if (!validateVizPlanSchema(data)) {
    throw new ContractValidationError(
      "viz-plan.schema.json",
      (validateVizPlanSchema.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()),
    );
  }
  return data;
}

/** Validate a raw analysis payload against analysis.schema.json. */
export function validateAnalysis(data: unknown): Analysis {
  if (!validateAnalysisSchema(data)) {
    throw new ContractValidationError(
      "analysis.schema.json",
      (validateAnalysisSchema.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim()),
    );
  }
  return data;
}
