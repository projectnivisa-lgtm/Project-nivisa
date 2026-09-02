-- The two admin lists that aggregate across tables.
--
-- Customers carry lifetime figures and orders carry a line count, so neither
-- is a plain table read and neither is something PostgREST can express. Both
-- follow the same shape as nivisa_admin_products: one function, one round
-- trip, and the derived values computed where the rows are.
--
-- service_role only, like the rest.

-- ---------------------------------------------------------------------------
-- Customers, with lifetime order count and spend.
--
-- The figures come from one grouped subquery joined onto the page, not a
-- query per row - the customer list is the screen most likely to be left open,
-- and an N+1 here is twenty-five round trips on every refresh.
--
-- Cancelled orders are excluded from spend: money that was never taken is not
-- revenue, and a "top customer" built on it is misleading.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_customers(
    p_q         text default null,
    p_is_active boolean default null,
    p_limit     integer default 25,
    p_offset    integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    total integer;
    items jsonb;
begin
    with filtered as (
        select c.id, c.name, c.phone, c.email, c.is_active, c.created_at
          from public.customers c
         where (p_is_active is null or c.is_active = p_is_active)
           and (p_q is null
                or c.name  ilike '%' || p_q || '%'
                or c.phone ilike '%' || p_q || '%'
                or c.email ilike '%' || p_q || '%')
    )
    select
        (select count(*) from filtered),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', f.id, 'name', f.name, 'phone', f.phone, 'email', f.email,
                'is_active', f.is_active, 'created_at', f.created_at,
                'order_count', coalesce(s.order_count, 0),
                'total_spend', coalesce(s.total_spend, 0),
                'last_order_at', s.last_order_at
            ) order by f.created_at desc, f.id desc)
            from (select * from filtered
                   order by created_at desc, id desc
                   limit p_limit offset p_offset) f
            left join (
                select o.customer_id,
                       count(*) as order_count,
                       coalesce(sum(o.grand_total), 0) as total_spend,
                       max(o.created_at) as last_order_at
                  from public.orders o
                 where o.fulfilment_status <> 'cancelled'
                 group by o.customer_id
            ) s on s.customer_id = f.id
        ), '[]'::jsonb)
    into total, items;

    return jsonb_build_object('items', items, 'total', total,
                              'limit', p_limit, 'offset', p_offset,
                              'has_more', p_offset + p_limit < total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders, with a line count.
--
-- `q` searches the order number AND the customer's name and phone, because
-- that is how a customer on the telephone identifies themselves - rarely by
-- the number on an email they cannot find.
--
-- The date bounds are inclusive of the whole end day, matching the SQLAlchemy
-- version's datetime.max.time(): a filter "up to the 5th" that silently
-- excluded the 5th would hide the orders someone is looking for.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_orders(
    p_q          text default null,
    p_fulfilment text default null,
    p_payment    text default null,
    p_date_from  date default null,
    p_date_to    date default null,
    p_limit      integer default 25,
    p_offset     integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    total integer;
    items jsonb;
begin
    with filtered as (
        select o.id, o.order_number, o.fulfilment_status, o.payment_status,
               o.grand_total, o.currency, o.placed_at, o.created_at
          from public.orders o
          left join public.customers c on c.id = o.customer_id
         where (p_fulfilment is null or o.fulfilment_status = p_fulfilment)
           and (p_payment is null or o.payment_status = p_payment)
           and (p_date_from is null or o.created_at >= p_date_from::timestamptz)
           and (p_date_to is null
                or o.created_at < (p_date_to + 1)::timestamptz)
           and (p_q is null
                or o.order_number ilike '%' || p_q || '%'
                or c.phone ilike '%' || p_q || '%'
                or c.name  ilike '%' || p_q || '%')
    )
    select
        (select count(*) from filtered),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', f.id, 'order_number', f.order_number,
                'fulfilment_status', f.fulfilment_status,
                'payment_status', f.payment_status,
                'grand_total', f.grand_total, 'currency', f.currency,
                'item_count', coalesce((
                    select sum(oi.quantity) from public.order_items oi
                     where oi.order_id = f.id), 0),
                'placed_at', f.placed_at, 'created_at', f.created_at
            ) order by f.created_at desc, f.id desc)
            from (select * from filtered
                   order by created_at desc, id desc
                   limit p_limit offset p_offset) f
        ), '[]'::jsonb)
    into total, items;

    return jsonb_build_object('items', items, 'total', total,
                              'limit', p_limit, 'offset', p_offset,
                              'has_more', p_offset + p_limit < total);
end;
$$;

revoke all on function public.nivisa_admin_customers(text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_customers(text, boolean, integer, integer) to service_role;

revoke all on function public.nivisa_admin_orders(text, text, text, date, date, integer, integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_orders(text, text, text, date, date, integer, integer) to service_role;
