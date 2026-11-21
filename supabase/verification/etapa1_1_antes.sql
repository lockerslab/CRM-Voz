-- ETAPA 1 · PASO 1: FOTO "ANTES" de migrar. Solo lee, no cambia nada.
-- Copiá o sacale un pantallazo al resultado: lo vas a comparar con el de "después".
select 'Usuarios' as dato, count(*)::text as valor from auth.users
union all select 'Perfiles', count(*)::text from public.profiles
union all select 'Contactos', count(*)::text from public.contacts
union all select 'Notas', count(*)::text from public.interactions
union all select 'Tareas', count(*)::text from public.tasks
union all select 'Huella de contactos', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío') from public.contacts
union all select 'Huella de notas', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío') from public.interactions
union all select 'Huella de tareas', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío') from public.tasks;
