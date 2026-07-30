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

/** `/play`'s entry point — the real, full editor+panels+ribbon+tutor
 * workspace. `/` is a separate, minimal marketing landing
 * (`components/home/`) that no longer embeds this at all — see that
 * directory's docstring for why splitting them was the point. */
export function WorkspaceLoader() {
  return <Workspace />;
}
