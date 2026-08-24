-- supabase/migrations/0006_solution.sql
-- Additive: the live Solve flow's second (and now final) step generates a
-- direct, practical answer to the user's actual question — structured (an
-- overview, the tools involved, a numbered step-by-step guide, pro tips),
-- not just a paragraph — so a reload needs somewhere to read the whole
-- thing back from rather than re-running the model. jsonb because it's a
-- small structured document read back whole, never queried into. Nullable —
-- solves from before this migration simply have no persisted solution.
alter table solves add column solution jsonb;
