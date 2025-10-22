-- migration: create_rendering_feedback
-- description: creates the rendering_feedback table to log user feedback on sheet music rendering quality
-- affected tables: public.rendering_feedback
-- dependencies: auth.users, public.songs

-- create the rendering_feedback table
create table public.rendering_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  rating smallint not null check (rating in (1, -1)),
  created_at timestamptz not null default now()
);

-- add comment to table
comment on table public.rendering_feedback is 'logs user feedback on the quality of sheet music rendering for specific songs';

-- add comments to columns
comment on column public.rendering_feedback.id is 'unique identifier for the feedback entry';
comment on column public.rendering_feedback.user_id is 'the user providing the feedback';
comment on column public.rendering_feedback.song_id is 'the song being rated';
comment on column public.rendering_feedback.rating is 'the rating given by the user (1 for thumbs up, -1 for thumbs down)';
comment on column public.rendering_feedback.created_at is 'timestamp of when the feedback was submitted';

-- create indexes on foreign keys for join performance and analytics queries
create index rendering_feedback_user_id_idx on public.rendering_feedback(user_id);
create index rendering_feedback_song_id_idx on public.rendering_feedback(song_id);

-- note: intentionally no unique constraint on (user_id, song_id) to allow historical tracking of feedback over time
-- this enables analysis of rendering quality improvements

-- enable row level security
alter table public.rendering_feedback enable row level security;

-- policy: users can insert their own feedback
-- note: users cannot view, update, or delete feedback entries to maintain data integrity for analytics
create policy "users can insert their own feedback"
  on public.rendering_feedback
  for insert
  with check (auth.uid() = user_id);

