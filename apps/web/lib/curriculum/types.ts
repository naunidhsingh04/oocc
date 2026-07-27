export interface Article {
  slug: string;
  title: string;
  summary: string;
  /** Deep interlinking (docs/PRD.md §6.5): other article slugs this one
   * assumes or leads into. Rendered as a "Related concepts" rail. */
  relatedSlugs: string[];
  /** Markdown body. A fenced code block whose language tag is
   * `trace:<fixtureName>` renders as a live, scrubbable `<EmbeddedTrace>`
   * instead of static code — see ArticleBody.tsx. */
  bodyMd: string;
}
