-- ============================================================================
-- Migration: Fix rendering_feedback and ai_suggestion_feedback SELECT policies
-- ============================================================================
-- Purpose: Update RLS policies to allow users to SELECT their own feedback records
--          This enables INSERT operations with .select() to return the inserted row
--          while maintaining security by restricting access to user's own data.
--
-- Affected Tables:
--   - public.rendering_feedback
--   - public.ai_suggestion_feedback
--
-- Issue: The original policies blocked all SELECTs (using false), which prevented
--        INSERT operations with .select() from returning the inserted row. This
--        caused 403 Forbidden errors when submitting feedback.
--
-- Solution: Replace the blocking policies with policies that allow users to
--           SELECT their own feedback records (where auth.uid() = user_id).
--
-- Security: Users can only SELECT their own feedback records, maintaining
--           data privacy and security.
-- ============================================================================

-- ============================================================================
-- Fix rendering_feedback SELECT policy
-- ============================================================================
-- Drop the old policy that blocked all selects
-- This policy prevented INSERT with SELECT from working properly
drop policy if exists "prevent select on rendering feedback" on public.rendering_feedback;

-- Create new policy: users can select their own rendering feedback
-- This allows INSERT operations with .select() to return the inserted row
-- while maintaining security by restricting access to user's own records
create policy "users can select their own rendering feedback"
  on public.rendering_feedback
  for select
  using (auth.uid() = user_id);

-- ============================================================================
-- Fix ai_suggestion_feedback SELECT policy
-- ============================================================================
-- Drop the old policy that blocked all selects
-- This policy prevented INSERT with SELECT from working properly
drop policy if exists "prevent select on ai suggestion feedback" on public.ai_suggestion_feedback;

-- Create new policy: users can select their own ai suggestion feedback
-- This allows INSERT operations with .select() to return the inserted row
-- while maintaining security by restricting access to user's own records
create policy "users can select their own ai suggestion feedback"
  on public.ai_suggestion_feedback
  for select
  using (auth.uid() = user_id);

