import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isFixtureName } from "@/lib/fixtures";
import { EmbeddedTrace } from "./EmbeddedTrace";

/**
 * Renders a curriculum article's markdown body, with one deliberate
 * deviation from plain prose (docs/PRD.md §6.5, the whole reason this
 * curriculum exists): a fenced code block tagged ```trace:<fixtureName>
 * renders as a live, scrubbable `<EmbeddedTrace>` instead of static
 * text — every other code block (untagged, or a language name react-
 * markdown already knows) renders as ordinary code. Internal links
 * (`/curriculum/...`, `/problems/...`) go through `next/link` for
 * client-side navigation; everything else is a plain `<a>`.
 */
export function ArticleBody({ markdown }: { markdown: string }) {
  const components: Components = {
    // react-markdown always wraps a fenced code block's `code` node in its
    // own `pre` node, regardless of what the `code` override below
    // renders — without this, EmbeddedTrace (a `<div>`-based block) and
    // the "unknown fixture" error box both ended up nested inside a
    // browser-default `<pre>`, which happened to still *look* right
    // (verified live) but produced invalid `pre > div > pre` nesting.
    // Passing `pre` through as a bare fragment and letting `code` below
    // decide when a real `<pre>` is actually warranted (only for genuine
    // static fenced blocks) fixes the structure at the source.
    pre({ children }) {
      return <>{children}</>;
    },
    a({ href, children }) {
      if (href?.startsWith("/")) {
        return (
          <Link href={href} className="text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal">
            {children}
          </Link>
        );
      }
      return (
        <a href={href} className="text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal" target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    },
    code(props) {
      // Only `className`/`children` are used — react-markdown's `props`
      // also carries a `node` (its own AST node, not a DOM attribute) and
      // is deliberately never spread onto a real element: doing that
      // once put a literal `node="[object Object]"` attribute in the
      // rendered HTML.
      const { className, children } = props;
      const match = /language-(\S+)/.exec(className ?? "");
      const lang = match?.[1];

      if (lang?.startsWith("trace:")) {
        const fixture = lang.slice("trace:".length);
        if (isFixtureName(fixture)) {
          return <EmbeddedTrace fixture={fixture} />;
        }
        return (
          <div className="border border-mutate bg-panel px-3 py-2 font-mono-label text-[11px] text-mutate">
            Unknown embedded trace fixture &ldquo;{fixture}&rdquo;
          </div>
        );
      }

      // Inline code (no className) vs. a real fenced block.
      if (!className) {
        return (
          <code className="rounded-control bg-paper px-1 py-0.5 font-editor text-[13px] text-ink">{children}</code>
        );
      }
      return (
        <pre className="overflow-x-auto border border-rule bg-paper px-3 py-2 font-editor text-[13px] leading-[1.6] text-ink">
          <code>{children}</code>
        </pre>
      );
    },
  };

  return (
    <div className="flex flex-col gap-4 font-body text-[15px] leading-[1.7] text-ink [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_h3]:font-display [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
