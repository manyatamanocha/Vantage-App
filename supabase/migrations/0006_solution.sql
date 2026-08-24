-- supabase/migrations/0006_solution.sql
-- Additive: the Reveal step now also generates a direct, practical answer to
-- the user's actual question (not just the AI-approach category), so a
-- reload needs somewhere to read it back from rather than re-running the
-- model. Nullable — solves revealed before this migration simply have no
-- persisted solution.
alter table solves add column solution text;
