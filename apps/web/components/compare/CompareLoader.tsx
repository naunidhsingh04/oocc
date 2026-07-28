"use client";

import dynamic from "next/dynamic";

// Same reasoning as components/workspace/WorkspaceLoader.tsx: CodeMirror +
// canvas ribbons + react-resizable-panels all mutate their own DOM directly
// after mount for drag/scroll performance, which makes SSR'd markup
// permanently disagree with the client's first paint. Skipping SSR removes
// the markup there'd be nothing to mismatch against.
const CompareView = dynamic(() => import("./CompareView").then((mod) => mod.CompareView), {
  ssr: false,
  loading: () => <div className="flex min-h-0 flex-1 flex-col" />,
});

export function CompareLoader() {
  return <CompareView />;
}
