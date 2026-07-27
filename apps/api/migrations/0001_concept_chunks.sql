-- docs/PRD.md §8. Idempotent: safe to run against an already-migrated
-- database (fresh containers via docker-compose, or CI).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS concept_chunks (
    id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL
);

CREATE INDEX IF NOT EXISTS concept_chunks_embedding_idx
    ON concept_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
