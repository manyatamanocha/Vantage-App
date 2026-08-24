-- Daily jargon quiz content and the shared human-review flag.
alter table practice_cases add column if not exists flagged boolean not null default false;

create table if not exists daily_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  pool_date date not null default current_date,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  term text not null,
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array')
);

create table if not exists jargon_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references daily_quiz_questions(id) on delete cascade,
  selected_answer text not null,
  correct boolean not null,
  seconds numeric,
  helpful_rating integer check (helpful_rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table daily_quiz_questions enable row level security;
create policy "read unflagged quiz questions" on daily_quiz_questions
  for select to authenticated using (flagged = false);
alter table jargon_attempts enable row level security;
create policy "own jargon attempts" on jargon_attempts for all using (auth.uid() = user_id);

insert into daily_quiz_questions (difficulty, term, question_text, options, correct_answer, explanation)
select v.difficulty, v.term, v.question_text, v.options::jsonb, v.correct_answer, v.explanation
from (values
  ('easy', 'Dashboard', 'What is a dashboard?', '["A screen that shows important information in one place", "A password manager", "A type of database", "A voice assistant"]', 'A screen that shows important information in one place', 'A dashboard puts useful information together so someone can see what is happening quickly.'),
  ('easy', 'KPI', 'What does KPI mean?', '["Key Performance Indicator", "Known Product Input", "Keyboard Prompt Interface", "Knowledge Process Index"]', 'Key Performance Indicator', 'A KPI is a number used to track whether an important goal is being reached.'),
  ('medium', 'API', 'What is an API?', '["A way for software systems to communicate", "A type of spreadsheet", "A design style", "A password policy"]', 'A way for software systems to communicate', 'An API lets one piece of software ask another piece of software for data or an action.'),
  ('medium', 'Prompt', 'What is a prompt?', '["Instructions or a question given to an AI system", "A computer screen", "A sales forecast", "A network cable"]', 'Instructions or a question given to an AI system', 'A prompt tells an AI system what you want it to do and gives it the context it needs.'),
  ('hard', 'LLM', 'What is an LLM?', '["A language model trained on a large amount of text", "A file storage system", "A fraud score", "A reporting dashboard"]', 'A language model trained on a large amount of text', 'An LLM is a model that learned patterns in language and can produce or work with text.'),
  ('hard', 'Algorithm', 'What is an algorithm?', '["A step-by-step method for solving a problem", "A company database", "A type of email", "A user account"]', 'A step-by-step method for solving a problem', 'An algorithm is a repeatable set of steps that turns an input into an outcome.')
) as v(difficulty, term, question_text, options, correct_answer, explanation)
where not exists (select 1 from daily_quiz_questions);
