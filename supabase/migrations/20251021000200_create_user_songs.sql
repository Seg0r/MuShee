-- migration: create_user_songs
-- description: creates the user_songs junction table for many-to-many relationship between users and songs
-- affected tables: public.user_songs
-- dependencies: auth.users, public.songs

-- create the user_songs table
create table public.user_songs (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

-- add comment to table
comment on table public.user_songs is 'junction table representing the many-to-many relationship between users and songs, forming each user''s personal library';

-- add comments to columns
comment on column public.user_songs.user_id is 'the user''s identifier';
comment on column public.user_songs.song_id is 'the song''s identifier';
comment on column public.user_songs.created_at is 'timestamp of when the song was added to the user''s library';

-- create indexes on foreign keys for join performance
create index user_songs_user_id_idx on public.user_songs(user_id);
create index user_songs_song_id_idx on public.user_songs(song_id);

-- enable row level security
alter table public.user_songs enable row level security;

-- policy: authenticated users can select their own library entries
create policy "authenticated users can select their own library"
  on public.user_songs
  for select
  to authenticated
  using (auth.uid() = user_id);

-- policy: authenticated users can insert songs to their own library
create policy "authenticated users can insert to their own library"
  on public.user_songs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- policy: authenticated users can update their own library entries
-- note: only the created_at timestamp could be updated, though this is unlikely in practice
create policy "authenticated users can update their own library"
  on public.user_songs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- policy: authenticated users can delete songs from their own library
create policy "authenticated users can delete from their own library"
  on public.user_songs
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ============================================================================
-- update songs table policies to include library access
-- ============================================================================
-- now that the user_songs table exists, we can drop the basic authenticated policy
-- and replace it with one that checks the user's library

-- policy: authenticated users can select public songs and songs in their library
create policy "authenticated users can select public and personal songs"
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

