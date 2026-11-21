-- Ida, vuelta y ida otra vez: volver a aplicar la migración después de la marcha atrás.
\ir helpers.sql
select pg_temp.eq('contactos intactos tras volver a migrar', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.contacts), (select h from public._snap_pre2 where t = 'contacts'));
select pg_temp.eq('tareas intactas tras volver a migrar', (select md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.tasks), (select h from public._snap_pre2 where t = 'tasks'));
select pg_temp.eq('cada usuario tiene de nuevo su espacio personal', (select count(*) from public.memberships where is_personal), (select count(*) from auth.users));
select pg_temp.eq('todo dato tiene empresa', (select count(*) from public.contacts where org_id is null), 0::bigint);
