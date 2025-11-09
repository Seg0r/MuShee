-- migration: update_storage_rls_policies
-- description: updates RLS policies for content-addressed file storage (files/{hash}.mxl)
-- reason: Moving from user-segregated storage (user-uploads/{userId}/) to content-addressed
--         storage (files/{hash}.mxl) enables file deduplication across users
-- date: 2025-11-08
-- affected: storage.objects table (for musicxml-files bucket)
-- dependencies: 20251108000000_add_storage_rls_policies.sql

-- ============================================================================
-- Drop old policies for user-segregated storage
-- ============================================================================

drop policy if exists "authenticated users can upload their own files" on storage.objects;
drop policy if exists "authenticated users can read their own files" on storage.objects;
drop policy if exists "authenticated users can delete their own files" on storage.objects;

-- ============================================================================
-- Create new policies for content-addressed storage
-- ============================================================================

-- Policy 1: Authenticated users can upload to files directory
-- Allows all authenticated users to upload to files/ for content-addressed storage
create policy "authenticated users can upload files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- Policy 2: Authenticated users can read files directory
-- Allows all authenticated users to read deduplicated files
create policy "authenticated users can read files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- Policy 3: Authenticated users can delete files
-- NOTE: In a production system, deletion should be restricted to only delete
-- files that are not referenced by any songs. This requires additional logic
-- in application or database triggers to implement reference counting.
-- For now, allow deletion but rely on application logic to prevent orphaning.
create policy "authenticated users can delete files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'files'
  );

-- ============================================================================
-- Policies for public domain songs (keep existing anonymous access)
-- ============================================================================

-- Note: These policies are already in place from previous migration
-- They allow anonymous users to read public domain songs (not in files/ directory)
-- Keeping them as-is for now
-- Policy: anonymous users can read public domain files
-- Policy: authenticated users can read public domain files

