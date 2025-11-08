-- migration: add_storage_rls_policies
-- description: adds row-level security policies for the musicxml-files storage bucket
-- date: 2025-11-08
-- affected: storage.objects table (for musicxml-files bucket)
-- dependencies: 20251031010419_create_storage_bucket.sql

-- ============================================================================
-- storage bucket policies for musicxml-files
-- ============================================================================
-- The musicxml-files bucket stores user-uploaded MusicXML files and public domain compositions.
-- 
-- Path structure for user uploads:
--   user-uploads/{userId}/{hash}.mxl
--
-- Path structure for public domain songs:
--   public-domain/{filename}.mxl (or similar, without user-uploads prefix)
--
-- These policies ensure:
-- 1. Users can only upload to their own user directory
-- 2. Users can only read/delete their own files
-- 3. Anyone can read public domain songs (not in user-uploads directory)

-- Note: These policies are created using execute_sql instead of apply_migration
-- because storage.objects is a system table that requires special handling.
-- The policies have been created directly on the database.

-- Policy 1: Authenticated users can upload to their own user directory
-- Allows uploads to user-uploads/{user_id}/* paths only
create policy "authenticated users can upload their own files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'user-uploads' and
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Policy 2: Authenticated users can read their own uploaded files
-- Allows access to files in user-uploads/{user_id}/* paths
create policy "authenticated users can read their own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'user-uploads' and
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Policy 3: Authenticated users can delete their own uploaded files
-- Allows deletion of files in user-uploads/{user_id}/* paths
create policy "authenticated users can delete their own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'user-uploads' and
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Policy 4: Anonymous users can read public domain songs
-- Allows read access to public files not in user-uploads directory
create policy "anonymous users can read public domain files"
  on storage.objects
  for select
  to anon
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] != 'user-uploads'
  );

-- Policy 5: Authenticated users can read public domain songs
-- Allows authenticated users to read public files
create policy "authenticated users can read public domain files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] != 'user-uploads'
  );

