-- migration: create_songs
-- description: creates the songs table to store master records for unique music pieces
-- affected tables: public.songs
-- dependencies: auth.users (supabase managed)

-- create the songs table
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  composer varchar(200),
  title varchar(200),
  file_hash text not null unique,
  uploader_id uuid references auth.users(id) on delete cascade
);

-- add comment to table
comment on table public.songs is 'stores the master record for every unique piece of music in the system';

-- add comments to columns
comment on column public.songs.id is 'unique identifier for the song';
comment on column public.songs.created_at is 'timestamp of when the song was first added';
comment on column public.songs.composer is 'the composer of the music piece, parsed from the musicxml file';
comment on column public.songs.title is 'the title of the music piece, parsed from the musicxml file';
comment on column public.songs.file_hash is 'md5 hash of the musicxml file content to prevent duplicates';
comment on column public.songs.uploader_id is 'the user who originally uploaded the song. null indicates a public domain song';

-- create index on file_hash for uniqueness enforcement (unique constraint already creates an index)
-- create index on uploader_id for foreign key join performance
create index songs_uploader_id_idx on public.songs(uploader_id);

-- enable row level security
alter table public.songs enable row level security;

-- policy: anonymous users can select public songs (uploader_id is null)
create policy "anonymous users can select public songs"
  on public.songs
  for select
  to anon
  using (uploader_id is null);

-- policy: authenticated users can insert new songs
create policy "authenticated users can insert songs"
  on public.songs
  for insert
  with check (auth.role() = 'authenticated');

