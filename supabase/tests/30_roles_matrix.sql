-- MATRIZ DE ROLES Y ESPIONAJE: dos empresas, varios roles, todos intentando ver o
-- hacer lo que no deberían. Cada línea imprime OK o FAIL.
--
--   Empresa A:  O (dueño), AD (admin), M1 y M2 (gerentes),
--               S1 y S2 (vendedores de M1), S3 (vendedor de M2), SX (sin gerente)
--   Empresa B:  BA (admin), B1 (vendedor)
--   OU: usuario sin empresa (solo espacio personal)
\ir helpers.sql

create temp table u (name text primary key, id uuid not null);
insert into u(name, id)
select n, ('b0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid
  from unnest(array['O','AD','M1','M2','S1','S2','S3','SX','BA','B1','OU']) with ordinality as t(n, i);
create temp table o (name text primary key, id uuid not null default gen_random_uuid());
insert into o(name) values ('A'), ('B');
create function pg_temp.as(n text) returns void language plpgsql security definer as $$
begin perform set_config('request.jwt.claim.sub', (select id::text from pg_temp.u where name = n), false); end $$;
create function pg_temp.uid(n text) returns uuid language sql security definer as $$ select id from pg_temp.u where name = n $$;
create function pg_temp.oid(n text) returns uuid language sql security definer as $$ select id from pg_temp.o where name = n $$;

-- ---------- Armado del escenario (como administrador de la base) ----------
insert into auth.users(id, email) select id, lower(name) || '@test' from u;      -- cada uno recibe su espacio personal
insert into public.organizations(id, name) select id, 'Empresa ' || name from o;
insert into public.memberships(org_id, user_id, role)
  select pg_temp.oid('A'), pg_temp.uid(v.n), v.r::public.org_role
  from (values ('O','owner'),('AD','admin'),('M1','manager'),('M2','manager')) v(n, r);
insert into public.memberships(org_id, user_id, role, manager_id)
  select pg_temp.oid('A'), pg_temp.uid(v.n), 'seller', pg_temp.uid(v.m)
  from (values ('S1','M1'),('S2','M1'),('S3','M2')) v(n, m);
insert into public.memberships(org_id, user_id, role) values (pg_temp.oid('A'), pg_temp.uid('SX'), 'seller');
insert into public.memberships(org_id, user_id, role) values (pg_temp.oid('B'), pg_temp.uid('BA'), 'admin');
insert into public.memberships(org_id, user_id, role, manager_id) values (pg_temp.oid('B'), pg_temp.uid('B1'), 'seller', pg_temp.uid('BA'));

do $$
declare r record; v_org uuid; v_pers uuid; v_c uuid; i int; k int;
begin
  for r in select * from pg_temp.u where name in ('O','AD','M1','M2','S1','S2','S3','SX','BA','B1') loop
    v_org := case when r.name in ('BA','B1') then pg_temp.oid('B') else pg_temp.oid('A') end;
    k := case when r.name = 'BA' then 1 else 2 end;
    for i in 1..k loop
      insert into public.contacts(user_id, org_id, name) values (r.id, v_org, r.name || '-c' || i) returning id into v_c;
      insert into public.tasks(user_id, org_id, contact_id, title) values (r.id, v_org, v_c, 'T ' || r.name || '-c' || i);
      insert into public.interactions(user_id, org_id, contact_id, transcript) values (r.id, v_org, v_c, 'N ' || r.name || '-c' || i);
    end loop;
  end loop;
  for r in select * from pg_temp.u loop
    select org_id into v_pers from public.memberships where user_id = r.id and is_personal;
    insert into public.contacts(user_id, org_id, name) values (r.id, v_pers, r.name || '-p') returning id into v_c;
    insert into public.tasks(user_id, org_id, contact_id, title) values (r.id, v_pers, v_c, 'T ' || r.name || '-p');
    insert into public.interactions(user_id, org_id, contact_id, transcript) values (r.id, v_pers, v_c, 'N ' || r.name || '-p');
  end loop;
end $$;

set role authenticated;

-- ============ 1) ¿QUIÉN VE QUÉ? ============
select pg_temp.as('S1');
select pg_temp.eq('vendedor S1: ve solo lo suyo', (select string_agg(name, ',' order by name) from public.contacts), 'S1-c1,S1-c2,S1-p');
select pg_temp.eq('vendedor S1: tareas', (select count(*) from public.tasks), 3::bigint);
select pg_temp.eq('vendedor S1: notas', (select count(*) from public.interactions), 3::bigint);
select pg_temp.as('SX');
select pg_temp.eq('vendedor SX (sin gerente): solo lo suyo', (select count(*) from public.contacts), 3::bigint);
select pg_temp.as('M1');
select pg_temp.eq('gerente M1: lo suyo + su equipo (S1 y S2), sin su espacio personal', (select string_agg(name, ',' order by name) from public.contacts), 'M1-c1,M1-c2,M1-p,S1-c1,S1-c2,S2-c1,S2-c2');
select pg_temp.eq('gerente M1: tareas de su equipo', (select count(*) from public.tasks), 7::bigint);
select pg_temp.eq('gerente M1: no ve a S3 (equipo de M2)', (select count(*) from public.contacts where name like 'S3%'), 0::bigint);
select pg_temp.eq('gerente M1: no ve a SX (sin gerente)', (select count(*) from public.contacts where name like 'SX%'), 0::bigint);
select pg_temp.as('M2');
select pg_temp.eq('gerente M2: lo suyo + S3', (select string_agg(name, ',' order by name) from public.contacts), 'M2-c1,M2-c2,M2-p,S3-c1,S3-c2');
select pg_temp.as('AD');
select pg_temp.eq('administrador: TODA la empresa A (16) + su espacio personal (1)', (select count(*) from public.contacts), 17::bigint);
select pg_temp.eq('administrador: NO ve espacios personales de otros', (select count(*) from public.contacts where name like '%-p' and name <> 'AD-p'), 0::bigint);
select pg_temp.eq('administrador: no ve nada de la empresa B', (select count(*) from public.contacts where name in ('BA-c1','B1-c1','B1-c2')), 0::bigint);
select pg_temp.eq('administrador: ve las notas de toda la empresa', (select count(*) from public.interactions), 17::bigint);
select pg_temp.as('O');
select pg_temp.eq('dueño: igual que administrador', (select count(*) from public.contacts), 17::bigint);
select pg_temp.as('BA');
select pg_temp.eq('admin de B: su empresa + su espacio, nada de A', (select string_agg(name, ',' order by name) from public.contacts), 'B1-c1,B1-c2,BA-c1,BA-p');
select pg_temp.as('B1');
select pg_temp.eq('vendedor de B: solo lo suyo', (select string_agg(name, ',' order by name) from public.contacts), 'B1-c1,B1-c2,B1-p');
select pg_temp.as('OU');
select pg_temp.eq('usuario sin empresa: solo su espacio personal', (select string_agg(name, ',' order by name) from public.contacts), 'OU-p');

-- ============ 2) INTENTOS DE COLARSE ============
select pg_temp.as('S1');
select pg_temp.denied('S1 crea contacto en la empresa B', format($f$insert into public.contacts(user_id, org_id, name) values ('%s','%s','intruso')$f$, pg_temp.uid('S1'), pg_temp.oid('B')));
select pg_temp.denied('S1 crea contacto a nombre de S2', format($f$insert into public.contacts(user_id, org_id, name) values ('%s','%s','a nombre de otro')$f$, pg_temp.uid('S2'), pg_temp.oid('A')));
select pg_temp.allowed('S1 crea un contacto propio en su empresa', format($f$insert into public.contacts(user_id, org_id, name) values ('%s','%s','S1-nuevo')$f$, pg_temp.uid('S1'), pg_temp.oid('A')));
select pg_temp.denied('S1 agrega una nota a un contacto de S2', format($f$insert into public.interactions(user_id, org_id, contact_id, transcript) values ('%s','%s',(select id from public.contacts where name = 'S2-c1'),'x')$f$, pg_temp.uid('S1'), pg_temp.oid('A')));
select pg_temp.eq('S1 no puede ni ver el contacto de S2 para colgarle algo', (select count(*) from public.contacts where name = 'S2-c1'), 0::bigint);
select pg_temp.denied('S1 cambia la empresa de su contacto a B', $$update public.contacts set org_id = (select id from public.organizations where name = 'Empresa B') where name = 'S1-c1'$$);
select pg_temp.eq('S1 intenta editar un contacto de S2: 0 filas', pg_temp.rows($$update public.contacts set stage = 'lost' where name like 'S2%'$$), 0);
select pg_temp.eq('S1 intenta borrar un contacto de S2: 0 filas', pg_temp.rows($$delete from public.contacts where name like 'S2%'$$), 0);
select pg_temp.eq('S1 intenta completar una tarea de S2: 0 filas', pg_temp.rows($$update public.tasks set completed = true where title like 'T S2%'$$), 0);
-- una nota "de la empresa A" sobre un contacto que vive en el espacio personal
reset role;
insert into public.contacts(user_id, org_id, name) select pg_temp.uid('S1'), org_id, 'S1-personal-2' from public.memberships where user_id = pg_temp.uid('S1') and is_personal;
set role authenticated;
select pg_temp.as('S1');
select pg_temp.denied('nota con empresa A sobre un contacto del espacio personal (no coinciden)', format($f$insert into public.interactions(user_id, org_id, contact_id, transcript) values ('%s','%s',(select id from public.contacts where name = 'S1-personal-2'),'x')$f$, pg_temp.uid('S1'), pg_temp.oid('A')));
select pg_temp.denied('tarea con empresa A sobre un contacto del espacio personal', format($f$insert into public.tasks(user_id, org_id, contact_id, title) values ('%s','%s',(select id from public.contacts where name = 'S1-personal-2'),'x')$f$, pg_temp.uid('S1'), pg_temp.oid('A')));

-- ============ 3) REASIGNAR CONTACTOS ============
select pg_temp.as('AD');
select pg_temp.eq('admin reasigna S1-c1 a S3 (misma empresa)', pg_temp.rows(format($f$update public.contacts set user_id = '%s' where name = 'S1-c1'$f$, pg_temp.uid('S3'))), 1);
select pg_temp.denied('admin reasigna a alguien de OTRA empresa (B1)', format($f$update public.contacts set user_id = '%s' where name = 'S1-c2'$f$, pg_temp.uid('B1')));
select pg_temp.as('M1');
select pg_temp.eq('gerente M1 reasigna S2-c1 a S1 (su equipo)', pg_temp.rows(format($f$update public.contacts set user_id = '%s' where name = 'S2-c1'$f$, pg_temp.uid('S1'))), 1);
select pg_temp.denied('gerente M1 reasigna a S3 (equipo de otro gerente)', format($f$update public.contacts set user_id = '%s' where name = 'S1-c2'$f$, pg_temp.uid('S3')));
select pg_temp.as('S1');
select pg_temp.denied('vendedor S1 regala su contacto a S2', format($f$update public.contacts set user_id = '%s' where name = 'S1-c2'$f$, pg_temp.uid('S2')));
select pg_temp.as('M2');
select pg_temp.ok('tras reasignar, M2 ve S1-c1 (ahora es de S3)', exists (select 1 from public.contacts where name = 'S1-c1'));
select pg_temp.as('M1');
select pg_temp.ok('y M1 ya NO lo ve', not exists (select 1 from public.contacts where name = 'S1-c1'));

-- ============ 4) BORRAR ============
select pg_temp.as('S1');
select pg_temp.eq('vendedor borra su propio contacto', pg_temp.rows($$delete from public.contacts where name = 'S1-nuevo'$$), 1);
select pg_temp.as('M1');
select pg_temp.eq('gerente NO puede borrar contactos de su equipo (solo verlos)', pg_temp.rows($$delete from public.contacts where name = 'S2-c2'$$), 0);
select pg_temp.as('AD');
select pg_temp.eq('administrador sí puede borrar contactos de la empresa', pg_temp.rows($$delete from public.contacts where name = 'S2-c2'$$), 1);

-- ============ 5) PERSONA DESACTIVADA ============
reset role;
update public.memberships set status = 'disabled' where user_id = pg_temp.uid('SX') and not is_personal;
set role authenticated;
select pg_temp.as('SX');
select pg_temp.eq('desactivado SX: pierde la empresa, conserva solo su espacio personal', (select string_agg(name, ',' order by name) from public.contacts), 'SX-p');
select pg_temp.denied('desactivado SX: no puede crear en la empresa', format($f$insert into public.contacts(user_id, org_id, name) values ('%s','%s','x')$f$, pg_temp.uid('SX'), pg_temp.oid('A')));
select pg_temp.as('AD');
select pg_temp.ok('los datos de SX siguen en la empresa (el admin los ve)', exists (select 1 from public.contacts where name = 'SX-c1'));
select pg_temp.denied('no se puede reasignar a una persona desactivada', format($f$update public.contacts set user_id = '%s' where name = 'S3-c1'$f$, pg_temp.uid('SX')));

-- ============ 6) MIEMBROS Y EMPRESAS ============
select pg_temp.as('S1');
select pg_temp.eq('vendedor: ve solo sus propias membresías (personal + empresa)', (select count(*) from public.memberships), 2::bigint);
select pg_temp.eq('vendedor: ve sus empresas (personal + A), no B', (select count(*) from public.organizations), 2::bigint);
select pg_temp.eq('vendedor intenta ascenderse a admin: 0 filas', pg_temp.rows($$update public.memberships set role = 'admin' where user_id = (select auth.uid())$$), 0);
select pg_temp.denied('vendedor intenta sumarse a la empresa B', format($f$insert into public.memberships(org_id, user_id, role) values ('%s','%s','admin')$f$, pg_temp.oid('B'), pg_temp.uid('S1')));
select pg_temp.eq('vendedor intenta borrar membresías: 0 filas', pg_temp.rows($$delete from public.memberships$$), 0);
select pg_temp.eq('vendedor intenta renombrar la empresa: 0 filas', pg_temp.rows($$update public.organizations set name = 'hackeada'$$), 0);
select pg_temp.denied('vendedor intenta crear una empresa', $$insert into public.organizations(name) values ('mi empresa')$$);
select pg_temp.as('M1');
select pg_temp.eq('gerente (en esta etapa): solo sus propias membresías', (select count(*) from public.memberships), 2::bigint);
select pg_temp.as('AD');
select pg_temp.eq('admin: ve a todos los miembros de su empresa (8) + su espacio', (select count(*) from public.memberships), 9::bigint);
select pg_temp.as('BA');
select pg_temp.eq('admin de B: no ve miembros de A', (select count(*) from public.memberships where org_id = pg_temp.oid('A')), 0::bigint);

-- ============ 7) SIN SESIÓN (anon) ============
reset role;
set role anon;
select pg_temp.eq('sin sesión: no ve contactos', (select count(*) from public.contacts), 0::bigint);
select pg_temp.eq('sin sesión: no ve miembros', (select count(*) from public.memberships), 0::bigint);
select pg_temp.denied('sin sesión: no puede usar las funciones de permisos', format($f$select public.can_see_user('%s','%s')$f$, pg_temp.oid('A'), pg_temp.uid('S1')));
select pg_temp.denied('sin sesión: no puede llamar a save_note', $$select public.save_note('{}'::jsonb)$$);
reset role;

-- ============ 8) REGLAS DE LA BASE (aunque alguien tenga acceso total) ============
select pg_temp.denied('un vendedor no puede tener dos empresas', format($f$insert into public.memberships(org_id, user_id, role) values ('%s','%s','seller')$f$, pg_temp.oid('B'), pg_temp.uid('S1')));
select pg_temp.denied('nadie puede tener dos espacios personales', format($f$insert into public.memberships(org_id, user_id, role) select (select id from public.organizations where is_personal limit 1), '%s', 'owner'$f$, pg_temp.uid('OU')));
select pg_temp.denied('el gerente de alguien debe ser de su misma empresa', format($f$update public.memberships set manager_id = '%s' where user_id = '%s' and not is_personal$f$, pg_temp.uid('BA'), pg_temp.uid('S3')));
select pg_temp.denied('nadie puede ser su propio gerente', format($f$update public.memberships set manager_id = user_id where user_id = '%s' and not is_personal$f$, pg_temp.uid('S3')));
select pg_temp.denied('en un espacio personal el único rol es dueño', format($f$update public.memberships set role = 'admin' where user_id = '%s' and is_personal$f$, pg_temp.uid('OU')));
select pg_temp.denied('color de marca inválido', $$update public.organizations set brand_color = 'rojo' where name = 'Empresa A'$$);
select pg_temp.denied('diseño por defecto inválido', $$update public.organizations set default_theme = 'neon' where name = 'Empresa A'$$);
select pg_temp.eq('se va el gerente M2 (se lo saca de la empresa)', pg_temp.rows(format($f$delete from public.memberships where user_id = '%s' and not is_personal$f$, pg_temp.uid('M2'))), 1);
select pg_temp.ok('...y su vendedor S3 queda sin gerente, pero sigue en la empresa', (select manager_id is null and status = 'active' from public.memberships where user_id = pg_temp.uid('S3') and not is_personal));
select pg_temp.ok('...y sus contactos siguen existiendo', exists (select 1 from public.contacts where name = 'S3-c2'));

-- ============ 9) save_note DENTRO DE EMPRESAS ============
set role authenticated;
select pg_temp.as('S1');
create temp table r2 as select public.save_note(jsonb_build_object('action','create','contact_name','Cliente de S1','transcript','hola','audioPath', pg_temp.uid('S1')::text || '/a.webm','task_title','Llamar','due_at','2026-12-01T10:00:00-03:00')) as r;
select pg_temp.eq('vendedor de empresa: el contacto nuevo va a la EMPRESA', (select org_id from public.contacts where id = (select (r->>'contact_id')::uuid from r2)), pg_temp.oid('A'));
select pg_temp.eq('la nota y la tarea van a la misma empresa', (select count(*) from public.interactions i join public.tasks t on t.org_id = i.org_id where i.org_id = pg_temp.oid('A') and t.title = 'Llamar' and i.transcript = 'hola'), 1::bigint);
select pg_temp.allowed('S1 actualiza su contacto con otra nota', format($f$select public.save_note(jsonb_build_object('action','update','contact_id','%s','stage','meeting','transcript','segunda','audioPath','%s/b.webm'))$f$, (select (r->>'contact_id') from r2), pg_temp.uid('S1')));
select pg_temp.eq('la segunda nota quedó en la misma empresa', (select org_id from public.interactions where transcript = 'segunda'), pg_temp.oid('A'));
select pg_temp.denied('S1 intenta actualizar un contacto ajeno con save_note', format($f$select public.save_note(jsonb_build_object('action','update','contact_id','%s','transcript','x','audioPath','%s/c.webm'))$f$, (select id from (select id from public.contacts where name = 'S3-c2') z), pg_temp.uid('S1')));
select pg_temp.as('OU');
create temp table r3 as select public.save_note(jsonb_build_object('action','create','contact_name','Cliente de OU','transcript','hola OU','audioPath', pg_temp.uid('OU')::text || '/a.webm')) as r;
select pg_temp.ok('usuario sin empresa: el contacto va a su espacio personal', exists (select 1 from public.contacts c join public.memberships m on m.org_id = c.org_id where c.name = 'Cliente de OU' and m.user_id = pg_temp.uid('OU') and m.is_personal));
reset role;

-- ============ 10) ATAQUES MÁS ASTUTOS ============
-- (a) Tabla temporal falsa llamada "memberships" para engañar a las funciones de permisos.
--     La prueba no depende de lo que se movió antes: compara EXACTAMENTE lo que S1 ve
--     antes del ataque y durante el ataque (tiene que ser idéntico), y que no pueda tocar nada nuevo.
set role authenticated;
select pg_temp.as('S1');
create temp table vista_antes as select name from public.contacts;
create temp table tareas_antes as select title from public.tasks;
create temp table memberships (org_id uuid, user_id uuid, role text, status text, manager_id uuid, is_personal boolean);
insert into pg_temp.memberships values (pg_temp.oid('A'), pg_temp.uid('S1'), 'admin', 'active', null, false);
insert into pg_temp.memberships values (pg_temp.oid('A'), pg_temp.uid('S1'), 'owner', 'active', null, false);
select pg_temp.eq('tabla temporal falsa "memberships": S1 ve exactamente los mismos contactos', (select count(*) from public.contacts c where c.name not in (select name from vista_antes)), 0::bigint);
select pg_temp.eq('...y no pierde ninguno', (select count(*) from vista_antes v where v.name not in (select name from public.contacts)), 0::bigint);
select pg_temp.eq('...ni ve tareas nuevas', (select count(*) from public.tasks t where t.title not in (select title from tareas_antes)), 0::bigint);
select pg_temp.eq('...sigue sin ver nada del administrador, del dueño ni del gerente M2', (select count(*) from public.contacts where name like 'AD-%' or name like 'O-%' or name like 'M2-%'), 0::bigint);
select pg_temp.eq('...y no puede reasignar contactos ajenos (0 filas)', pg_temp.rows(format($f$update public.contacts set user_id = '%s' where name like 'S3-%%' or name like 'AD-%%'$f$, pg_temp.uid('S1'))), 0);
select pg_temp.eq('...ni borrar contactos ajenos (0 filas)', pg_temp.rows($$delete from public.contacts where name like 'S3-%' or name like 'AD-%'$$), 0);
select pg_temp.ok('...S1 es dueño de S2-c1 (se lo reasignó M1) y está en la empresa A', exists (select 1 from public.contacts where name = 'S2-c1' and org_id = pg_temp.oid('A')));
select pg_temp.denied('...pero no puede mudar ese dato propio a la empresa B', format($f$update public.contacts set org_id = '%s' where name = 'S2-c1'$f$, pg_temp.oid('B')));
drop table pg_temp.memberships;
-- (b) Alguien sin espacio personal (caso raro): se repara solo al guardar su primera nota
reset role;
insert into auth.users(id, email) values ('b0000000-0000-4000-8000-0000000000aa', 'hueco@test');
delete from public.memberships where user_id = 'b0000000-0000-4000-8000-0000000000aa';
delete from public.organizations where name = 'Espacio de hueco';
insert into pg_temp.u values ('GAP', 'b0000000-0000-4000-8000-0000000000aa');
set role authenticated;
select pg_temp.as('GAP');
select pg_temp.eq('sin espacio: no ve nada (y no rompe)', (select count(*) from public.contacts), 0::bigint);
create temp table r4 as select public.save_note(jsonb_build_object('action','create','contact_name','Primer cliente','transcript','hola','audioPath','b0000000-0000-4000-8000-0000000000aa/a.webm')) as r;
select pg_temp.eq('...al guardar su primera nota se le crea el espacio y el contacto queda ahí', (select count(*) from public.contacts), 1::bigint);
select pg_temp.eq('...y tiene un único espacio personal', (select count(*) from public.memberships where is_personal and user_id = 'b0000000-0000-4000-8000-0000000000aa'), 1::bigint);
select pg_temp.eq('ensure_personal_space es idempotente', public.ensure_personal_space(), public.ensure_personal_space());
reset role;
select pg_temp.eq('nadie quedó sin espacio personal', (select count(*) from auth.users u where not exists (select 1 from public.memberships m where m.user_id = u.id and m.is_personal)), 0::bigint);
