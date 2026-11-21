-- ETAPA 1 · PASO 0: RESPALDO dentro de la base de datos (antes de migrar).
--
-- Copia tus datos actuales a tablas "_bak_20261121_*". Si algo saliera mal,
-- esos datos siguen ahí. Es seguro correrlo: solo LEE tus tablas y crea copias.
-- (Las copias quedan cerradas: nadie puede leerlas desde la app.)
--
-- Importante: esto protege contra errores de la migración. NO reemplaza una copia
-- de seguridad completa del proyecto (si tu plan de Supabase la incluye, hacela también).

create table public._bak_20261121_profiles     as select * from public.profiles;
create table public._bak_20261121_contacts     as select * from public.contacts;
create table public._bak_20261121_interactions as select * from public.interactions;
create table public._bak_20261121_tasks        as select * from public.tasks;

alter table public._bak_20261121_profiles     enable row level security;
alter table public._bak_20261121_contacts     enable row level security;
alter table public._bak_20261121_interactions enable row level security;
alter table public._bak_20261121_tasks        enable row level security;

-- Resultado: cuántas filas se copiaron (tienen que coincidir con las tablas originales)
select 'perfiles' as tabla,
       (select count(*) from public.profiles) as originales,
       (select count(*) from public._bak_20261121_profiles) as copiadas
union all select 'contactos', (select count(*) from public.contacts), (select count(*) from public._bak_20261121_contacts)
union all select 'notas', (select count(*) from public.interactions), (select count(*) from public._bak_20261121_interactions)
union all select 'tareas', (select count(*) from public.tasks), (select count(*) from public._bak_20261121_tasks);
