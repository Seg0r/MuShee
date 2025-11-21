-- ============================================================================
-- Migration: Add full text search vector for songs
-- Date: 2025-11-19
-- Purpose: Provide a generated tsvector column that indexes title, subtitle,
--          and composer to support full-text searches across the public song
--          catalog.
-- ============================================================================

begin;

alter table public.songs
  add column search_vector tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(composer, '')
    )
  ) stored;

create index songs_search_vector_idx on public.songs using gin (search_vector);

commit;

