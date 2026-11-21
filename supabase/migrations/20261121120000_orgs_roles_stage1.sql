-- crm-voz · ETAPA 1: empresas, miembros y roles ("cimientos invisibles")
--
-- Qué hace:
--   1. Crea organizations (empresas) y memberships (miembros con rol).
--   2. Le da a CADA usuario actual su "empresa personal" y le asigna sus datos.
--   3. Agrega org_id a contacts, interactions y tasks.
--   4. Reescribe las reglas de acceso (RLS): "lo mío" pasa a "lo que mi rol permite
--      dentro de mi empresa". Para los usuarios actuales NO cambia nada visible.
--   5. save_note y el alta de usuarios nuevos pasan a conocer la empresa.
--
-- Reglas del diseño (docs/diseno-roles-y-empresas.md):
--   - Una persona puede tener un espacio PERSONAL y, como máximo, UNA empresa.
--   - Los contactos de una empresa son de la empresa (se reasignan, no se pierden).
--   - Quien ve a quién: el administrador/dueño ve toda su empresa; el gerente ve
--     a los vendedores que tiene a cargo; el vendedor ve lo suyo.
--   - Nunca se usa la clave service_role: todo con funciones de permisos acotados.
--
-- Todo corre en UNA transacción: si algo falla, no queda nada a medias.
-- Para deshacerlo: supabase/rollbacks/20261121120000_orgs_roles_stage1_rollback.sql

begin;

-- ---------------------------------------------------------------------------
-- 1) Tipos y tablas
-- ---------------------------------------------------------------------------

create type public.org_role as enum ('owner', 'admin', 'manager', 'seller');
create type public.member_status as enum ('active', 'disabled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  is_personal boolean not null default false,
  logo_url text,
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  default_theme text check (default_theme is null or default_theme in ('calle', 'claro', 'tech')),
  managers_read_transcripts boolean not null default true,
  managers_hear_audio boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'seller',
  -- A quién reporta (debe ser miembro de la MISMA empresa).
  manager_id uuid,
  status public.member_status not null default 'active',
  -- Copia de organizations.is_personal (se completa sola) para poder exigir
  -- "un espacio personal y una empresa por persona" con índices únicos.
  is_personal boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id),
  constraint memberships_manager_fk
    foreign key (org_id, manager_id)
    references public.memberships (org_id, user_id)
    on delete set null (manager_id),
  constraint memberships_no_self_manager check (manager_id is null or manager_id <> user_id),
  constraint memberships_personal_is_owner check (not is_personal or role = 'owner')
);

create unique index memberships_one_personal_per_user
  on public.memberships (user_id) where is_personal;
create unique index memberships_one_company_per_user
  on public.memberships (user_id) where not is_personal;
create unique index memberships_personal_single_member
  on public.memberships (org_id) where is_personal;
create index memberships_org_manager_idx on public.memberships (org_id, manager_id);

create function public.memberships_set_personal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select o.is_personal into new.is_personal
    from public.organizations o
   where o.id = new.org_id;
  if new.is_personal is null then
    raise exception 'organization_not_found' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger memberships_set_personal_trg
before insert on public.memberships
for each row execute function public.memberships_set_personal();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Funciones de permisos (security definer: leen memberships sin entrar en
--    las reglas de esa misma tabla; solo contestan sobre el usuario que llama)
-- ---------------------------------------------------------------------------

create function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$$;

create function public.org_role_of(p_org uuid)
returns public.org_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.role from public.memberships m
   where m.org_id = p_org
     and m.user_id = auth.uid()
     and m.status = 'active';
$$;

create function public.is_active_member(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org
       and m.user_id = p_user
       and m.status = 'active'
  );
$$;

-- ¿Puedo ver los datos de p_user dentro de la empresa p_org?
create function public.can_see_user(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships me
     where me.org_id = p_org
       and me.user_id = auth.uid()
       and me.status = 'active'
       and (
            p_user = auth.uid()
         or me.role in ('owner', 'admin')
         or (
              me.role = 'manager'
          and exists (
                select 1 from public.memberships t
                 where t.org_id = p_org
                   and t.user_id = p_user
                   and t.manager_id = auth.uid()
              )
            )
       )
  );
$$;

-- Empresa "activa" del usuario: su empresa si tiene una; si no, su espacio personal.
create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.org_id from public.memberships m
   where m.user_id = auth.uid()
     and m.status = 'active'
   order by m.is_personal asc, m.created_at asc
   limit 1;
$$;

-- Si por cualquier motivo una persona no tiene espacio personal (por ejemplo, se
-- registró justo mientras corría esta migración), se le crea al guardar su primera nota.
create function public.ensure_personal_space()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select m.org_id into v_org
    from public.memberships m
   where m.user_id = v_uid and m.is_personal;
  if v_org is not null then
    return v_org;
  end if;

  select 'Espacio de ' || coalesce(
           nullif(btrim(split_part(coalesce(nullif(btrim(p.full_name), ''), u.email, ''), '@', 1)), ''),
           'usuario')
    into v_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = v_uid;

  insert into public.organizations (name, is_personal)
  values (coalesce(v_name, 'Espacio de usuario'), true)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_uid, 'owner');

  return v_org;
end;
$$;

revoke all on function public.memberships_set_personal() from public, anon, authenticated;
revoke all on function public.ensure_personal_space() from public, anon;
grant execute on function public.ensure_personal_space() to authenticated;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.org_role_of(uuid) from public, anon;
revoke all on function public.is_active_member(uuid, uuid) from public, anon;
revoke all on function public.can_see_user(uuid, uuid) from public, anon;
revoke all on function public.current_org_id() from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role_of(uuid) to authenticated;
grant execute on function public.is_active_member(uuid, uuid) to authenticated;
grant execute on function public.can_see_user(uuid, uuid) to authenticated;
grant execute on function public.current_org_id() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Reglas de organizations y memberships (solo lectura por ahora; las
--    escrituras llegan en la etapa 2 por funciones con permisos acotados)
-- ---------------------------------------------------------------------------

create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "memberships_select_own_or_admin"
  on public.memberships for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.org_role_of(org_id) in ('owner', 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4) Empresa personal para cada usuario existente + org_id en los datos
-- ---------------------------------------------------------------------------

alter table public.contacts add column org_id uuid references public.organizations (id);
alter table public.interactions add column org_id uuid references public.organizations (id);
alter table public.tasks add column org_id uuid references public.organizations (id);

create temp table _personal_orgs on commit drop as
select
  u.id as user_id,
  gen_random_uuid() as org_id,
  'Espacio de ' || coalesce(
    nullif(btrim(split_part(coalesce(nullif(btrim(p.full_name), ''), u.email, ''), '@', 1)), ''),
    'usuario'
  ) as org_name
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (
  select 1 from public.memberships m where m.user_id = u.id and m.is_personal
);

insert into public.organizations (id, name, is_personal)
select org_id, org_name, true from _personal_orgs;

insert into public.memberships (org_id, user_id, role)
select org_id, user_id, 'owner' from _personal_orgs;

update public.contacts c set org_id = m.org_id
  from public.memberships m
 where m.user_id = c.user_id and m.is_personal and c.org_id is null;

update public.interactions i set org_id = m.org_id
  from public.memberships m
 where m.user_id = i.user_id and m.is_personal and i.org_id is null;

update public.tasks t set org_id = m.org_id
  from public.memberships m
 where m.user_id = t.user_id and m.is_personal and t.org_id is null;

-- Si quedó algún dato sin empresa, se corta TODO (la transacción se deshace).
do $$
begin
  if exists (select 1 from public.contacts where org_id is null)
     or exists (select 1 from public.interactions where org_id is null)
     or exists (select 1 from public.tasks where org_id is null) then
    raise exception 'backfill_incompleto: hay datos sin empresa asignada';
  end if;
end;
$$;

alter table public.contacts alter column org_id set not null;
alter table public.interactions alter column org_id set not null;
alter table public.tasks alter column org_id set not null;

create index contacts_org_user_idx on public.contacts (org_id, user_id);
create index interactions_org_user_idx on public.interactions (org_id, user_id);
create index tasks_org_user_idx on public.tasks (org_id, user_id);
create index memberships_user_idx on public.memberships (user_id);

-- La empresa de un dato nunca cambia (no se puede "mudar" un dato a otra empresa).
create function public.prevent_org_change()
returns trigger
language plpgsql
as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger contacts_org_immutable before update on public.contacts
  for each row execute function public.prevent_org_change();
create trigger interactions_org_immutable before update on public.interactions
  for each row execute function public.prevent_org_change();
create trigger tasks_org_immutable before update on public.tasks
  for each row execute function public.prevent_org_change();

-- ---------------------------------------------------------------------------
-- 5) Reglas de acceso nuevas para contacts, interactions y tasks
-- ---------------------------------------------------------------------------

drop policy if exists "contacts_select_own" on public.contacts;
drop policy if exists "contacts_insert_own" on public.contacts;
drop policy if exists "contacts_update_own" on public.contacts;
drop policy if exists "contacts_delete_own" on public.contacts;
drop policy if exists "interactions_select_own" on public.interactions;
drop policy if exists "interactions_insert_own" on public.interactions;
drop policy if exists "interactions_update_own" on public.interactions;
drop policy if exists "interactions_delete_own" on public.interactions;
drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

-- Contactos -----------------------------------------------------------------

create policy "contacts_select"
  on public.contacts for select
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  );

create policy "contacts_insert"
  on public.contacts for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_org_member(org_id)
  );

create policy "contacts_update"
  on public.contacts for update
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  )
  with check (
    public.is_org_member(org_id)
    -- el responsable (incluso al reasignar) tiene que ser miembro activo de la empresa
    and public.is_active_member(org_id, user_id)
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  );

create policy "contacts_delete"
  on public.contacts for delete
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.org_role_of(org_id) in ('owner', 'admin'))
  );

-- Interacciones (notas) -------------------------------------------------------

create policy "interactions_select"
  on public.interactions for select
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  );

create policy "interactions_insert"
  on public.interactions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_org_member(org_id)
    and exists (
      select 1 from public.contacts c
       where c.id = contact_id and c.org_id = interactions.org_id
    )
  );

create policy "interactions_update"
  on public.interactions for update
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.org_role_of(org_id) in ('owner', 'admin'))
  )
  with check (
    public.is_org_member(org_id)
    and exists (
      select 1 from public.contacts c
       where c.id = contact_id and c.org_id = interactions.org_id
    )
  );

create policy "interactions_delete"
  on public.interactions for delete
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.org_role_of(org_id) in ('owner', 'admin'))
  );

-- Tareas ----------------------------------------------------------------------

create policy "tasks_select"
  on public.tasks for select
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  );

create policy "tasks_insert"
  on public.tasks for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_org_member(org_id)
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
         where c.id = contact_id and c.org_id = tasks.org_id
      )
    )
  );

create policy "tasks_update"
  on public.tasks for update
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
  )
  with check (
    public.is_org_member(org_id)
    and public.is_active_member(org_id, user_id)
    and (user_id = (select auth.uid()) or public.can_see_user(org_id, user_id))
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
         where c.id = contact_id and c.org_id = tasks.org_id
      )
    )
  );

create policy "tasks_delete"
  on public.tasks for delete
  to authenticated
  using (
    org_id in (select m.org_id from public.memberships m
                where m.user_id = (select auth.uid()) and m.status = 'active')
    and (user_id = (select auth.uid()) or public.org_role_of(org_id) in ('owner', 'admin'))
  );

-- ---------------------------------------------------------------------------
-- 6) Alta de usuarios nuevos: perfil + espacio personal
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_org uuid;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);

  insert into public.profiles (id, full_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  insert into public.organizations (name, is_personal)
  values (
    'Espacio de ' || coalesce(nullif(btrim(split_part(coalesce(v_name, ''), '@', 1)), ''), 'usuario'),
    true
  )
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org, new.id, 'owner');

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) save_note: guarda en la empresa correcta
--    - contacto nuevo: en la empresa activa del usuario
--    - contacto existente: en la empresa del propio contacto
-- ---------------------------------------------------------------------------

create or replace function public.save_note(p_note jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := p_note->>'action';
  v_contact_id uuid := nullif(p_note->>'contact_id', '')::uuid;
  v_name text := nullif(btrim(coalesce(p_note->>'contact_name', '')), '');
  v_company text := nullif(btrim(coalesce(p_note->>'company', '')), '');
  v_email text := nullif(btrim(coalesce(p_note->>'email', '')), '');
  v_phone text := nullif(btrim(coalesce(p_note->>'phone', '')), '');
  v_product text := nullif(btrim(coalesce(p_note->>'product_interest', '')), '');
  v_notes text := nullif(btrim(coalesce(p_note->>'notes', '')), '');
  v_transcript text := nullif(btrim(coalesce(p_note->>'transcript', '')), '');
  v_audio_path text := nullif(btrim(coalesce(p_note->>'audioPath', '')), '');
  v_task_title text := nullif(btrim(coalesce(p_note->>'task_title', '')), '');
  v_due timestamptz := nullif(p_note->>'due_at', '')::timestamptz;
  v_stage public.pipeline_stage;
  v_channels text[] := '{}';
  v_existing public.contacts%rowtype;
  v_org uuid;
  v_interaction_id uuid;
  v_task_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if v_transcript is null or v_audio_path is null then
    raise exception 'transcript_and_audio_required' using errcode = '22023';
  end if;

  if left(v_audio_path, length(v_uid::text) + 1) <> v_uid::text || '/' then
    raise exception 'audio_path_not_owned' using errcode = '42501';
  end if;

  if v_task_title is not null and v_due is null then
    raise exception 'due_at_required' using errcode = '22023';
  end if;

  if (p_note->>'stage') in
     ('cold_lead', 'contacted', 'meeting', 'negotiation', 'won', 'lost') then
    v_stage := (p_note->>'stage')::public.pipeline_stage;
  end if;

  if jsonb_typeof(p_note->'channels') = 'array' then
    select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}')
      into v_channels
      from jsonb_array_elements_text(p_note->'channels') as x;
  end if;

  if v_action = 'update' and v_contact_id is not null then
    select * into v_existing
      from public.contacts
     where id = v_contact_id and user_id = v_uid
     for update;

    if not found then
      raise exception 'contact_not_found' using errcode = 'P0002';
    end if;

    v_org := v_existing.org_id;

    update public.contacts
       set name = coalesce(v_name, name),
           company = coalesce(v_company, company),
           email = coalesce(v_email, email),
           phone = coalesce(v_phone, phone),
           stage = coalesce(v_stage, stage),
           channels = case when cardinality(v_channels) > 0 then v_channels else channels end,
           product_interest = coalesce(v_product, product_interest),
           notes = coalesce(v_notes, notes)
     where id = v_contact_id and user_id = v_uid;

    v_stage := coalesce(v_stage, v_existing.stage);
  else
    if v_name is null then
      raise exception 'contact_name_required' using errcode = '22023';
    end if;

    v_org := public.current_org_id();
    if v_org is null then
      v_org := public.ensure_personal_space();
    end if;

    v_stage := coalesce(v_stage, 'cold_lead');

    insert into public.contacts
      (user_id, org_id, name, company, email, phone, stage, channels, product_interest, notes)
    values
      (v_uid, v_org, v_name, v_company, v_email, v_phone, v_stage, v_channels, v_product, v_notes)
    returning id into v_contact_id;
  end if;

  insert into public.interactions
    (user_id, org_id, contact_id, type, transcript, audio_url, extracted_json)
  values
    (v_uid, v_org, v_contact_id, 'voice_note', v_transcript, v_audio_path,
     jsonb_build_object(
       'summary', p_note->'summary',
       'channels', to_jsonb(v_channels),
       'product_interest', to_jsonb(v_product),
       'stage', to_jsonb(v_stage),
       'task_title', to_jsonb(v_task_title),
       'due_at', p_note->'due_at'
     ))
  returning id into v_interaction_id;

  if v_task_title is not null then
    insert into public.tasks (user_id, org_id, contact_id, title, due_date)
    values (v_uid, v_org, v_contact_id, v_task_title, v_due)
    returning id into v_task_id;
  end if;

  return jsonb_build_object(
    'contact_id', v_contact_id,
    'interaction_id', v_interaction_id,
    'task_id', v_task_id
  );
end;
$$;

revoke all on function public.save_note(jsonb) from public;
revoke all on function public.save_note(jsonb) from anon;
grant execute on function public.save_note(jsonb) to authenticated;

commit;
