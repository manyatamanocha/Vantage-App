-- supabase/migrations/0008_avatar_url.sql
-- Avatar data URLs (up to 500KB base64) were previously written into
-- auth.users.user_metadata, which Supabase embeds in the session JWT/cookie —
-- bloating it enough to trip ERR_RESPONSE_HEADERS_TOO_BIG on every request.
-- Moving it into user_settings keeps it out of the cookie entirely.
alter table user_settings add column avatar_url text;
