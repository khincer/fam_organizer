create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

grant usage on schema private to supabase_auth_admin;

create table if not exists private.family_members (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

revoke all on private.family_members from public, anon, authenticated;
grant select on private.family_members to supabase_auth_admin;

create or replace function private.is_family_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.family_members m
    where m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_family_member() from public, anon;
grant execute on function private.is_family_member() to authenticated;

grant usage on schema public to supabase_auth_admin;

create or replace function public.allowlisted_email_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email text := lower(coalesce(event -> 'user' ->> 'email', ''));
begin
  if exists (select 1 from private.family_members m where m.email = email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Este correo no está autorizado para el organizador familiar.',
      'http_code', 403
    )
  );
end;
$$;
grant execute on function public.allowlisted_email_before_user_created(jsonb) to supabase_auth_admin;
revoke all on function public.allowlisted_email_before_user_created(jsonb) from public, anon, authenticated;

create table if not exists public.payment_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Otros',
  amount numeric(12,2),
  currency text not null default 'NIO',
  due_day smallint check (due_day between 1 and 31),
  next_due_on date not null,
  recurrence text not null check (recurrence in ('once', 'monthly', 'yearly')),
  notes text not null default '',
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_occurrences (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.payment_templates(id) on delete set null,
  title text not null,
  category text not null default 'Otros',
  amount numeric(12,2),
  currency text not null default 'NIO',
  due_on date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Cita médica',
  doctor text not null,
  patient text not null,
  starts_at timestamptz not null,
  location text not null default '',
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists payment_occurrences_due_on_idx on public.payment_occurrences (due_on, status);
create index if not exists appointments_starts_at_idx on public.appointments (starts_at, status);

alter table public.payment_templates enable row level security;
alter table public.payment_occurrences enable row level security;
alter table public.appointments enable row level security;

create policy "Family members can read payment templates" on public.payment_templates
for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create payment templates" on public.payment_templates
for insert to authenticated with check ((select private.is_family_member()) and created_by = (select auth.uid()));
create policy "Family members can update payment templates" on public.payment_templates
for update to authenticated using ((select private.is_family_member()))
with check ((select private.is_family_member()));
create policy "Family members can delete payment templates" on public.payment_templates
for delete to authenticated using ((select private.is_family_member()));

create policy "Family members can read payment occurrences" on public.payment_occurrences
for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create payment occurrences" on public.payment_occurrences
for insert to authenticated with check ((select private.is_family_member()) and created_by = (select auth.uid()));
create policy "Family members can update payment occurrences" on public.payment_occurrences
for update to authenticated using ((select private.is_family_member()))
with check ((select private.is_family_member()));
create policy "Family members can delete payment occurrences" on public.payment_occurrences
for delete to authenticated using ((select private.is_family_member()));

create policy "Family members can read appointments" on public.appointments
for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create appointments" on public.appointments
for insert to authenticated with check ((select private.is_family_member()) and created_by = (select auth.uid()));
create policy "Family members can update appointments" on public.appointments
for update to authenticated using ((select private.is_family_member()))
with check ((select private.is_family_member()));
create policy "Family members can delete appointments" on public.appointments
for delete to authenticated using ((select private.is_family_member()));

grant select, insert, update, delete on public.payment_templates, public.payment_occurrences, public.appointments to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can read their own push subscriptions" on public.push_subscriptions
for select to authenticated using ((select auth.uid()) = user_id and (select private.is_family_member()));
create policy "Users can create their own push subscriptions" on public.push_subscriptions
for insert to authenticated with check ((select auth.uid()) = user_id and (select private.is_family_member()));
create policy "Users can update their own push subscriptions" on public.push_subscriptions
for update to authenticated using ((select auth.uid()) = user_id and (select private.is_family_member()))
with check ((select auth.uid()) = user_id and (select private.is_family_member()));
create policy "Users can delete their own push subscriptions" on public.push_subscriptions
for delete to authenticated using ((select auth.uid()) = user_id and (select private.is_family_member()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Configure this function as the Auth > Hooks > Before User Created hook.



