-- Datos "como hoy" (modelo anterior, sin empresas) para probar el traspaso.
-- Se corre DESPUÉS de las migraciones 1 a 3 y ANTES de la de empresas.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'l1@test', null),
  ('a0000000-0000-4000-8000-000000000002', 'l2@test', '{"full_name":"Lucía Pérez"}'),
  ('a0000000-0000-4000-8000-000000000003', 'l3@test', null),
  ('a0000000-0000-4000-8000-000000000004', 'l4@test', null),
  ('a0000000-0000-4000-8000-000000000005', null, null);   -- sin email ni nombre
-- Un usuario viejo sin fila de perfil (pasó en cuentas creadas antes del disparador)
delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000004';

do $$
declare
  l1 uuid := 'a0000000-0000-4000-8000-000000000001';
  l2 uuid := 'a0000000-0000-4000-8000-000000000002';
  l4 uuid := 'a0000000-0000-4000-8000-000000000004';
  c uuid; i int;
begin
  for i in 1..3 loop
    insert into public.contacts (user_id, name, stage) values (l1, 'L1-c' || i, 'contacted') returning id into c;
    if i <= 2 then
      insert into public.interactions (user_id, contact_id, transcript) values (l1, c, 'nota L1-c' || i);
      insert into public.tasks (user_id, contact_id, title, due_date) values (l1, c, 'tarea L1-c' || i, now() + interval '2 days');
    end if;
  end loop;
  for i in 1..2 loop
    insert into public.contacts (user_id, name) values (l2, 'L2-c' || i) returning id into c;
  end loop;
  insert into public.tasks (user_id, contact_id, title) values (l2, c, 'tarea L2');
  insert into public.tasks (user_id, contact_id, title) values (l2, null, 'tarea suelta L2');
  insert into public.contacts (user_id, name) values (l4, 'L4-c1');
end $$;

-- Foto de cómo está todo ANTES de migrar
create table public._snap as
select 'contacts' as t, count(*) as n, md5(coalesce(string_agg(id::text, ',' order by id), '')) as h from public.contacts
union all select 'interactions', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.interactions
union all select 'tasks', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.tasks
union all select 'users', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from auth.users;
