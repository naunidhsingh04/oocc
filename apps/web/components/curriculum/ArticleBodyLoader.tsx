"use client";

import { Skeleton } from "@oocc/ui";
import dynamic from "next/dynamic";

// Same reasoning as components/workspace/WorkspaceLoader.tsx: embedded
// traces include a canvas mini-ribbon that draws in a client-only effect,
// so this subtree skips SSR entirely to avoid a hydration mismatch.
// docs/PRD.md §9's "no layout shift on trace load" is most directly about
// EmbeddedTrace's own skeleton (fixed, see EmbeddedTrace.tsx — every real
// fixture's card is a known, near-constant height). A whole article's
// *total* length varies with its own prose and can't be predicted from
// here without parsing the markdown first, so this skeleton is a
// deliberately generous floor (most articles run at least one viewport
// long) rather than a precise match — it removes the worst of the shift,
// not all of it. A real fix would SSR the prose and only client-defer the
// embedded-trace blocks inside it; out of scope for this pass.
const ArticleBody = dynamic(() => import("./ArticleBody").then((mod) => mod.ArticleBody), {
  ssr: false,
  loading: () => (
    <div className="min-h-[100vh] space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="mt-6 h-64 w-full" />
      <Skeleton className="mt-6 h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  ),
});

export function ArticleBodyLoader({ markdown }: { markdown: string }) {
  return <ArticleBody markdown={markdown} />;
}
