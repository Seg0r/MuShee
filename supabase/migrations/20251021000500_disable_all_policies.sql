-- migration: disable_all_policies
-- description: disables all row level security on all tables (keeps policies intact but inactive)
-- affected tables: public.profiles, public.songs, public.user_songs, public.rendering_feedback, public.ai_suggestion_feedback
-- dependencies: all previous migrations

-- ============================================================================
-- disable row level security on public.profiles
-- ============================================================================
alter table public.profiles disable row level security;

-- ============================================================================
-- disable row level security on public.songs
-- ============================================================================
alter table public.songs disable row level security;

-- ============================================================================
-- disable row level security on public.user_songs
-- ============================================================================
alter table public.user_songs disable row level security;

-- ============================================================================
-- disable row level security on public.rendering_feedback
-- ============================================================================
alter table public.rendering_feedback disable row level security;

-- ============================================================================
-- disable row level security on public.ai_suggestion_feedback
-- ============================================================================
alter table public.ai_suggestion_feedback disable row level security;

