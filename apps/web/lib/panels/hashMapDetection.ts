import type { Trace } from "@oocc/contracts";
import { iterateResolvedSteps, type ResolvedStep } from "@/lib/player";
import { isHeapDict, valueToDisplay } from "./heapValue";

const BUCKET_COUNT = 8;

export interface HashMapEntry {
  key: string;
  value: string | number;
  bucket: number;
  changed: boolean;
}

export interface HashMapView {
  binding: string;
  buckets: HashMapEntry[][];
}

export function findPrimaryHashMapBinding(trace: Trace): string | undefined {
  for (const step of iterateResolvedSteps(trace)) {
    for (const [ref, obj] of Object.entries(step.heap)) {
      if (isHeapDict(obj)) return ref;
    }
  }
  return undefined;
}

/** The trace only gives us insertion-ordered entries, not CPython's actual
 * hash-table slots — this is a stable, visual-only bucketing (string hash
 * of the key's display form, mod BUCKET_COUNT) so collisions are visible
 * as a UI concept, not a claim about real memory layout. */
function bucketFor(keyLabel: string): number {
  let hash = 0;
  for (let i = 0; i < keyLabel.length; i += 1) {
    hash = (hash * 31 + keyLabel.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BUCKET_COUNT;
}

export function computeHashMapView(
  step: ResolvedStep | undefined,
  binding: string | undefined,
): HashMapView | null {
  if (!step || !binding) return null;
  const obj = step.heap[binding];
  if (!isHeapDict(obj)) return null;

  const changedKeys = new Set<string>();
  const prefix = `${binding}{`;
  for (const path of step.changed) {
    if (!path.startsWith(prefix) || !path.endsWith("}")) continue;
    changedKeys.add(path.slice(prefix.length, -1));
  }

  const buckets: HashMapEntry[][] = Array.from({ length: BUCKET_COUNT }, () => []);
  for (const { key, value } of obj.entries) {
    const keyLabel = String(valueToDisplay(key));
    const bucket = bucketFor(keyLabel);
    buckets[bucket]!.push({
      key: keyLabel,
      value: valueToDisplay(value),
      bucket,
      changed: changedKeys.has(keyLabel),
    });
  }

  return { binding, buckets };
}
