-- supabase/migrations/0002_reveal_reasoning.sql
-- Additive: the Reveal step generates comparative reasoning that 0001 had nowhere
-- to store, so a reload showed the verdict with the explanation missing. Both
-- columns are nullable — solves revealed before this migration keep their verdict
-- and simply have no persisted reasoning.
-- `why_not_alternatives` holds [{ "category": text, "reason": text }, ...]; jsonb
-- because it is a small structured list read back whole, never joined or indexed.
alter table solves add column why_it_fits text;
alter table solves add column why_not_alternatives jsonb;
