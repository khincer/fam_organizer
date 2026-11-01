-- Fixtures (as superuser)
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'ana@familia.test'),
  ('00000000-0000-0000-0000-00000000dead', 'extra@otro.test');
insert into private.family_members (email) values ('ana@familia.test');

create function pg_temp.act_as(p_sub text, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'email', p_email)::text, false);
  execute 'set role authenticated';
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-000000000001', 'ana@familia.test');
insert into public.shop_products (name) values ('Leche'), ('Pan');
insert into public.shop_products (name, active) values ('Viejo', false);

-- seed creates one row per active product, only the first time
do $$
declare w date := date_trunc('week', current_date)::date;
begin
  assert public.shop_seed_week(w) = true, 'first seed should return true';
  assert (select count(*) from public.shop_purchases where week_of = w) = 2, 'one row per active product';
  assert public.shop_seed_week(w) = false, 'second seed should return false';
  assert (select count(*) from public.shop_purchases where week_of = w) = 2, 'no duplicates';
  assert not exists (select 1 from public.shop_purchases p join public.shop_products pr on pr.id = p.product_id
                     where p.week_of = w and not pr.active), 'inactive products are not seeded';
end $$;

-- an emptied week stays empty (Review Focus 2)
do $$
declare w date := date_trunc('week', current_date)::date;
begin
  delete from public.shop_purchases where week_of = w;
  assert public.shop_seed_week(w) = false, 'reseed after emptying returns false';
  assert (select count(*) from public.shop_purchases where week_of = w) = 0, 'emptied week stays empty';
end $$;

-- future weeks are refused
do $$
begin
  begin
    perform public.shop_seed_week(date_trunc('week', current_date)::date + 14);
    assert false, 'future week should raise';
  exception when raise_exception then
    assert sqlerrm = 'future_week', 'unexpected error ' || sqlerrm;
  end;
end $$;

-- supermarket names are unique ignoring case and surrounding spaces
insert into public.shop_supermarkets (name) values ('Pali');
do $$
begin
  begin
    insert into public.shop_supermarkets (name) values (' pali');
    assert false, 'duplicate supermarket should fail';
  exception when unique_violation then null;
  end;
end $$;

-- summary totals are rounded to 2 decimals
do $$
declare w date := date_trunc('week', current_date)::date - 7; s jsonb;
begin
  insert into public.shop_purchases (product_id, week_of, checked, checked_by, checked_at, unit_price, quantity, supermarket)
  select id, w, true, auth.uid(), now(), 1.50, 1, 'Pali' from public.shop_products where name = 'Leche';
  s := public.shop_week_summary(w);
  assert s::text like '%"total": 1.50%', 'receipt total not rounded: ' || s::text;
  assert s::text like '%"week_total": 1.50%', 'week total not rounded: ' || s::text;
end $$;

-- weekly totals: 8 weeks ascending, zero-filled
do $$
declare r record; n int := 0; prev date;
begin
  for r in select * from public.shop_weekly_totals(8) loop
    n := n + 1;
    assert prev is null or r.week_of > prev, 'not ascending';
    prev := r.week_of;
  end loop;
  assert n = 8, 'expected 8 rows, got ' || n;
  assert prev = date_trunc('week', current_date)::date, 'last row should be current week';
  assert (select total from public.shop_weekly_totals(8) where week_of = date_trunc('week', current_date)::date - 7) = 1.50, 'last week total';
  assert (select total from public.shop_weekly_totals(8) where week_of = date_trunc('week', current_date)::date - 14) = 0, 'empty week is 0';
end $$;

-- non-members see nothing and cannot write
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000dead', 'extra@otro.test');
do $$
begin
  assert (select count(*) from public.shop_supermarkets) = 0, 'non-member can read supermarkets';
  begin
    insert into public.shop_supermarkets (name) values ('Hack');
    assert false, 'non-member insert should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.shop_seed_week(date_trunc('week', current_date)::date - 21);
    assert false, 'non-member seed should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'shop_list tests done';
