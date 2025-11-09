-- migration: remove_file_hash_unique_constraint
-- description: allows multiple songs to reference the same file hash for deduplication
-- reason: Fixes issue where uploading duplicate files failed due to UNIQUE constraint.
-- This enables multiple users to upload identical files (same content, same hash) without
-- duplicating storage. Each user gets their own song record with their uploader_id.
-- date: 2025-11-08
-- affected tables: public.songs
-- related: https://github.com/project/issues/xxx (duplicate upload issue)

-- Drop the unique constraint from file_hash
-- This allows multiple song records to reference the same file hash
alter table public.songs drop constraint if exists songs_file_hash_key;

-- Ensure we have a regular (non-unique) index on file_hash for query performance
-- This index is used by findSongByHash and deduplication checks
drop index if exists songs_file_hash_key;
create index if not exists songs_file_hash_idx on public.songs(file_hash);

-- Add a compound unique index to prevent the same user from uploading the same file twice
-- (This is already handled by user_songs constraints, but provides extra safety)
-- The (file_hash, uploader_id) combination should be unique to prevent accidental duplicates
create unique index if not exists idx_songs_file_hash_uploader_unique 
  on public.songs(file_hash, uploader_id) 
  where uploader_id is not null;

-- Comment explaining the change
comment on column public.songs.file_hash is 
  'MD5 hash of the MusicXML file content. Multiple songs can have the same hash (different uploaders).
   Use with uploader_id to identify unique user uploads.
   Paired with (file_hash, uploader_id) unique index to prevent same user uploading same file twice.
   Paired with file_hash index for efficient duplicate detection and storage deduplication.';

