-- ============================================================================
-- Migration: Add full text search vector for songs
-- Date: 2025-11-19
-- Purpose: Provide a generated tsvector column that indexes title, subtitle,
--          and composer to support full-text searches across the public song
--          catalog.
-- ============================================================================

begin;

ALTER TABLE songs
DROP COLUMN IF EXISTS search_vector;

ALTER TABLE songs
ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', title || ' ' || coalesce(composer, '') || ' ' || coalesce(subtitle, ''))
) STORED;

CREATE INDEX IF NOT EXISTS songs_search_vector_idx ON songs USING GIN (search_vector);

commit;

