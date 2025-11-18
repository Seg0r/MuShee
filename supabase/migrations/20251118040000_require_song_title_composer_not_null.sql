-- ============================================================================
-- Migration: Require title and composer on songs
-- Date: 2025-11-18
-- Purpose: ensure every song record has non-null title and composer now that the
--          UI relies on these fields to render metadata without defensive
--          fallbacks. We sanitize existing null values before applying the
--          NOT NULL constraints.
-- ============================================================================

begin;

-- normalize existing rows so that constraints can be applied safely
update public.songs
set title = ''
where title is null;

update public.songs
set composer = ''
where composer is null;

-- enforce not-null semantics for both metadata columns
alter table public.songs
  alter column title set not null;

alter table public.songs
  alter column composer set not null;

commit;

