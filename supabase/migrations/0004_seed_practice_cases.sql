-- supabase/migrations/0004_seed_practice_cases.sql
-- Additive, data-only: `practice_cases` was created by 0001_init.sql but nothing
-- anywhere ever put a row in it — no seed file, no admin screen, no app write
-- path. `getTodaysPracticeCase` therefore threw on every fresh environment and
-- the whole daily-practice loop was unreachable.
--
-- Eleven curated scenarios, deliberately spread across the difficulty range the
-- settings screen offers (easy / medium / hard) and across the AI-approach
-- categories in lib/engine/taxonomy.ts, so the reveal engine has something to
-- distinguish between and a user changing their difficulty preference sees a
-- genuinely different pool. The correct category is intentionally NOT stored:
-- the same shared `recommendCategory` engine that judges live client problems
-- judges these too, so practice cannot drift away from the real thing.
--
-- Guarded on the table being empty rather than written as a plain INSERT, so
-- re-running the file (or applying it to an environment that has already been
-- seeded, by hand or otherwise) cannot silently double the pool. `difficulty`
-- and `active` are left to the column defaults where they match.
insert into practice_cases (raw_input, industry, difficulty)
select v.raw_input, v.industry, v.difficulty
from (values
  -- easy: one dominant reading, little to argue with
  (
    'An online marketplace wants every incoming product review sorted into genuine or fake before it goes live on the listing.'::text,
    'Retail'::text,
    'easy'::text
  ),
  (
    'A law firm''s partners want a one-page brief of each forty-page deposition transcript waiting for them before the morning meeting.',
    'Legal',
    'easy'
  ),
  (
    'A marketing agency wants first-draft social captions written for each new product photo its client uploads.',
    'Marketing',
    'easy'
  ),

  -- medium: a plausible wrong answer sits next to the right one
  (
    'A hospital network''s nurses need answers to policy questions drawn from its own nine-hundred-page clinical handbook, with the source page shown alongside.',
    'Healthcare',
    'medium'
  ),
  (
    'A subscription fitness app wants to know which members are likely to cancel in the next thirty days, so the retention team can reach out before they do.',
    'Fitness',
    'medium'
  ),
  (
    'A logistics firm receives supplier invoices as scanned PDFs and wants the line items, totals and due dates pulled out into its accounting system.',
    'Logistics',
    'medium'
  ),
  (
    'A regional grocery chain wants its app to suggest what each shopper is likely to want to add to their basket next.',
    'Grocery',
    'medium'
  ),

  -- hard: the obvious first instinct is usually the wrong one
  (
    'A payments processor wants unusual transaction patterns surfaced for human review without maintaining a fixed list of known fraud types.',
    'Financial services',
    'hard'
  ),
  (
    'A manufacturer''s field engineers ask questions mid-repair and need answers grounded in that specific machine''s maintenance manuals and its past service tickets.',
    'Manufacturing',
    'hard'
  ),
  (
    'An insurer wants incoming claims routed to the right specialist team the moment they arrive, working only from the claimant''s free-text description.',
    'Insurance',
    'hard'
  ),
  (
    'An energy utility wants to know which transformers on its grid are most likely to fail this quarter, from years of sensor readings.',
    'Energy',
    'hard'
  )
) as v(raw_input, industry, difficulty)
where not exists (select 1 from practice_cases);
