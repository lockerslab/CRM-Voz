-- Después de la MARCHA ATRÁS: vuelve el modelo anterior y no se perdió ningún dato.
\ir helpers.sql
create temp table u (name text primary key, id uuid not null);
insert into u values ('L1','a0000000-0000-4000-8000-000000000001'), ('L2','a0000000-0000-4000-8000-000000000002');
create function pg_temp.as(n text) returns void language plpgsql security definer as $$
begin perform set_config('request.jwt.claim.sub', (select id::text from pg_temp.u where name = n), false); end $$;

select pg_temp.ok('las tablas de empresas ya no existen', to_regclass('public.organizations') is null and to_regclass('public.memberships') is null);
select pg_temp.eq('contactos sin columna org_id', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'org_id'), 0::bigint);
select pg_temp.eq('no se perdió ningún contacto', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.contacts), (select h from public._snap_pre where t = 'contacts'));
select pg_temp.eq('no se perdió ninguna nota', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.interactions), (select h from public._snap_pre where t = 'interactions'));
select pg_temp.eq('no se perdió ninguna tarea', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.tasks), (select h from public._snap_pre where t = 'tasks'));
select pg_temp.eq('quedan las 4 reglas originales de contactos', (select count(*) from pg_policies where tablename = 'contacts' and policyname like '%_own'), 4::bigint);
select pg_temp.eq('no queda ninguna regla nueva', (select count(*) from pg_policies where tablename in ('contacts','tasks','interactions') and policyname in ('contacts_select','tasks_select','interactions_select','contacts_update')), 0::bigint);

set role authenticated;
select pg_temp.as('L1');
select pg_temp.ok('L1 ve sus contactos (modelo anterior)', (select count(*) from public.contacts) >= 3);
select pg_temp.eq('L1 no ve los de L2', (select count(*) from public.contacts where name like 'L2%'), 0::bigint);
select pg_temp.allowed('save_note anterior funciona', format($f$select public.save_note(jsonb_build_object('action','create','contact_name','Post marcha atrás','transcript','hola','audioPath','a0000000-0000-4000-8000-000000000001/z.webm'))$f$));
select pg_temp.as('L2');
select pg_temp.eq('L2 no puede tocar lo de L1', pg_temp.rows($$update public.contacts set stage = 'lost' where name like 'L1%'$$), 0);
reset role;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-0000000000ee', 'post@test');
select pg_temp.ok('alta nueva: perfil sí, empresas no (como antes)', exists (select 1 from public.profiles where id = 'a0000000-0000-4000-8000-0000000000ee'));
