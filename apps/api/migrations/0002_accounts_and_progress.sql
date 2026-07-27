-- docs/PRD.md §8, Phase 5 (accounts, progress, problems, curriculum
-- articles). Idempotent, like 0001_concept_chunks.sql: `IF NOT EXISTS`
-- everywhere so this is safe to run against an already-migrated database.
--
-- `concepts` is deliberately separate from `concept_chunks` (0001): that
-- table holds short retrieval passages embedded for the tutor's RAG;
-- `concepts` holds full curriculum articles with prerequisite links for
-- the curriculum/progress UI. Both reference the same human-chosen
-- concept id (e.g. "binary-search"), but neither is derived from the
-- other.
--
-- `github_id` on `users` is a fleshed-out column beyond the PRD's
-- abbreviated list: GitHub OAuth needs a stable key to match a returning
-- user against that isn't email (a GitHub account's public email can be
-- empty or change), the same way `handle` gives a display name to
-- magic-link users who never had one assigned by a provider.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    handle TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    github_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settings JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Single-use tracking for magic-link tokens (app/auth/tokens.py issues the
-- signed, self-expiring token itself; this table is the one thing a
-- signature can't prove — whether it's already been redeemed).
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    source_hash TEXT NOT NULL,
    language TEXT NOT NULL,
    status TEXT NOT NULL,
    -- docs/PRD.md §8: traces are gzipped JSON in object storage
    -- (app/storage/trace_store.py), never the trace body itself here.
    trace_url TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_user_id_idx ON runs (user_id);
CREATE INDEX IF NOT EXISTS runs_source_hash_idx ON runs (source_hash);

CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    statement_md TEXT NOT NULL,
    starter_code TEXT NOT NULL,
    -- Each element is {"args": [...], "expected": <json>} — see
    -- app/problems/problem_store.py and apps/api/scripts/seed_problems.py.
    tests JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    problem_id TEXT NOT NULL REFERENCES problems(id),
    run_id TEXT REFERENCES runs(id),
    passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON submissions (user_id);
CREATE INDEX IF NOT EXISTS submissions_problem_id_idx ON submissions (problem_id);

-- Full curriculum articles. `id` and `slug` are the same human-chosen
-- concept id used by `concept_chunks.concept_id` and `progress.concept_id`
-- (e.g. "binary-search") so the three tables join without a lookup layer.
CREATE TABLE IF NOT EXISTS concepts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    prereq_ids TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL REFERENCES users(id),
    concept_id TEXT NOT NULL REFERENCES concepts(id),
    mastery REAL NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ,
    next_review_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, concept_id)
);

CREATE INDEX IF NOT EXISTS progress_next_review_at_idx ON progress (next_review_at);

CREATE TABLE IF NOT EXISTS insights (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    step_refs INT[] NOT NULL DEFAULT '{}',
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS insights_run_id_idx ON insights (run_id);
