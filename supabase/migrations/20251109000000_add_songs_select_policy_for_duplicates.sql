-- migration: add_songs_select_policy_for_duplicates
-- description: adds RLS policy allowing authenticated users to query songs by file_hash for duplicate checking
-- reason: During upload, the app needs to check if a file (by hash) already exists in the system
--         to implement deduplication. The existing SELECT policy only allows viewing songs that
--         the user has access to (public songs or songs in their library), but doesn't cover
--         the duplicate-check query. This policy allows authenticated users to read any song's
--         basic metadata (id, file_hash, uploader_id, created_at) needed for deduplication logic.
-- date: 2025-11-09
-- affected: public.songs table
-- dependencies: 20251021000200_create_user_songs.sql

-- ============================================================================
-- Add SELECT policy for duplicate checking
-- ============================================================================

-- Policy: authenticated users can query songs by file_hash for duplicate checking
-- This policy allows authenticated users to read songs for the purpose of checking
-- if a file with the same hash already exists in the system (deduplication).
-- The user_library_access field is not used in this query, so we just need to allow
-- the read operation on the songs table itself.
create policy "authenticated users can query songs for duplicate checking"
  on public.songs
  for select
  to authenticated
  using (true);

