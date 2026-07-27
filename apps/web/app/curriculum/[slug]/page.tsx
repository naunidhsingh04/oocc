import { ArticleBodyLoader } from "@/components/curriculum/ArticleBodyLoader";
import { ARTICLES, getArticle } from "@/lib/curriculum/data";
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
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/curriculum" className="mb-4 inline-block font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft hover:text-signal">
        ← Curriculum
      </Link>
      <h1 className="mb-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">{article.title}</h1>
      <p className="mb-6 font-body text-[14px] text-ink-soft">{article.summary}</p>

      <ArticleBodyLoader markdown={article.bodyMd} />

      {related.length > 0 ? (
        <div className="mt-8 border-t border-rule pt-4">
          <div className="mb-2 font-mono-label text-[11px] uppercase tracking-[0.06em] text-ink-soft">
            Related concepts
          </div>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/curriculum/${r.slug}`}
                className="rounded-control border border-rule bg-panel px-2 py-1 font-body text-[13px] text-ink hover:border-signal hover:text-signal"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
