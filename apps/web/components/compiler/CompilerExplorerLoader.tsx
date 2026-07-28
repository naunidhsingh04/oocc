"use client";

import dynamic from "next/dynamic";

// Same reasoning as apps/web/components/workspace/WorkspaceLoader.tsx:
// CodeMirror, the canvas ribbon, and the WASM Worker are all client-only
// and mutate their own DOM/state outside React's render cycle — SSR-ing
// this page would only produce markup that immediately disagrees with
// the client's first paint. No SEO value here either.
const CompilerExplorer = dynamic(
  () => import("./CompilerExplorer").then((mod) => mod.CompilerExplorer),
  { ssr: false, loading: () => <div className="flex min-h-0 flex-1 flex-col" /> },
);

export function CompilerExplorerLoader() {
  return <CompilerExplorer />;
}
