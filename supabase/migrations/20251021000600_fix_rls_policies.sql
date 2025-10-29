-- migration: fix_rls_policies
-- description: corrects and improves rls policies with proper role separation and complete access control
-- affected tables: public.songs, public.rendering_feedback, public.ai_suggestion_feedback
-- dependencies: all previous migrations

-- ============================================================================
-- improve songs table policies
-- ============================================================================
-- drop the overly broad policy and replace with separate policies for anon and authenticated roles

drop policy "users can view public songs and songs in their library" on public.songs;

-- policy: anonymous users can only select public songs
create policy "anonymous users can select public songs"
  on public.songs
  for select
  to anon
  using (uploader_id is null);

-- policy: authenticated users can select public songs and songs in their library
create policy "authenticated users can select public songs and library songs"
  on public.songs
  for select
  to authenticated
  using (
    uploader_id is null or
    exists (
      select 1 from public.user_songs
      where user_songs.song_id = songs.id and user_songs.user_id = auth.uid()
    )
  );

-- policy: authenticated users can insert new songs (unchanged but explicit for clarity)
-- note: the original policy already exists, keeping it for reference
-- create policy "authenticated users can insert songs"
--   on public.songs
--   for insert
--   to authenticated
--   with check (auth.role() = 'authenticated');

-- ============================================================================
-- add select restrictions for feedback tables (users cannot read feedback)
-- ============================================================================
-- note: rendering_feedback currently only has insert policy, add select to prevent access

-- policy: prevent select on rendering_feedback (write-only feedback table)
create policy "prevent select on rendering feedback"
  on public.rendering_feedback
  for select
  using (false);

-- policy: prevent update on rendering_feedback (write-only feedback table)
create policy "prevent update on rendering feedback"
  on public.rendering_feedback
  for update
  using (false);

-- policy: prevent delete on rendering_feedback (write-only feedback table)
create policy "prevent delete on rendering feedback"
  on public.rendering_feedback
  for delete
  using (false);

-- policy: prevent select on ai_suggestion_feedback (write-only feedback table)
create policy "prevent select on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for select
  using (false);

-- policy: prevent update on ai_suggestion_feedback (write-only feedback table)
create policy "prevent update on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for update
  using (false);

-- policy: prevent delete on ai_suggestion_feedback (write-only feedback table)
create policy "prevent delete on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for delete
  using (false);
