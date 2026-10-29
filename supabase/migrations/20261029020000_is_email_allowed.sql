-- is_email_allowed was added to 20261028000000_family_organizer.sql after that
-- migration had already been applied, so remote databases never received it.
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.family_members m
    where m.email = lower(coalesce(check_email, ''))
  );
$$;

revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to anon, authenticated;

notify pgrst, 'reload schema';
