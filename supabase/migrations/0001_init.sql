-- supabase/migrations/0001_init.sql
create table solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('live', 'practice')),
  raw_input text not null,
  industry text,
  goal text,
  problem_type text,
  guessed_category text,
  revealed_category text,
  tool_class text,
  correct boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table takeaways (
  id uuid primary key default gen_random_uuid(),
  solve_id uuid not null references solves(id) on delete cascade,
  draft_text text not null,
  generated_at timestamptz not null default now()
);

create table practice_cases (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  industry text,
  difficulty text not null default 'medium',
  active boolean not null default true
);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  practice_difficulty text not null default 'medium',
  practice_frequency text not null default 'daily'
);

alter table solves enable row level security;
alter table takeaways enable row level security;
alter table user_settings enable row level security;

create policy "own solves" on solves for all using (auth.uid() = user_id);
create policy "own takeaways" on takeaways for all using (
  auth.uid() = (select user_id from solves where solves.id = takeaways.solve_id)
);
create policy "own settings" on user_settings for all using (auth.uid() = user_id);
