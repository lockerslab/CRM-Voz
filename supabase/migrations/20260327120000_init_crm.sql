-- crm-voz initial schema: contacts, interactions, tasks, profiles
-- RLS scoped by auth.uid() = user_id

create extension if not exists "pgcrypto";

create type public.pipeline_stage as enum (
  'cold_lead',
  'contacted',
  'meeting',
  'negotiation',
  'won',
  'lost'
);

create type public.interaction_type as enum (
  'voice_note',
  'call',
  'email',
  'meeting',
  'note',
  'other'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  stage public.pipeline_stage not null default 'cold_lead',
  channels text[] not null default '{}',
  product_interest text,
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts (user_id);
create index contacts_user_stage_idx on public.contacts (user_id, stage);
create index contacts_user_position_idx on public.contacts (user_id, position);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  type public.interaction_type not null default 'voice_note',
  transcript text,
  audio_url text,
  extracted_json jsonb,
  created_at timestamptz not null default now()
);

create index interactions_user_id_idx on public.interactions (user_id);
create index interactions_contact_id_idx on public.interactions (contact_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  title text not null,
  due_date timestamptz,
  completed boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_contact_id_idx on public.tasks (contact_id);
create index tasks_due_date_idx on public.tasks (due_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.tasks enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "contacts_select_own"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "contacts_insert_own"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "contacts_update_own"
  on public.contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "contacts_delete_own"
  on public.contacts for delete
  using (auth.uid() = user_id);

create policy "interactions_select_own"
  on public.interactions for select
  using (auth.uid() = user_id);

create policy "interactions_insert_own"
  on public.interactions for insert
  with check (auth.uid() = user_id);

create policy "interactions_update_own"
  on public.interactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "interactions_delete_own"
  on public.interactions for delete
  using (auth.uid() = user_id);

create policy "tasks_select_own"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks_insert_own"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks_update_own"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks_delete_own"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- Realtime for pipeline board + tasks
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.tasks;

-- Private audio storage bucket
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "audio_select_own"
  on storage.objects for select
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio_update_own"
  on storage.objects for update
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
