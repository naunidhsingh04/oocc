import { ARTICLES } from "@/lib/curriculum/data";
import { Stagger, StaggerItem } from "@oocc/ui";
import Link from "next/link";

export default function CurriculumIndexPage() {
  return (
    <Stagger className="mx-auto max-w-3xl px-4 py-8">
      <StaggerItem>
        <h1 className="mb-1.5 font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Curriculum</h1>
        <p className="mb-8 font-body text-[14px] text-ink-soft">
          Prose with real, scrubbable traces embedded inline — every example here is a live run, not a static
          screenshot.
        </p>
      </StaggerItem>
      <div className="flex flex-col gap-3">
        {ARTICLES.map((article) => (
          <StaggerItem key={article.slug}>
            <Link
              href={`/curriculum/${article.slug}`}
              className="group flex flex-col gap-1 rounded-panel border border-rule bg-panel px-4 py-3.5 shadow-card transition-[box-shadow,border-color,background-color] duration-150 hover:border-signal/40 hover:bg-raised hover:shadow-raised"
            >
              <span className="font-display text-[16px] font-bold tracking-[-0.02em] text-ink group-hover:text-signal">
                {article.title}
              </span>
              <span className="font-body text-[13px] text-ink-soft">{article.summary}</span>
            </Link>
          </StaggerItem>
        ))}
      </div>
    </Stagger>
  );
}
