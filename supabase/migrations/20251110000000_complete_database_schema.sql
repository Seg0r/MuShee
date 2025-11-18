-- ============================================================================
-- MuShee Complete Database Schema
-- ============================================================================
-- This migration consolidates the complete database schema and all RLS policies
-- into a single comprehensive file. This serves as the source of truth for the
-- database structure.
--
-- Date: 2025-11-10
-- Purpose: Provides a complete definition of all tables, indexes, and RLS policies
--          without duplicates or contradictions that may have resulted from
--          previous incremental migrations.
--
-- NOTE: This is a documentation/reference migration. In production, apply this
--       after ensuring no conflicts exist with already-applied migrations.
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- Table: public.profiles
-- Description: Extends auth.users with application-specific public data for each user
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz,
  has_completed_onboarding boolean not null default false
);

comment on table public.profiles is 'extends auth.users with application-specific public data for each user';
comment on column public.profiles.id is 'corresponds to the id in the auth.users table';
comment on column public.profiles.updated_at is 'timestamp of the last profile update';
comment on column public.profiles.has_completed_onboarding is 'flag to track if the user has seen the new user onboarding modal';

-- Table: public.songs
-- Description: Stores the master record for every unique piece of music in the system
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  composer varchar(200) not null,
  title varchar(200) not null,
  subtitle varchar(200),
  file_hash text not null,
  uploader_id uuid references auth.users(id) on delete cascade
);

comment on table public.songs is 'stores the master record for every unique piece of music in the system';
comment on column public.songs.id is 'unique identifier for the song';
comment on column public.songs.created_at is 'timestamp of when the song was first added';
comment on column public.songs.composer is 'the composer of the music piece, parsed from the musicxml file';
comment on column public.songs.title is 'the title of the music piece, parsed from the musicxml file';
comment on column public.songs.subtitle is
  'optional movement subtitle derived from movement number/title in the musicxml file';
comment on column public.songs.file_hash is 'MD5 hash of the MusicXML file content. Multiple songs can have the same hash (different uploaders). Use with uploader_id to identify unique user uploads. Paired with (file_hash, uploader_id) unique index to prevent same user uploading same file twice. Paired with file_hash index for efficient duplicate detection and storage deduplication.';
comment on column public.songs.uploader_id is 'the user who originally uploaded the song. null indicates a public domain song';

-- Table: public.user_songs
-- Description: Junction table representing the many-to-many relationship between users and songs
create table public.user_songs (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

comment on table public.user_songs is 'junction table representing the many-to-many relationship between users and songs, forming each user''s personal library';
comment on column public.user_songs.user_id is 'the user''s identifier';
comment on column public.user_songs.song_id is 'the song''s identifier';
comment on column public.user_songs.created_at is 'timestamp of when the song was added to the user''s library';

-- Table: public.rendering_feedback
-- Description: Logs user feedback on the quality of sheet music rendering for specific songs
create table public.rendering_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz not null default now()
);

comment on table public.rendering_feedback is 'logs user feedback on the quality of sheet music rendering for specific songs';
comment on column public.rendering_feedback.id is 'unique identifier for the feedback entry';
comment on column public.rendering_feedback.user_id is 'the user providing the feedback';
comment on column public.rendering_feedback.song_id is 'the song being rated';
comment on column public.rendering_feedback.rating is 'the rating given by the user (1 for thumbs up, -1 for thumbs down)';
comment on column public.rendering_feedback.created_at is 'timestamp of when the feedback was submitted';

-- Note: Intentionally no unique constraint on (user_id, song_id) to allow historical tracking
--       of feedback over time. This enables analysis of rendering quality improvements.

-- Table: public.ai_suggestion_feedback
-- Description: Logs user feedback on the relevance of song suggestions provided by the AI
create table public.ai_suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suggestions jsonb not null,
  rating_score integer not null default 0,
  input_songs json not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_suggestion_feedback is 'logs user feedback on the relevance of song suggestions provided by the ai. each row captures the full suggestion set returned by the ai so that users can rate individual entries within the set. the rating_score provides a quick aggregate for analytics while preserving individual ratings in the suggestions json';
comment on column public.ai_suggestion_feedback.id is 'unique identifier for the feedback entry';
comment on column public.ai_suggestion_feedback.user_id is 'the user providing the feedback';
comment on column public.ai_suggestion_feedback.suggestions is 'array of suggestion objects returned by the ai. each object includes title, composer, and an optional user_rating (1 for upvote, -1 for downvote, null when unrated)';
comment on column public.ai_suggestion_feedback.rating_score is 'sum of all user ratings for this suggestion set (1 for each thumbs up, -1 for each thumbs down). used for quick analytics calculations';
comment on column public.ai_suggestion_feedback.input_songs is 'a json object or array containing the list of songs sent to the ai to generate the suggestion set';
comment on column public.ai_suggestion_feedback.created_at is 'timestamp of when the feedback was submitted';
comment on column public.ai_suggestion_feedback.updated_at is 'timestamp of the last feedback update';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes on songs table
create index songs_file_hash_idx on public.songs(file_hash);
create index songs_uploader_id_idx on public.songs(uploader_id);
create unique index idx_songs_file_hash_uploader_unique 
  on public.songs(file_hash, uploader_id) 
  where uploader_id is not null;

-- Indexes on user_songs table
create index user_songs_user_id_idx on public.user_songs(user_id);
create index user_songs_song_id_idx on public.user_songs(song_id);

-- Indexes on rendering_feedback table
create index rendering_feedback_user_id_idx on public.rendering_feedback(user_id);
create index rendering_feedback_song_id_idx on public.rendering_feedback(song_id);

-- Indexes on ai_suggestion_feedback table
create index ai_suggestion_feedback_user_id_idx on public.ai_suggestion_feedback(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - ENABLE
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.user_songs enable row level security;
alter table public.rendering_feedback enable row level security;
alter table public.ai_suggestion_feedback enable row level security;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - PROFILES TABLE POLICIES
-- ============================================================================

-- Policy: Users can manage their own profile
create policy "users can manage their own profile"
  on public.profiles
  for all
  using (auth.uid() = id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - SONGS TABLE POLICIES
-- ============================================================================

-- Policy: Anonymous users can only select public songs
create policy "anonymous users can select public songs"
  on public.songs
  for select
  to anon
  using (uploader_id is null);

-- Policy: Authenticated users can select public songs and songs in their library
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

-- Policy: Authenticated users can insert new songs (with uploader_id validation)
create policy "authenticated users can insert songs"
  on public.songs
  for insert
  to authenticated
  with check (uploader_id = auth.uid());

-- Policy: Authenticated users can query songs by file_hash for duplicate checking
create policy "authenticated users can query songs for duplicate checking"
  on public.songs
  for select
  to authenticated
  using (true);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - USER_SONGS TABLE POLICIES
-- ============================================================================

-- Policy: Users can manage their own library
create policy "users can manage their own library"
  on public.user_songs
  for all
  using (auth.uid() = user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - RENDERING_FEEDBACK TABLE POLICIES
-- ============================================================================

-- Policy: Users can insert their own feedback
create policy "users can insert their own rendering feedback"
  on public.rendering_feedback
  for insert
  with check (auth.uid() = user_id);

-- Policy: Prevent select on rendering_feedback (write-only feedback table)
create policy "prevent select on rendering feedback"
  on public.rendering_feedback
  for select
  using (false);

-- Policy: Prevent update on rendering_feedback (write-only feedback table)
create policy "prevent update on rendering feedback"
  on public.rendering_feedback
  for update
  using (false);

-- Policy: Prevent delete on rendering_feedback (write-only feedback table)
create policy "prevent delete on rendering feedback"
  on public.rendering_feedback
  for delete
  using (false);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - AI_SUGGESTION_FEEDBACK TABLE POLICIES
-- ============================================================================

-- Policy: Users can insert their own feedback
create policy "users can insert their own ai suggestion feedback"
  on public.ai_suggestion_feedback
  for insert
  with check (auth.uid() = user_id);

-- Policy: Prevent select on ai_suggestion_feedback (write-only feedback table)
create policy "prevent select on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for select
  using (false);

-- Policy: Prevent update on ai_suggestion_feedback (write-only feedback table)
create policy "prevent update on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for update
  using (false);

-- Policy: Prevent delete on ai_suggestion_feedback (write-only feedback table)
create policy "prevent delete on ai suggestion feedback"
  on public.ai_suggestion_feedback
  for delete
  using (false);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - STORAGE POLICIES
-- ============================================================================

-- Note: Storage bucket policies are applied to the storage.objects table.
-- These policies handle the 'musicxml-files' bucket.

-- Policy: Authenticated users can upload files to files/ directory
create policy "authenticated users can upload files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- Policy: Authenticated users can read files in files/ directory
create policy "authenticated users can read files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- Policy: Authenticated users can delete files in files/ directory
create policy "authenticated users can delete files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- Policy: Anonymous users can read public domain files (not in files/ directory)
create policy "anonymous users can read public domain files"
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] != 'files'
  );

-- Policy: Authenticated users can read public domain files (not in files/ directory)
create policy "authenticated users can read public domain files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] != 'files'
  );

-- ============================================================================
-- END OF SCHEMA DEFINITION
-- ============================================================================

