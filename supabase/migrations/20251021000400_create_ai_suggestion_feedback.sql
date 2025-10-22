-- migration: create_ai_suggestion_feedback
-- description: creates the ai_suggestion_feedback table to log user feedback on ai song suggestions
-- affected tables: public.ai_suggestion_feedback
-- dependencies: auth.users

-- create the ai_suggestion_feedback table
create table public.ai_suggestion_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suggestions jsonb not null,
  rating_score integer not null default 0,
  input_songs json not null,
  created_at timestamptz not null default now()
);

-- add comment to table
comment on table public.ai_suggestion_feedback is 'logs user feedback on the relevance of song suggestions provided by the ai. each row captures the full suggestion set returned by the ai so that users can rate individual entries within the set. the rating_score provides a quick aggregate for analytics while preserving individual ratings in the suggestions json';

-- add comments to columns
comment on column public.ai_suggestion_feedback.id is 'unique identifier for the feedback entry';
comment on column public.ai_suggestion_feedback.user_id is 'the user providing the feedback';
comment on column public.ai_suggestion_feedback.suggestions is 'array of suggestion objects returned by the ai. each object includes title, composer, and an optional user_rating (1 for upvote, -1 for downvote, null when unrated)';
comment on column public.ai_suggestion_feedback.rating_score is 'sum of all user ratings for this suggestion set (1 for each thumbs up, -1 for each thumbs down). used for quick analytics calculations';
comment on column public.ai_suggestion_feedback.input_songs is 'a json object or array containing the list of songs sent to the ai to generate the suggestion set';
comment on column public.ai_suggestion_feedback.created_at is 'timestamp of when the feedback was submitted';

-- create index on user_id for analytics queries
create index ai_suggestion_feedback_user_id_idx on public.ai_suggestion_feedback(user_id);

-- enable row level security
alter table public.ai_suggestion_feedback enable row level security;

-- policy: authenticated users can insert their own feedback
-- note: users cannot view, update, or delete feedback entries to maintain data integrity for analytics
create policy "users can insert their own feedback"
  on public.ai_suggestion_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

