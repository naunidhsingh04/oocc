"use client";

import type { Problem } from "@/lib/problems/types";
import dynamic from "next/dynamic";

// Same reasoning as components/workspace/WorkspaceLoader.tsx: this embeds
// the full CodeMirror + canvas-ribbon workspace, so it gets the identical
// ssr:false treatment to avoid a hydration mismatch against libraries that
// mutate the DOM directly after mount.
const ProblemWorkspace = dynamic(
  () => import("./ProblemWorkspace").then((mod) => mod.ProblemWorkspace),
  { ssr: false, loading: () => <div className="flex min-h-0 flex-1 flex-col" /> },
);

export function ProblemWorkspaceLoader({ problem }: { problem: Problem }) {
  return <ProblemWorkspace problem={problem} />;
}
