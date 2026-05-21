-- RLS + grants for sc_approvers.
-- Update the policy "USING" clause to match how store_id maps to auth.uid().

-- RPC to get all approvers, bypassing RLS.
drop function if exists public.get_all_sc_approvers();
create or replace function public.get_all_sc_approvers()
returns setof sc_approvers
language sql
security definer
set search_path = public
as $$
  select * from sc_approvers;
$$;

grant execute on function public.get_all_sc_approvers() to anon, authenticated;

-- RPC to get approvers for a specific store
drop function if exists public.get_sc_approvers_by_store(uuid);
create or replace function public.get_sc_approvers_by_store(p_store_id uuid)
returns setof sc_approvers
language sql
security definer
set search_path = public
as $$
  select * from sc_approvers where store_id = p_store_id;
$$;

grant execute on function public.get_sc_approvers_by_store(uuid) to anon, authenticated;

-- RPCs (plaintext password)
drop function if exists public.sc_upsert_approver(uuid, bigint, text, text, text, text);
drop function if exists public.sc_delete_approver(uuid, bigint);
drop function if exists public.sc_upsert_approver(uuid, uuid, text, text, text, text);
drop function if exists public.sc_delete_approver(uuid, uuid);
create or replace function public.sc_upsert_approver(
  p_approver_id uuid,
  p_designation text,
  p_full_name text,
  p_password text,
  p_store_id uuid,
  p_username text
)
returns table (
  id uuid,
  full_name text,
  designation text,
  username text,
  password_hash text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_approver_id is null then
    insert into sc_approvers (store_id, full_name, designation, username, password_hash)
    values (
      p_store_id,
      p_full_name,
      p_designation,
      lower(p_username),
      p_password
    )
    returning sc_approvers.id, sc_approvers.full_name, sc_approvers.designation, sc_approvers.username, sc_approvers.password_hash
    into id, full_name, designation, username, password_hash;
  else
    update sc_approvers
    set
      full_name = p_full_name,
      designation = p_designation,
      username = lower(p_username),
      password_hash = coalesce(p_password, password_hash)
    where sc_approvers.id = p_approver_id
      and sc_approvers.store_id = p_store_id
    returning sc_approvers.id, sc_approvers.full_name, sc_approvers.designation, sc_approvers.username, sc_approvers.password_hash
    into id, full_name, designation, username, password_hash;
  end if;

  return next;
end;
$$;

create or replace function public.sc_delete_approver(
  p_approver_id uuid,
  p_store_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from sc_approvers
  where id = p_approver_id
    and store_id = p_store_id;
end;
$$;

create or replace function public.place_sc_order_gemini(
  p_approver_password text,
  p_approver_username text,
  p_items jsonb,
  p_store_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  is_valid_approver boolean;
  new_order_id uuid;
  order_total_calc numeric;
begin
  -- 1. Verify approver credentials
  select exists (
    select 1
    from sc_approvers
    where store_id = p_store_id
      and username = lower(p_approver_username)
      and password_hash = p_approver_password
  ) into is_valid_approver;

  if not is_valid_approver then
    raise exception 'Invalid approver credentials.';
  end if;

  -- 2. Calculate order total from items
  select sum((item->>'unit_price')::numeric * (item->>'qty')::numeric)
  into order_total_calc
  from jsonb_array_elements(p_items) as items(item);

  -- 3. Insert the order
  insert into sc_orders (store_id, order_total, status)
  values (p_store_id, order_total_calc, 'Pending')
  returning id into new_order_id;

  -- 4. Insert order items
  insert into sc_order_items (order_id, item_code, item_name, qty, unit_price)
  select
    new_order_id,
    item->>'item_code',
    item->>'item_name',
    (item->>'qty')::integer,
    (item->>'unit_price')::numeric
  from jsonb_array_elements(p_items) as items(item);

  -- 5. Return the new order ID
  return json_build_object('order_id', new_order_id);
end;
$$;

drop function if exists public.cancel_sc_order_gemini(text, text, uuid, uuid);
create or replace function public.cancel_sc_order_gemini(
  p_approver_password text,
  p_approver_username text,
  p_order_id uuid,
  p_store_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approver_name text;
begin
  -- 1. Verify approver credentials and get their name
  select full_name
  from sc_approvers
  where store_id = p_store_id
    and username = lower(p_approver_username)
    and password_hash = p_approver_password
  into v_approver_name;

  if v_approver_name is null then
    raise exception 'Invalid approver credentials.';
  end if;

  -- 2. CRITICAL: Set the order status to 'Pending Cancel' in the database
  update sc_orders
  set status = 'Pending Cancel',
      cancelled_by = v_approver_name
  where id = p_order_id
    and store_id = p_store_id
    and status in ('Pending', 'Processing');

  if not found then
    raise exception 'Order not found or cannot be cancelled in its current state.';
  end if;

  -- 3. Return the order ID and approver name
  return json_build_object('order_id', p_order_id, 'approver_name', v_approver_name);
end;
$$;

-- Tables for Stores and Users (if not already created)
create table if not exists public.sc_stores (
  id uuid default gen_random_uuid() primary key,
  store_name text not null,
  store_address text,
  contact_number text,
  assigned_personnel text,
  credit_limit numeric default 0,
  credit_used numeric default 0,
  terms text,
  created_at timestamptz default now()
);

create table if not exists public.sc_users (
  id uuid default gen_random_uuid() primary key,
  store_id uuid references public.sc_stores(id),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- RPC to register a new store and user transactionally
drop function if exists public.register_sc_user(text, text, text, text, numeric, text, text, text);
create or replace function public.register_sc_user(
  p_store_name text,
  p_store_address text,
  p_contact_number text,
  p_personnel text,
  p_credit_limit numeric,
  p_terms text,
  p_email text,
  p_password text
)
returns table (
  user_id uuid,
  store_id uuid,
  email text,
  store_name text,
  store_address text,
  contact_number text,
  assigned_personnel text,
  credit_limit numeric,
  terms text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_store_id uuid;
  new_user_id uuid;
begin
  -- 1. Insert Store
  insert into sc_stores (store_name, store_address, contact_number, assigned_personnel, credit_limit, terms)
  values (p_store_name, p_store_address, p_contact_number, p_personnel, p_credit_limit, p_terms)
  returning id into new_store_id;

  -- 2. Insert User
  insert into sc_users (store_id, email, password_hash)
  values (new_store_id, p_email, p_password)
  returning id into new_user_id;

  -- 3. Return details for frontend session
  return query
  select 
    new_user_id, 
    new_store_id, 
    p_email, 
    p_store_name, 
    p_store_address, 
    p_contact_number, 
    p_personnel, 
    p_credit_limit, 
    p_terms;
end;
$$;

-- Enable RLS (recommended)
alter table sc_approvers enable row level security;

-- Grants for RPC usage (recommended)
grant execute on function public.sc_upsert_approver(uuid, text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.sc_delete_approver(uuid, uuid) to anon, authenticated;
grant execute on function public.place_sc_order_gemini(text, text, jsonb, uuid) to anon, authenticated;
grant execute on function public.cancel_sc_order_gemini(text, text, uuid, uuid) to anon, authenticated;
grant execute on function public.register_sc_user(text, text, text, text, numeric, text, text, text) to anon, authenticated;

-- Ensure sc_orders has the updated_at column to support modification tracking triggers
alter table if exists public.sc_orders add column if not exists updated_at timestamptz default now();

-- Add column to track who approved the cancellation
alter table if exists public.sc_orders add column if not exists cancelled_by text;

-- Indexes for performance (Optimizes filtering orders by store and date)
create index if not exists idx_sc_orders_store_created_at on public.sc_orders (store_id, created_at desc);

-- Refresh PostgREST schema cache after changes
select pg_notify('pgrst', 'reload schema');

-- Optional: direct table access if you ever call the table directly from the client
-- grant select, insert, update, delete on table sc_approvers to anon, authenticated;

-- This file stores plaintext passwords in password_hash (hashing disabled).

-- Policy option A: store_id is auth.uid()
-- create policy "sc_approvers_select"
-- on sc_approvers
-- for select
-- using (store_id = auth.uid());

-- create policy "sc_approvers_insert"
-- on sc_approvers
-- for insert
-- with check (store_id = auth.uid());

-- create policy "sc_approvers_update"
-- on sc_approvers
-- for update
-- using (store_id = auth.uid())
-- with check (store_id = auth.uid());

-- create policy "sc_approvers_delete"
-- on sc_approvers
-- for delete
-- using (store_id = auth.uid());

-- Policy option B: store_id maps via a user -> store table
-- Replace sc_users and columns to match your schema.
-- create policy "sc_approvers_select"
-- on sc_approvers
-- for select
-- using (
--   store_id = (
--     select store_id from sc_users
--     where user_id = auth.uid()
--   )
-- );
--
-- create policy "sc_approvers_insert"
-- on sc_approvers
-- for insert
-- with check (
--   store_id = (
--     select store_id from sc_users
--     where user_id = auth.uid()
--   )
-- );
--
-- create policy "sc_approvers_update"
-- on sc_approvers
-- for update
-- using (
--   store_id = (
--     select store_id from sc_users
--     where user_id = auth.uid()
--   )
-- )
-- with check (
--   store_id = (
--     select store_id from sc_users
--     where user_id = auth.uid()
--   )
-- );
--
-- create policy "sc_approvers_delete"
-- on sc_approvers
-- for delete
-- using (
--   store_id = (
--     select store_id from sc_users
--     where user_id = auth.uid()
--   )
-- );
