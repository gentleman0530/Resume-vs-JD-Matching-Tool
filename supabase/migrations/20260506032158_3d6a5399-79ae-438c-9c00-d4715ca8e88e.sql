
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Job analyses (one per JD upload batch)
create table public.job_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Analysis',
  job_description text not null,
  requirements jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.job_analyses enable row level security;
create policy "own analyses select" on public.job_analyses for select using (auth.uid() = user_id);
create policy "own analyses insert" on public.job_analyses for insert with check (auth.uid() = user_id);
create policy "own analyses update" on public.job_analyses for update using (auth.uid() = user_id);
create policy "own analyses delete" on public.job_analyses for delete using (auth.uid() = user_id);

-- Candidates (one per resume in an analysis)
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.job_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  candidate_name text,
  email text,
  phone text,
  education jsonb,
  experience jsonb,
  skills jsonb,
  certifications jsonb,
  score numeric,
  skill_match jsonb,
  strengths jsonb,
  gaps jsonb,
  summary text,
  years_experience numeric,
  raw_text text,
  created_at timestamptz not null default now()
);
alter table public.candidates enable row level security;
create policy "own candidates select" on public.candidates for select using (auth.uid() = user_id);
create policy "own candidates insert" on public.candidates for insert with check (auth.uid() = user_id);
create policy "own candidates update" on public.candidates for update using (auth.uid() = user_id);
create policy "own candidates delete" on public.candidates for delete using (auth.uid() = user_id);

create index on public.candidates (analysis_id);
create index on public.job_analyses (user_id, created_at desc);
