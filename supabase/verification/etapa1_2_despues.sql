-- ETAPA 1 · PASO 3: VERIFICACIÓN "DESPUÉS" de migrar. Solo lee, no cambia nada.
-- La columna "estado" te dice si cada cosa está bien (OK) o hay que revisar.
with
  u as (select count(*) as n from auth.users),
  espacios as (select count(*) as n from public.memberships where is_personal),
  sin_espacio as (
    select count(*) as n from auth.users x
     where not exists (select 1 from public.memberships m where m.user_id = x.id and m.is_personal)),
  sin_empresa as (
    select (select count(*) from public.contacts where org_id is null)
         + (select count(*) from public.interactions where org_id is null)
         + (select count(*) from public.tasks where org_id is null) as n),
  reglas as (
    select count(*) as n from pg_policies
     where schemaname = 'public'
       and policyname in ('contacts_select','contacts_insert','contacts_update','contacts_delete',
                          'interactions_select','interactions_insert','interactions_update','interactions_delete',
                          'tasks_select','tasks_insert','tasks_update','tasks_delete')),
  reglas_viejas as (
    select count(*) as n from pg_policies
     where schemaname = 'public' and policyname in ('contacts_select_own','tasks_select_own','interactions_select_own')),
  funciones as (
    select count(*) as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and p.proname in ('is_org_member','org_role_of','is_active_member','can_see_user','current_org_id','ensure_personal_space','save_note'))
select 'Usuarios' as dato, (select n from u)::text as valor, 'comparar con "antes"' as estado
union all select 'Contactos', count(*)::text, 'comparar con "antes"' from public.contacts
union all select 'Notas', count(*)::text, 'comparar con "antes"' from public.interactions
union all select 'Tareas', count(*)::text, 'comparar con "antes"' from public.tasks
union all select 'Huella de contactos', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío'), 'tiene que ser IGUAL a la de "antes"' from public.contacts
union all select 'Huella de notas', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío'), 'tiene que ser IGUAL a la de "antes"' from public.interactions
union all select 'Huella de tareas', coalesce(md5(string_agg(id::text, ',' order by id)), 'vacío'), 'tiene que ser IGUAL a la de "antes"' from public.tasks
union all select 'Espacios personales', (select n from espacios)::text, case when (select n from espacios) = (select n from u) then 'OK (uno por usuario)' else 'REVISAR' end
union all select 'Usuarios SIN espacio personal', (select n from sin_espacio)::text, case when (select n from sin_espacio) = 0 then 'OK' else 'REVISAR' end
union all select 'Datos sin empresa asignada', (select n from sin_empresa)::text, case when (select n from sin_empresa) = 0 then 'OK' else 'REVISAR' end
union all select 'Reglas de acceso nuevas', (select n from reglas)::text, case when (select n from reglas) = 12 then 'OK (12 de 12)' else 'REVISAR' end
union all select 'Reglas viejas que deberían haber desaparecido', (select n from reglas_viejas)::text, case when (select n from reglas_viejas) = 0 then 'OK' else 'REVISAR' end
union all select 'Funciones de permisos', (select n from funciones)::text, case when (select n from funciones) = 7 then 'OK (7 de 7)' else 'REVISAR' end
union all select 'Seguridad activada en empresas y miembros',
       (select count(*) from pg_tables where schemaname = 'public' and tablename in ('organizations','memberships') and rowsecurity)::text,
       case when (select count(*) from pg_tables where schemaname = 'public' and tablename in ('organizations','memberships') and rowsecurity) = 2 then 'OK (2 de 2)' else 'REVISAR' end;
