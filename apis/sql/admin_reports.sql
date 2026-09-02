-- The reports.
--
-- All four are GROUP BY with SUM, which PostgREST does not do, so each is a
-- function. They share one definition of revenue with the dashboard: not
-- cancelled, and paid or partially refunded. A report that counts money never
-- taken disagrees with the bank, and the person who notices is an accountant.
--
-- The date bounds are inclusive of the whole end day - `< date_to + 1` rather
-- than `<= date_to` - matching datetime.max.time() in the SQLAlchemy version.
-- A report "to the 31st" that omitted the 31st would quietly understate the
-- month, which is the sort of error nobody catches until year end.
--
-- service_role only.

-- ---------------------------------------------------------------------------
-- Sales, bucketed by day, week or month. Shared by the JSON report and the CSV
-- export so the download can never disagree with the table it came from.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_sales(
    p_from date,
    p_to date,
    p_granularity text default 'day'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'period', bucket::date,
               'orders', n,
               'revenue', revenue,
               'discount', discount,
               'shipping', shipping,
               'tax', tax
           ) order by bucket), '[]'::jsonb)
      from (
        select date_trunc(
                   case when p_granularity in ('day','week','month')
                        then p_granularity else 'day' end,
                   o.created_at) as bucket,
               count(*) as n,
               coalesce(sum(o.grand_total), 0) as revenue,
               coalesce(sum(o.discount_total), 0) as discount,
               coalesce(sum(o.shipping_total), 0) as shipping,
               coalesce(sum(o.tax_total), 0) as tax
          from public.orders o
         where o.fulfilment_status <> 'cancelled'
           and o.payment_status in ('paid','partially_refunded')
           and o.created_at >= p_from::timestamptz
           and o.created_at < (p_to + 1)::timestamptz
         group by 1
      ) s;
$$;

-- ---------------------------------------------------------------------------
-- Best sellers, by revenue. Grouped on the NAME captured at the time of the
-- order as well as the id, exactly as the SQLAlchemy version does: an order
-- line keeps the name the customer bought under, and a product renamed since
-- should not retrospectively rewrite last quarter's report.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_top_products(
    p_from date, p_to date, p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'product_id', product_id, 'name', product_name,
               'units', units, 'revenue', revenue
           ) order by revenue desc), '[]'::jsonb)
      from (
        select oi.product_id, oi.product_name,
               sum(oi.quantity)::int as units,
               sum(oi.line_total) as revenue
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
         where o.fulfilment_status <> 'cancelled'
           and o.payment_status in ('paid','partially_refunded')
           and o.created_at >= p_from::timestamptz
           and o.created_at < (p_to + 1)::timestamptz
         group by oi.product_id, oi.product_name
         order by revenue desc
         limit p_limit
      ) t;
$$;

-- ---------------------------------------------------------------------------
-- Best customers, by spend in the window.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_top_customers(
    p_from date, p_to date, p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'customer_id', id, 'name', name, 'phone', phone,
               'orders', orders, 'spend', spend
           ) order by spend desc), '[]'::jsonb)
      from (
        select c.id, c.name, c.phone,
               count(o.id)::int as orders,
               coalesce(sum(o.grand_total), 0) as spend
          from public.customers c
          join public.orders o on o.customer_id = c.id
         where o.fulfilment_status <> 'cancelled'
           and o.payment_status in ('paid','partially_refunded')
           and o.created_at >= p_from::timestamptz
           and o.created_at < (p_to + 1)::timestamptz
         group by c.id
         order by spend desc
         limit p_limit
      ) t;
$$;

-- ---------------------------------------------------------------------------
-- Stock on hand, and what it is worth at cost.
--
-- Variants with no recorded cost are COUNTED, not valued at zero: valuing them
-- at nothing understates the holding and makes the gap look smaller than it
-- is. Only variants actually holding stock count towards that figure - a
-- discontinued line at zero units with no cost is not a gap worth chasing.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_inventory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with rows as (
        select p.id as product_id, p.name as product_name, v.sku,
               v.stock_quantity as stock, v.cost_price, v.price
          from public.products p
          join public.product_variants v on v.product_id = p.id
         where p.status <> 'archived' and v.is_active
         order by p.name
    )
    select jsonb_build_object(
        'total_units', coalesce((select sum(stock) from rows), 0),
        'stock_value_at_cost', coalesce((
            select round(sum(cost_price * stock), 2) from rows
             where cost_price is not null), 0),
        'variants_without_cost', (
            select count(*) from rows where cost_price is null and stock > 0),
        'rows', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'product_id', product_id, 'product_name', product_name,
                       'sku', sku, 'stock', stock,
                       'cost_price', cost_price, 'price', price)
                   order by product_name)
              from rows), '[]'::jsonb)
    );
$$;

revoke all on function public.nivisa_admin_sales(date, date, text) from public, anon, authenticated;
grant execute on function public.nivisa_admin_sales(date, date, text) to service_role;

revoke all on function public.nivisa_admin_top_products(date, date, integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_top_products(date, date, integer) to service_role;

revoke all on function public.nivisa_admin_top_customers(date, date, integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_top_customers(date, date, integer) to service_role;

revoke all on function public.nivisa_admin_inventory() from public, anon, authenticated;
grant execute on function public.nivisa_admin_inventory() to service_role;
