import { ARTICLES } from "@/lib/curriculum/data";
import Link from "next/link";

export default function CurriculumIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">Curriculum</h1>
      <p className="mb-6 font-body text-[14px] text-ink-soft">
        Prose with real, scrubbable traces embedded inline — every example here is a live run, not a static
        screenshot.
      </p>
      <div className="flex flex-col gap-px bg-rule">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/curriculum/${article.slug}`}
            className="group flex flex-col gap-0.5 bg-panel px-4 py-3 hover:bg-paper"
          >
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink group-hover:text-signal">
              {article.title}
            </span>
            <span className="font-body text-[13px] text-ink-soft">{article.summary}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
