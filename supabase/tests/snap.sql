-- Foto de los datos (cantidad y "huella" de los ids) en la tabla :snap
create table public.:"snap" as
select 'contacts' as t, count(*) as n, md5(coalesce(string_agg(id::text, ',' order by id), '')) as h from public.contacts
union all select 'interactions', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.interactions
union all select 'tasks', count(*), md5(coalesce(string_agg(id::text, ',' order by id), '')) from public.tasks;
