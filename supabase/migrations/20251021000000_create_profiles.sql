-- migration: create_profiles
-- description: creates the profiles table to extend auth.users with application-specific data
-- affected tables: public.profiles
-- dependencies: auth.users (supabase managed)

-- create the profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz,
  has_completed_onboarding boolean not null default false
);

-- add comment to table
comment on table public.profiles is 'extends auth.users with application-specific public data for each user';

-- add comments to columns
comment on column public.profiles.id is 'corresponds to the id in the auth.users table';
comment on column public.profiles.updated_at is 'timestamp of the last profile update';
comment on column public.profiles.has_completed_onboarding is 'flag to track if the user has seen the new user onboarding modal';

-- enable row level security
alter table public.profiles enable row level security;

-- policy: authenticated users can select their own profile
create policy "authenticated users can select their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- policy: authenticated users can insert their own profile
create policy "authenticated users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- policy: authenticated users can update their own profile
create policy "authenticated users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- policy: authenticated users can delete their own profile
-- note: this policy exists for completeness, but cascade deletion from auth.users will typically handle profile deletion
create policy "authenticated users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

