-- Supporting objects for the shop list UI: a fixed supermarket list, a marker
-- that a week's list was created (so it is built only once), the seeding RPC,
-- rounded totals and weekly spend for trends.

-- 1. Supermarkets
create table if not exists public.shop_supermarkets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);
create unique index if not exists shop_supermarkets_name_key
  on public.shop_supermarkets (lower(btrim(name)));

alter table public.shop_supermarkets enable row level security;
create policy "Family members can read supermarkets" on public.shop_supermarkets
  for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create supermarkets" on public.shop_supermarkets
  for insert to authenticated with check ((select private.is_family_member()));
create policy "Family members can update supermarkets" on public.shop_supermarkets
  for update to authenticated using ((select private.is_family_member()))
  with check ((select private.is_family_member()));
create policy "Family members can delete supermarkets" on public.shop_supermarkets
  for delete to authenticated using ((select private.is_family_member()));
grant select, insert, update, delete on public.shop_supermarkets to authenticated;
alter publication supabase_realtime add table public.shop_supermarkets;

-- Existing free-text supermarkets become list entries.
insert into public.shop_supermarkets (name)
select distinct on (lower(btrim(supermarket))) btrim(supermarket)
from public.shop_purchases
where supermarket is not null and btrim(supermarket) <> ''
on conflict do nothing;

-- 2. Week markers: a week's list is created once. Removing every item later
-- must not make the next open rebuild it.
create table if not exists public.shop_weeks (
  week_of date primary key check (extract(isodow from week_of) = 1),
  created_at timestamptz not null default now()
);
alter table public.shop_weeks enable row level security;
create policy "Family members can read shop weeks" on public.shop_weeks
  for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create shop weeks" on public.shop_weeks
  for insert to authenticated with check ((select private.is_family_member()));
grant select, insert on public.shop_weeks to authenticated;

insert into public.shop_weeks (week_of)
select distinct week_of from public.shop_purchases
on conflict do nothing;

-- 3. Seed RPC. INVOKER: RLS on shop_weeks/shop_purchases applies to the caller.
-- "Future" is judged against the latest Monday any client time zone can be in
-- (UTC+14), so a client ahead of the server is never refused its own week.
create or replace function public.shop_seed_week(p_week date)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created date;
begin
  if p_week > date_trunc('week', ((now() at time zone 'utc') + interval '14 hours'))::date then
    raise exception 'future_week';
  end if;

  insert into public.shop_weeks (week_of) values (p_week)
  on conflict (week_of) do nothing
  returning week_of into created;

  if created is null then
    return false;
  end if;

  insert into public.shop_purchases (product_id, week_of)
  select id, p_week from public.shop_products where active
  on conflict (product_id, week_of) do nothing;
  return true;
end;
$$;
revoke all on function public.shop_seed_week(date) from public, anon;
grant execute on function public.shop_seed_week(date) to authenticated;

-- 4. Week summary, same shape as before with totals rounded to cents.
create or replace function public.shop_week_summary(p_week date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'week_of', p_week,
    'week_total', round(coalesce((
      select sum(unit_price * quantity)
      from public.shop_purchases
      where week_of = p_week and checked
    ), 0), 2),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supermarket', supermarket, 'total', round(total, 2), 'lines', lines
      ) order by supermarket)
      from (
        select p.supermarket,
               sum(p.unit_price * p.quantity) as total,
               jsonb_agg(jsonb_build_object(
                 'purchase_id', p.id, 'product_id', p.product_id,
                 'name', pr.name, 'photo_path', pr.photo_path,
                 'unit_price', p.unit_price, 'quantity', p.quantity, 'unit', p.unit,
                 'checked_at', p.checked_at
               ) order by pr.name) as lines
        from public.shop_purchases p
        join public.shop_products pr on pr.id = p.product_id
        where p.week_of = p_week and p.checked
        group by p.supermarket
      ) r
    ), '[]'::jsonb)
  );
$$;

-- 5. Weekly spend for trends: the last p_weeks Mondays, zero-filled.
create or replace function public.shop_weekly_totals(p_weeks int default 8)
returns table (week_of date, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.week_of::date,
         round(coalesce(sum(p.unit_price * p.quantity) filter (where p.checked), 0), 2)
  from generate_series(
         date_trunc('week', current_date) - make_interval(weeks => greatest(p_weeks, 1) - 1),
         date_trunc('week', current_date),
         interval '1 week') as w(week_of)
  left join public.shop_purchases p on p.week_of = w.week_of::date
  group by w.week_of
  order by w.week_of;
$$;
revoke all on function public.shop_weekly_totals(int) from public, anon;
grant execute on function public.shop_weekly_totals(int) to authenticated;
