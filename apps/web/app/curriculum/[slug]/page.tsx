import { ArticleBodyLoader } from "@/components/curriculum/ArticleBodyLoader";
import { ARTICLES, getArticle } from "@/lib/curriculum/data";
import { Stagger, StaggerItem } from "@oocc/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = article.relatedSlugs
    .map((s) => ARTICLES.find((a) => a.slug === s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <Stagger className="mx-auto max-w-3xl px-4 py-8">
      <StaggerItem>
        <Link
          href="/curriculum"
          className="mb-4 inline-block font-body text-[13px] font-medium text-ink-soft transition-colors duration-150 hover:text-signal"
        >
          ← Curriculum
        </Link>
        <h1 className="mb-1.5 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">{article.title}</h1>
        <p className="mb-8 font-body text-[14px] text-ink-soft">{article.summary}</p>
      </StaggerItem>

      <StaggerItem>
        <ArticleBodyLoader markdown={article.bodyMd} />
      </StaggerItem>

      {related.length > 0 ? (
        <StaggerItem>
          <div className="mt-10 border-t border-rule pt-5">
            <div className="mb-3 font-body text-[13px] font-semibold text-ink-soft">Related concepts</div>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/curriculum/${r.slug}`}
                  className="rounded-control border border-rule bg-panel px-2.5 py-1.5 font-body text-[13px] text-ink shadow-card transition-[box-shadow,border-color,color] duration-150 hover:border-signal hover:text-signal hover:shadow-raised"
                >
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        </StaggerItem>
      ) : null}
    </Stagger>
  );
}
