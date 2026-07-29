"use client";

import dynamic from "next/dynamic";

// The workspace is CodeMirror + a canvas ribbon + react-resizable-panels —
// entirely client-side interactive, with zero SEO value from SSR. Several
// of those libraries mutate their own inline styles directly on the DOM
// after mount (bypassing React) for drag-resize performance, which makes
// the server-rendered markup permanently disagree with the client's first
// paint and throws a hydration-mismatch warning on every load. Skipping SSR
// for this subtree removes the markup there'd be nothing to mismatch
// against.
const Workspace = dynamic(() => import("./Workspace").then((mod) => mod.Workspace), {
  ssr: false,
  loading: () => <div className="flex min-h-0 flex-1 flex-col" />,
});

const LandingWorkspace = dynamic(
  () => import("./LandingWorkspace").then((mod) => mod.LandingWorkspace),
  { ssr: false, loading: () => <div className="flex min-h-0 flex-1 flex-col" /> },
);

export function WorkspaceLoader() {
  return <Workspace />;
}

/** `/`'s own entry point — see LandingWorkspace.tsx for what makes this
 * different from the plain WorkspaceLoader every other route uses. */
export function HomeWorkspaceLoader() {
  return <LandingWorkspace />;
}
