-- migration: fix_songs_insert_policy
-- description: corrects the songs table insert policy to enforce uploader_id validation
-- affected tables: public.songs
-- dependencies: 20251021000100_create_songs.sql, 20251021000200_create_user_songs.sql

-- ============================================================================
-- fix songs table insert policy
-- ============================================================================
-- the current insert policy only checks if the user is authenticated
-- but does not enforce that uploader_id matches the authenticated user
-- this causes RLS violations when inserting new songs

-- drop the incomplete insert policy
drop policy "authenticated users can insert songs" on public.songs;

-- create the corrected policy that enforces uploader_id matches authenticated user
-- this ensures authenticated users can only insert songs with their own user_id as uploader_id
create policy "authenticated users can insert songs"
  on public.songs
  for insert
  to authenticated
  with check (uploader_id = auth.uid());

