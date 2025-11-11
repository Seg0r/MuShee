-- ============================================================================
-- Create Storage Bucket for MusicXML Files
-- ============================================================================
-- This migration creates the storage bucket for MusicXML files.
-- Creating the bucket via SQL bypasses RLS policies on storage.buckets.
--
-- Date: 2025-11-11
-- Purpose: Create musicxml-files storage bucket with appropriate configuration
-- ============================================================================

-- Create the storage bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'musicxml-files',
  'musicxml-files',
  true,
  52428800, -- 50MB
  array['application/vnd.recordare.musicxml']::text[]
)
on conflict (id) do nothing;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

