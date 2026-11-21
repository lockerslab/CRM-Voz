-- Piezas mínimas de Supabase para poder probar las migraciones en un Postgres común.
-- Los roles son globales del servidor: se crean solo si no existen.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create schema storage;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql as
  $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema auth, public to anon, authenticated;
-- Igual que Supabase: lo que se crea en public queda accesible a anon/authenticated
-- (la seguridad la ponen RLS y los permisos de cada función).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
