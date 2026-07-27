"use client";

import dynamic from "next/dynamic";

// Same reasoning as components/workspace/WorkspaceLoader.tsx: embedded
// traces include a canvas mini-ribbon that draws in a client-only effect,
// so this subtree skips SSR entirely to avoid a hydration mismatch.
const ArticleBody = dynamic(() => import("./ArticleBody").then((mod) => mod.ArticleBody), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse bg-panel" />,
});

export function ArticleBodyLoader({ markdown }: { markdown: string }) {
  return <ArticleBody markdown={markdown} />;
}
