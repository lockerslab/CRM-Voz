-- Después de migrar: ¿los datos actuales quedaron intactos y con su empresa personal?
\ir helpers.sql
create temp table u (name text primary key, id uuid not null);
insert into u values
  ('L1','a0000000-0000-4000-8000-000000000001'), ('L2','a0000000-0000-4000-8000-000000000002'),
  ('L3','a0000000-0000-4000-8000-000000000003'), ('L4','a0000000-0000-4000-8000-000000000004'),
  ('L5','a0000000-0000-4000-8000-000000000005');
create function pg_temp.as(n text) returns void language plpgsql security definer as $$
begin perform set_config('request.jwt.claim.sub', (select id::text from pg_temp.u where name = n), false); end $$;

select pg_temp.eq('datos intactos: contactos (cantidad)', (select count(*) from public.contacts), (select n from public._snap where t='contacts'));
select pg_temp.eq('datos intactos: contactos (mismos ids)', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.contacts), (select h from public._snap where t='contacts'));
select pg_temp.eq('datos intactos: notas', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.interactions), (select h from public._snap where t='interactions'));
select pg_temp.eq('datos intactos: tareas', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.tasks), (select h from public._snap where t='tasks'));
select pg_temp.eq('usuarios sin cambios', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from auth.users), (select h from public._snap where t='users'));

select pg_temp.eq('cada usuario tiene su espacio personal', (select count(*) from public.memberships where is_personal), (select count(*) from auth.users));
select pg_temp.eq('y es el dueño', (select count(*) from public.memberships where is_personal and role = 'owner'), (select count(*) from auth.users));
select pg_temp.eq('ninguna empresa común creada', (select count(*) from public.organizations where not is_personal), 0::bigint);
select pg_temp.eq('contactos en la empresa personal de su dueño', (select count(*) from public.contacts c join public.memberships m on m.user_id = c.user_id and m.is_personal where c.org_id <> m.org_id), 0::bigint);
select pg_temp.eq('notas en la empresa personal de su dueño', (select count(*) from public.interactions c join public.memberships m on m.user_id = c.user_id and m.is_personal where c.org_id <> m.org_id), 0::bigint);
select pg_temp.eq('tareas en la empresa personal de su dueño', (select count(*) from public.tasks c join public.memberships m on m.user_id = c.user_id and m.is_personal where c.org_id <> m.org_id), 0::bigint);
select pg_temp.eq('nombre del espacio (con email)', (select o.name from public.organizations o join public.memberships m on m.org_id = o.id where m.user_id = (select id from u where name='L1')), 'Espacio de l1');
select pg_temp.eq('nombre del espacio (con nombre)', (select o.name from public.organizations o join public.memberships m on m.org_id = o.id where m.user_id = (select id from u where name='L2')), 'Espacio de Lucía Pérez');
select pg_temp.eq('nombre del espacio (usuario viejo sin perfil)', (select o.name from public.organizations o join public.memberships m on m.org_id = o.id where m.user_id = (select id from u where name='L4')), 'Espacio de l4');
select pg_temp.eq('nombre del espacio (sin email ni nombre)', (select o.name from public.organizations o join public.memberships m on m.org_id = o.id where m.user_id = (select id from u where name='L5')), 'Espacio de usuario');
select pg_temp.denied('org_id es obligatorio en contactos', $$insert into public.contacts(user_id, name) values ((select id from u where name='L1'), 'sin empresa')$$);

-- Como usuarios reales (con sesión iniciada): todo sigue igual que antes
set role authenticated;
select pg_temp.as('L1');
select pg_temp.eq('L1 ve sus 3 contactos', (select count(*) from public.contacts), 3::bigint);
select pg_temp.eq('L1 ve sus 2 tareas', (select count(*) from public.tasks), 2::bigint);
select pg_temp.eq('L1 ve sus 2 notas', (select count(*) from public.interactions), 2::bigint);
select pg_temp.eq('L1 no ve nada de L2', (select count(*) from public.contacts where name like 'L2%'), 0::bigint);
select pg_temp.as('L2');
select pg_temp.eq('L2 ve sus 2 contactos', (select count(*) from public.contacts), 2::bigint);
select pg_temp.eq('L2 ve sus 2 tareas (incluida la suelta)', (select count(*) from public.tasks), 2::bigint);
select pg_temp.as('L3');
select pg_temp.eq('L3 (sin datos) no ve nada', (select count(*) from public.contacts), 0::bigint);

-- Los flujos de la app siguen funcionando
select pg_temp.as('L1');
create temp table r1 as select public.save_note(jsonb_build_object('action','create','contact_name','Nuevo L1','transcript','hola','audioPath','a0000000-0000-4000-8000-000000000001/x.webm','task_title','Llamar','due_at','2026-12-01T10:00:00-03:00')) as r;
reset role;
select pg_temp.ok('save_note crea el contacto en el espacio personal de L1', exists (select 1 from public.contacts c join public.memberships m on m.org_id = c.org_id where c.name = 'Nuevo L1' and m.user_id = (select id from u where name='L1') and m.is_personal));
select pg_temp.ok('save_note crea la tarea con empresa', exists (select 1 from public.tasks where title = 'Llamar' and org_id is not null));
select pg_temp.ok('save_note crea la nota con empresa', exists (select 1 from public.interactions where transcript = 'hola' and org_id is not null));
set role authenticated;
select pg_temp.as('L1');
select pg_temp.allowed('save_note actualiza un contacto propio', format($f$select public.save_note(jsonb_build_object('action','update','contact_id','%s','stage','meeting','transcript','otra','audioPath','a0000000-0000-4000-8000-000000000001/y.webm'))$f$, (select (r->>'contact_id') from r1)));
select pg_temp.eq('mover de etapa (como hace el tablero)', pg_temp.rows($$update public.contacts set stage = 'won' where name = 'L1-c1'$$), 1);
select pg_temp.eq('tildar una tarea (como hace la lista)', pg_temp.rows($$update public.tasks set completed = true where title = 'tarea L1-c1'$$), 1);
select pg_temp.as('L2');
select pg_temp.eq('L2 no puede tocar contactos de L1', pg_temp.rows($$update public.contacts set stage = 'lost' where name like 'L1%'$$), 0);
reset role;

-- Usuario nuevo: perfil + espacio personal automáticos
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-0000000000ff', 'nuevo@test');
select pg_temp.ok('alta nueva: se crea el perfil', exists (select 1 from public.profiles where id = 'a0000000-0000-4000-8000-0000000000ff'));
select pg_temp.eq('alta nueva: espacio personal', (select o.name from public.organizations o join public.memberships m on m.org_id = o.id where m.user_id = 'a0000000-0000-4000-8000-0000000000ff' and m.is_personal and m.role = 'owner'), 'Espacio de nuevo');
