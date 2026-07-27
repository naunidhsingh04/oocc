"""app/curriculum/articles_store.py (the `concepts` table) and
app/rag/seed.py's `CONCEPT_ARTICLES` — brief item 4: 12 full curriculum
articles whose slugs must line up with the 12 concept ids already seeded
into `concept_chunks` by `CURRICULUM_SEED`, since both are keyed by the
same human-chosen concept id."""

from __future__ import annotations

import pytest
from app.curriculum.articles_store import ConceptArticle, InMemoryConceptArticleStore
from app.rag.seed import CONCEPT_ARTICLES, CURRICULUM_SEED, seed_concept_articles

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def test_exactly_twelve_concept_articles() -> None:
    assert len(CONCEPT_ARTICLES) == 12


def test_every_article_slug_matches_an_existing_concept_chunk() -> None:
    chunk_concept_ids = {entry["concept_id"] for entry in CURRICULUM_SEED}
    article_slugs = {str(entry["slug"]) for entry in CONCEPT_ARTICLES}
    assert article_slugs == chunk_concept_ids


def test_every_prereq_id_refers_to_another_seeded_article() -> None:
    slugs = {str(entry["slug"]) for entry in CONCEPT_ARTICLES}
    for entry in CONCEPT_ARTICLES:
        for prereq in entry["prereq_ids"]:  # type: ignore[union-attr]
            assert prereq in slugs, f"{entry['slug']} lists unknown prereq {prereq!r}"


def test_no_article_lists_itself_as_a_prerequisite() -> None:
    for entry in CONCEPT_ARTICLES:
        assert entry["slug"] not in entry["prereq_ids"]  # type: ignore[operator]


async def test_seed_concept_articles_inserts_every_entry() -> None:
    store = InMemoryConceptArticleStore()

    count = await seed_concept_articles(store=store)

    assert count == 12
    assert len(store) == 12


async def test_seeded_article_round_trips_through_the_store() -> None:
    store = InMemoryConceptArticleStore()
    await seed_concept_articles(store=store)

    article = await store.get_by_slug("binary-search")

    assert article is not None
    assert isinstance(article, ConceptArticle)
    assert "log n" in article.body_md
    assert "big-o-notation" in article.prereq_ids
