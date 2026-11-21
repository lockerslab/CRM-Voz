-- RENDIMIENTO: con 10.000 contactos en una empresa, el tablero tiene que seguir siendo rápido.
-- Se corre sobre la base que ya tiene el escenario de 30_roles_matrix.sql.
\ir helpers.sql
create temp table u as select upper(split_part(email, '@', 1)) as name, id from auth.users;
create function pg_temp.as(n text) returns void language plpgsql security definer as $$
begin perform set_config('request.jwt.claim.sub', (select id::text from pg_temp.u where name = n), false); end $$;
create function pg_temp.uid(n text) returns uuid language sql security definer as $$ select id from pg_temp.u where name = n $$;
create function pg_temp.ms(q text) returns numeric language plpgsql as $$
declare t0 timestamptz := clock_timestamp(); begin execute q; return round(extract(epoch from clock_timestamp() - t0) * 1000, 1); end $$;
create function pg_temp.fast(label text, q text, max_ms numeric) returns void language plpgsql as $$
declare ms numeric; begin
  ms := pg_temp.ms(q);                -- primera vez
  ms := least(ms, pg_temp.ms(q));     -- mejor de dos
  if ms <= max_ms then raise notice 'OK   % (% ms, límite % ms)', label, ms, max_ms;
  else raise notice 'FAIL % (% ms, límite % ms)', label, ms, max_ms; end if;
end $$;

-- Datos: 10.000 contactos en la empresa A (repartidos entre 8 personas) + 3.000 en la B
insert into public.contacts(user_id, org_id, name, stage)
select (select id from u where name = (array['O','AD','M1','M2','S1','S2','S3','SX'])[1 + g % 8]),
       (select id from public.organizations where name = 'Empresa A'), 'perf-A-' || g, 'cold_lead'
  from generate_series(1, 10000) g;
insert into public.contacts(user_id, org_id, name, stage)
select (select id from u where name = (array['BA','B1'])[1 + g % 2]),
       (select id from public.organizations where name = 'Empresa B'), 'perf-B-' || g, 'cold_lead'
  from generate_series(1, 3000) g;
insert into public.tasks(user_id, org_id, contact_id, title, due_date)
select user_id, org_id, id, 'tarea', now() + random() * interval '30 days' from public.contacts where name like 'perf-%';
insert into public.interactions(user_id, org_id, contact_id, transcript)
select user_id, org_id, id, 'nota' from public.contacts where name like 'perf-%';
analyze public.contacts; analyze public.tasks; analyze public.interactions; analyze public.memberships;

set role authenticated;
select pg_temp.as('S1');
select pg_temp.fast('vendedor: cargar su tablero (contactos)', 'select * from public.contacts order by position, updated_at desc', 400);
select pg_temp.fast('vendedor: sus tareas abiertas', 'select * from public.tasks where completed = false order by due_date', 400);
select pg_temp.as('M1');
select pg_temp.fast('gerente: contactos de su equipo', 'select * from public.contacts order by position, updated_at desc', 800);
select pg_temp.fast('gerente: tareas de su equipo', 'select * from public.tasks where completed = false order by due_date', 800);
select pg_temp.as('AD');
select pg_temp.fast('administrador: toda la empresa (10.000 contactos)', 'select * from public.contacts order by position, updated_at desc', 2500);
select pg_temp.fast('administrador: contar contactos', 'select count(*) from public.contacts', 1500);
select pg_temp.fast('administrador: tareas abiertas de toda la empresa', 'select * from public.tasks where completed = false order by due_date', 2500);
select pg_temp.as('B1');
select pg_temp.fast('otra empresa con datos de ruido al lado', 'select * from public.contacts order by position, updated_at desc', 800);
select pg_temp.as('S1');
select pg_temp.allowed('mover una tarjeta de etapa (UPDATE)', $$update public.contacts set stage = 'meeting' where id = (select id from public.contacts limit 1)$$);
select pg_temp.fast('guardar una nota (save_note) con la base grande', format($f$select public.save_note(jsonb_build_object('action','create','contact_name','Perf','transcript','x','audioPath','%s/p.webm','task_title','t','due_at','2026-12-01T10:00:00-03:00'))$f$, pg_temp.uid('S1')), 300);
reset role;
