-- Usage analytics: lightweight event log for the /admin/analytics dashboard.
-- Deliberately no product-analytics vendor (Mixpanel etc.) — an admin-viewable
-- event table satisfies the same need with no new service/dependency.
create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_name_idx on analytics_events (event_name);
create index if not exists analytics_events_created_at_idx on analytics_events (created_at);

alter table analytics_events enable row level security;
-- No select/insert policies for anon/authenticated: written only via the
-- service-role admin client (lib/supabase/admin.ts), read only via the same
-- client from the /admin/analytics page — same pattern as practice_cases.
