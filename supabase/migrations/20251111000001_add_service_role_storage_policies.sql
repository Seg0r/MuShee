-- ============================================================================
-- Add Service Role Storage Policies for Public Domain Uploads
-- ============================================================================
-- This migration adds storage policies that allow the service role to manage
-- files in the public-domain/ directory for seeding purposes.
--
-- Date: 2025-11-11
-- Purpose: Enable seed script to upload public domain scores
-- ============================================================================

-- Policy: Service role can insert public domain files
-- This allows the seed script (using service role key) to upload files to public-domain/
create policy "service role can insert public domain files"
  on storage.objects
  for insert
  to service_role
  with check (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'public-domain'
  );

-- Policy: Service role can select/list all files in bucket
-- This allows the seed script to check for existing files and list bucket contents
create policy "service role can select all files"
  on storage.objects
  for select
  to service_role
  using (bucket_id = 'musicxml-files');

-- Policy: Service role can delete public domain files
-- This allows cleanup operations if needed
create policy "service role can delete public domain files"
  on storage.objects
  for delete
  to service_role
  using (
    bucket_id = 'musicxml-files' and
    (storage.foldername(name))[1] = 'public-domain'
  );

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

