-- 1. Tables
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_path text,
  last_price numeric(12,2),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products(id) on delete restrict,
  week_of date not null,
  checked boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  unit_price numeric(12,2),
  quantity numeric(10,2) not null default 1,
  unit text,
  supermarket text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  constraint shop_purchases_product_week unique (product_id, week_of),   -- idempotent lazy seeding
  constraint shop_purchases_monday check (extract(isodow from week_of) = 1),
  constraint shop_purchases_qty_positive check (quantity > 0),
  constraint shop_purchases_checkoff_facts check (
    not checked
    or (unit_price is not null and unit_price >= 0
        and supermarket is not null
        and checked_at is not null and checked_by is not null)
  )
);

-- Only index beyond the implicit unique index: every hot query filters week_of
-- (list load, receipts, summary). Product lookups are covered by the unique
-- (product_id, week_of) index; shop_products is a tiny catalog (PK access only).
create index if not exists shop_purchases_week_of_idx on public.shop_purchases (week_of);

-- 2. RLS + grants
alter table public.shop_products enable row level security;
alter table public.shop_purchases enable row level security;

create policy "Family members can read shop products" on public.shop_products
  for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create shop products" on public.shop_products
  for insert to authenticated with check ((select private.is_family_member()) and created_by = (select auth.uid()));
create policy "Family members can update shop products" on public.shop_products
  for update to authenticated using ((select private.is_family_member()))
  with check ((select private.is_family_member()));
create policy "Family members can delete shop products" on public.shop_products
  for delete to authenticated using ((select private.is_family_member()));

create policy "Family members can read shop purchases" on public.shop_purchases
  for select to authenticated using ((select private.is_family_member()));
create policy "Family members can create shop purchases" on public.shop_purchases
  for insert to authenticated with check ((select private.is_family_member()) and created_by = (select auth.uid()));
create policy "Family members can update shop purchases" on public.shop_purchases
  for update to authenticated using ((select private.is_family_member()))
  with check ((select private.is_family_member()));
create policy "Family members can delete shop purchases" on public.shop_purchases
  for delete to authenticated using ((select private.is_family_member()));

-- Data API table exposure is opt-in platform-wide since 2026-10-30; explicit
-- grants make reachability deterministic regardless of project settings.
grant select, insert, update, delete on public.shop_products, public.shop_purchases to authenticated;

-- 3. last_price trigger (server truth; no client double-write). INVOKER on
-- purpose: the acting member already passes both tables' policies; DEFINER
-- would bypass RLS for nothing.
create function public.shop_touch_last_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.checked and new.unit_price is not null then
    update public.shop_products set last_price = new.unit_price
    where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger shop_purchases_touch_last_price
after insert or update on public.shop_purchases
for each row execute function public.shop_touch_last_price();

-- 4. Receipt / week-total RPC. INVOKER so RLS scopes rows to the caller
-- (members get family rows; anyone else gets an empty summary). The UPDATE
-- the trigger fires on shop_products is what makes last_price propagate.
create or replace function public.shop_week_summary(p_week date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'week_of', p_week,
    'week_total', coalesce((
      select sum(unit_price * quantity)
      from public.shop_purchases
      where week_of = p_week and checked
    ), 0),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supermarket', supermarket, 'total', total, 'lines', lines
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

revoke all on function public.shop_week_summary(date) from public, anon;
grant execute on function public.shop_week_summary(date) to authenticated;

-- 5. Realtime
alter publication supabase_realtime add table public.shop_products;
alter publication supabase_realtime add table public.shop_purchases;
-- Default replica identity (uuid PK) is sufficient: the PK is always included
-- in change payloads so the client can merge-by-id. REPLICA IDENTITY FULL is
-- only needed to receive old NON-PK column values, which this design never
-- reads (DELETE handlers use payload.old.id only). No alter ... replica
-- identity statement is needed.

-- 6. Storage: public bucket, uuid object paths, member-gated writes.
insert into storage.buckets (id, name, public)
values ('shop-products', 'shop-products', true)
on conflict (id) do nothing;

create policy "Family members can read shop product photos"
on storage.objects for select to authenticated
using (bucket_id = 'shop-products' and (select private.is_family_member()));
create policy "Family members can upload shop product photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'shop-products' and (select private.is_family_member()));
-- upsert (photo replacement) requires insert + select + update policies.
create policy "Family members can replace shop product photos"
on storage.objects for update to authenticated
using (bucket_id = 'shop-products' and (select private.is_family_member()))
with check (bucket_id = 'shop-products' and (select private.is_family_member()));
