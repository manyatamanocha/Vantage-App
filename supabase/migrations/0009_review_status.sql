-- supabase/migrations/0009_review_status.sql
-- Until now, both content pools had no real review gate: `flagged` only ever
-- got set *after* a human noticed a bad row already serving to users, and
-- every freshly generated row went live immediately with `flagged = false`
-- by default. This adds a real pending/approved/rejected gate so a human
-- decides before generated content reaches a user, not after.
--
-- Existing rows are backfilled to 'approved' (they're already live and this
-- migration should not silently pull already-serving content) except rows
-- already flagged=true, which become 'rejected' to keep current behavior.
alter table daily_quiz_questions add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));
alter table practice_cases add column review_status text not null default 'pending'
  check (review_status in ('pending', 'approved', 'rejected'));

update daily_quiz_questions set review_status = case when flagged then 'rejected' else 'approved' end;
update practice_cases set review_status = case when flagged then 'rejected' else 'approved' end;
