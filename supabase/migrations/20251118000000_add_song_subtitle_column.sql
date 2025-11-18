-- ============================================================================
-- Migration: Add subtitle column to songs table
-- Date: 2025-11-18
-- Purpose: persist MusicXML subtitle metadata (movement number/title) so
--          that shared songs can expose richer information without relying on
--          on-demand parsing. This column mirrors the metadata already
--          collected by the seeding logic.
-- ============================================================================

begin;

-- add the new subtitle column to store optional movement metadata
alter table public.songs
  add column subtitle varchar(200);

comment on column public.songs.subtitle is
  'optional movement subtitle derived from movement number/title in the musicxml file';

commit;

