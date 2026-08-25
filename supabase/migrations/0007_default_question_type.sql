-- supabase/migrations/0007_default_question_type.sql
-- Additive: lets a user pick which practice mode ("Scenario based question"
-- vs "Quiz") their Home screen's Quiz-time card and quick-practice links
-- take them to by default, instead of always going to the same one
-- regardless of preference.
alter table user_settings add column default_question_type text not null default 'scenario'
  check (default_question_type in ('scenario', 'quiz'));
