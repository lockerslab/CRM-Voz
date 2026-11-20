-- crm-voz: guardado atómico de notas de voz + RLS más estricta.
--
-- 1) public.save_note(jsonb): crea/actualiza contacto + interacción + tarea
--    en UNA sola transacción (todo o nada). Corre con los permisos del usuario
--    (security invoker), así que RLS sigue aplicando. No usa service role.
-- 2) interactions y tasks: el contact_id tiene que ser un contacto del mismo usuario.

-- ---------------------------------------------------------------------------
-- 2) RLS: el contacto referenciado debe pertenecer al usuario
-- ---------------------------------------------------------------------------

drop policy if exists "interactions_insert_own" on public.interactions;
drop policy if exists "interactions_update_own" on public.interactions;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;

create policy "interactions_insert_own"
  on public.interactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.user_id = auth.uid()
    )
  );

create policy "interactions_update_own"
  on public.interactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.user_id = auth.uid()
    )
  );

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (
    auth.uid() = user_id
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id = contact_id and c.user_id = auth.uid()
      )
    )
  );

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id = contact_id and c.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 1) save_note: todo o nada
-- ---------------------------------------------------------------------------

create or replace function public.save_note(p_note jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
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
    -- Actualizar contacto existente (solo pisa lo que vino con valor).
    select * into v_existing
      from public.contacts
     where id = v_contact_id and user_id = v_uid
     for update;

    if not found then
      raise exception 'contact_not_found' using errcode = 'P0002';
    end if;

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
    -- Crear contacto nuevo.
    if v_name is null then
      raise exception 'contact_name_required' using errcode = '22023';
    end if;

    v_stage := coalesce(v_stage, 'cold_lead');

    insert into public.contacts
      (user_id, name, company, email, phone, stage, channels, product_interest, notes)
    values
      (v_uid, v_name, v_company, v_email, v_phone, v_stage, v_channels, v_product, v_notes)
    returning id into v_contact_id;
  end if;

  insert into public.interactions
    (user_id, contact_id, type, transcript, audio_url, extracted_json)
  values
    (v_uid, v_contact_id, 'voice_note', v_transcript, v_audio_path,
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
    insert into public.tasks (user_id, contact_id, title, due_date)
    values (v_uid, v_contact_id, v_task_title, v_due)
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
