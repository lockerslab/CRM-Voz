-- crm-voz: el diseño elegido por cada usuario se guarda en su perfil, para que
-- lo acompañe entre dispositivos. Es opcional: si la columna no existe, la app
-- sigue funcionando y el diseño queda solo en cada dispositivo (cookie).
--
-- La política "profiles_update_own" ya permite que cada usuario actualice su fila.

alter table public.profiles
  add column if not exists theme text;

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme is null or theme in ('calle', 'claro', 'tech'));
