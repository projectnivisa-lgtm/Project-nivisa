-- The admin dashboard's figures, computed in the database.
--
-- WHY A FUNCTION RATHER THAN QUERIES
--   The cPanel box reaches Supabase over PostgREST, which has no SUM, no
--   GROUP BY and no joins. The alternative to a function is fetching every
--   order and every variant over HTTPS and adding them up in Python, which is
--   slow, wrong the moment the shop has real volume, and moves the definition
--   of "revenue" out of the database and into the application.
--
--   One function is also one round trip. The SQLAlchemy version issues eight
--   queries against a local socket; eight TLS round trips to another region
--   would make the landing screen of the dashboard the slowest page in it.
--
-- KEEPING IT HONEST
--   The numbers must match app/admin/routes/insights.py exactly, including
--   the awkward parts: revenue counts only orders that were actually paid and
--   not cancelled, revenue_change_pct is NULL rather than 0 when the previous
--   window earned nothing (an infinite rise is not a number), and the daily
--   series fills empty days with zero rather than omitting them, because a
--   line chart that skips days misstates its own slope.
--
-- SECURITY
--   Reads only, and granted to service_role - which the API already uses and
--   which already bypasses RLS. It is never granted to anon: these are the
--   shop's takings.
--
-- APPLYING IT
--   From a machine that can reach Postgres on 5432 - a laptop, not the box:
--       python tools/apply_sql.py apis/sql/admin_dashboard.sql
--   or paste it into the Supabase SQL editor.

create or replace function public.nivisa_admin_dashboard(days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    now_at        timestamptz := now();
    since         timestamptz := now() - make_interval(days => days);
    prev_since    timestamptz := now() - make_interval(days => days * 2);
    revenue       numeric;
    prev_revenue  numeric;
    order_count   integer;
    paid_count    integer;
    new_customers integer;
    pending_revs  integer;
    series        jsonb;
    queue         jsonb;
    low_stock     jsonb;
begin
    -- "Revenue" is money actually taken: not cancelled, and paid or partially
    -- refunded. Anything looser makes a dashboard that disagrees with the bank.
    select coalesce(sum(grand_total), 0) into revenue
      from public.orders
     where fulfilment_status <> 'cancelled'
       and payment_status in ('paid', 'partially_refunded')
       and created_at >= since and created_at < now_at;

    select coalesce(sum(grand_total), 0) into prev_revenue
      from public.orders
     where fulfilment_status <> 'cancelled'
       and payment_status in ('paid', 'partially_refunded')
       and created_at >= prev_since and created_at < since;

    select count(*) into order_count
      from public.orders
     where created_at >= since and fulfilment_status <> 'cancelled';

    select count(*) into paid_count
      from public.orders
     where fulfilment_status <> 'cancelled'
       and payment_status in ('paid', 'partially_refunded')
       and created_at >= since;

    select count(*) into new_customers
      from public.customers where created_at >= since;

    select count(*) into pending_revs
      from public.reviews where status = 'pending';

    -- generate_series, not a GROUP BY alone: a day with no orders has to
    -- appear as zero. The left join is what fills it in.
    select coalesce(jsonb_agg(jsonb_build_object(
               'date', d::date, 'orders', coalesce(o.n, 0),
               'revenue', coalesce(o.total, 0)) order by d), '[]'::jsonb)
      into series
      from generate_series(since::date, now_at::date, interval '1 day') as d
      left join (
          select created_at::date as day, count(*) as n,
                 coalesce(sum(grand_total), 0) as total
            from public.orders
           where created_at >= since and fulfilment_status <> 'cancelled'
           group by 1
      ) o on o.day = d::date;

    select coalesce(jsonb_object_agg(fulfilment_status, n), '{}'::jsonb) into queue
      from (select fulfilment_status, count(*) as n
              from public.orders
             where fulfilment_status in ('pending', 'processing', 'packed')
             group by 1) q;

    select coalesce(jsonb_agg(x order by x.stock), '[]'::jsonb) into low_stock
      from (
          select p.id as product_id, p.name as product_name,
                 v.sku, v.stock_quantity as stock
            from public.product_variants v
            join public.products p on p.id = v.product_id
           where v.is_active and not v.backorder_allowed
             and v.stock_quantity <= v.low_stock_threshold
             and p.status = 'active'
           order by v.stock_quantity
           limit 10
      ) x;

    return jsonb_build_object(
        'window_days', days,
        'revenue', round(revenue, 2),
        -- NULL, not 0, when there is nothing to compare against.
        'revenue_change_pct',
            case when prev_revenue > 0
                 then round((revenue - prev_revenue) / prev_revenue * 100, 1)
                 else null end,
        'orders', order_count,
        'paid_orders', paid_count,
        'average_order_value',
            case when paid_count > 0 then round(revenue / paid_count, 2) else 0 end,
        'new_customers', new_customers,
        'series', series,
        'queue', jsonb_build_object(
            'pending',    coalesce((queue->>'pending')::int, 0),
            'processing', coalesce((queue->>'processing')::int, 0),
            'packed',     coalesce((queue->>'packed')::int, 0)),
        'low_stock', low_stock,
        'pending_reviews', pending_revs
    );
end;
$$;

revoke all on function public.nivisa_admin_dashboard(integer) from public;
revoke all on function public.nivisa_admin_dashboard(integer) from anon;
revoke all on function public.nivisa_admin_dashboard(integer) from authenticated;
grant execute on function public.nivisa_admin_dashboard(integer) to service_role;

comment on function public.nivisa_admin_dashboard(integer) is
    'Admin dashboard figures for the HTTPS backend. service_role only.';
