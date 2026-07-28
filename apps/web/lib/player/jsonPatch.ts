/**
 * Applies the RFC 6902 add/remove/replace subset produced by
 * `apps/api/app/storage/wire_codec.py`'s `diff_json` (docs/PRD.md §3.4,
 * Phase 6). Deliberately not a general JSON Patch library — move/copy/test
 * are never emitted by the encoder, so they're not supported here either;
 * see that module's docstring for why add/remove/replace is the whole
 * vocabulary. Mirrors `wire_codec.py`'s `apply_json_patch` op-for-op so the
 * two can be tested against the same fixtures for parity.
 */

export interface JsonPatchOp {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

function unescapeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Mutates and returns `document` — callers pass a value they already own
 * (getStateAt.ts clones the previous keyframe/step's heap once per
 * reconstruction walk, not once per patch op). */
export function applyJsonPatch<T>(document: T, patch: readonly JsonPatchOp[]): T {
  for (const op of patch) {
    const tokens = op.path.split("/").slice(1).map(unescapeToken);
    applyOne(document as unknown as Record<string, unknown> | unknown[], tokens, op);
  }
  return document;
}

function applyOne(root: Record<string, unknown> | unknown[], tokens: string[], op: JsonPatchOp): void {
  let container: Record<string, unknown> | unknown[] = root;
  for (const token of tokens.slice(0, -1)) {
    container = (Array.isArray(container) ? container[Number(token)] : container[token]) as
      | Record<string, unknown>
      | unknown[];
  }

  const last = tokens[tokens.length - 1]!;
  if (Array.isArray(container)) {
    const index = last === "-" ? container.length : Number(last);
    if (op.op === "add") {
      container.splice(index, 0, op.value);
    } else if (op.op === "remove") {
      container.splice(index, 1);
    } else {
      container[index] = op.value;
    }
  } else {
    if (op.op === "add" || op.op === "replace") {
      container[last] = op.value;
    } else {
      delete container[last];
    }
  }
}
