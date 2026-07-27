import type { Problem } from "@/lib/problems/types";
import { DifficultyChip } from "@/components/problems/DifficultyChip";
import { Chip } from "@oocc/ui";
import { Fragment } from "react";

/** Splits statement markdown into paragraph/code-fence segments — a tiny,
 * purpose-built renderer rather than pulling in a full markdown library
 * for statements that are always this author's own short, controlled
 * text (headings, paragraphs, one fenced example block, bold/inline
 * code). Curriculum articles (lib/curriculum) have real prose with
 * embedded live traces and use the full react-markdown pipeline instead
 * — see ArticleBody.tsx. */
function renderInline(text: string, key: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded-control bg-paper px-1 py-0.5 font-editor text-[13px] text-ink">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

function StatementMarkdown({ md }: { md: string }) {
  const blocks = md.split(/\n\n+/);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        if (block.startsWith("```")) {
          const code = block.replace(/^```\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={i}
              className="overflow-x-auto border border-rule bg-paper px-3 py-2 font-editor text-[13px] leading-[1.6] text-ink"
            >
              {code}
            </pre>
          );
        }
        return (
          <p key={i} className="font-body text-[14px] leading-[1.6] text-ink">
            {renderInline(block, String(i))}
          </p>
        );
      })}
    </div>
  );
}

export function StatementPanel({ problem }: { problem: Problem }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">{problem.title}</h1>
        <DifficultyChip difficulty={problem.difficulty} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {problem.tags.map((tag) => (
          <Chip key={tag} tone="neutral">
            {tag}
          </Chip>
        ))}
      </div>
      <StatementMarkdown md={problem.statementMd} />
    </div>
  );
}
