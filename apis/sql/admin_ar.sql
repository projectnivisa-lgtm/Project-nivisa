-- AR: the model list and the usage report.
--
-- The list is a LEFT JOIN whose most useful filter asks about the ABSENCE of
-- the joined row - "which pieces still need a model" - and the report counts
-- distinct sessions with a filter per column. PostgREST expresses neither, so
-- both are functions.
--
-- service_role only.

-- ---------------------------------------------------------------------------
-- Every product with its AR state, including products with no asset at all.
--
-- Listing only the ones already done cannot answer the question this screen
-- exists for, so the join stays outer and `unavailable` covers both a missing
-- row and a row that has never been given a file.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_ar_list(
    p_q      text default null,
    p_status text default null,
    p_limit  integer default 25,
    p_offset integer default 0
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
        select p.id as product_id, p.name as product_name, p.slug as product_slug,
               p.status as product_status,
               a.id as asset_id, a.status as asset_status, a.version,
               a.model_url, a.ios_model_url, a.updated_at
          from public.products p
          left join public.product_ar_assets a on a.product_id = p.id
         where p.status <> 'archived'
           and (p_q is null or p.name ilike '%' || p_q || '%')
           and (p_status is null
                or (p_status = 'unavailable'
                    and (a.id is null or a.status = 'unavailable'))
                or (p_status <> 'unavailable' and a.status = p_status))
    )
    select
        (select count(*) from filtered),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'product_id', f.product_id,
                'product_name', f.product_name,
                'product_slug', f.product_slug,
                'product_status', f.product_status,
                'has_asset', f.asset_id is not null,
                'status', coalesce(f.asset_status, 'unavailable'),
                'version', coalesce(f.version, 0),
                'has_glb', f.model_url is not null,
                'has_usdz', f.ios_model_url is not null,
                'updated_at', f.updated_at
            ) order by f.product_name, f.product_id)
            from (select * from filtered
                   order by product_name, product_id
                   limit p_limit offset p_offset) f
        ), '[]'::jsonb)
    into total, items;

    return jsonb_build_object('items', items, 'total', total,
                              'limit', p_limit, 'offset', p_offset,
                              'has_more', p_offset + p_limit < total);
end;
$$;

-- ---------------------------------------------------------------------------
-- How AR is actually used: sessions that opened it, and sessions that then
-- added the product to a cart.
--
-- Distinct SESSIONS, not events: someone opening the same model four times is
-- one person looking, and counting the taps would flatter the figure.
--
-- There is deliberately no placement rate. AR is handed to the operating
-- system and neither iOS Quick Look nor Android Scene Viewer reports whether
-- the model was placed in a room. An invented number there would discredit the
-- two real ones.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_admin_ar_report(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'product_id', product_id, 'product_name', product_name,
               'opened', opened, 'added_to_cart', added
           ) order by opened desc, product_id), '[]'::jsonb)
      from (
        select e.product_id, p.name as product_name,
               count(distinct e.session_token) filter (where e.kind = 'opened')::int as opened,
               count(distinct e.session_token) filter (where e.kind = 'added_to_cart')::int as added
          from public.ar_events e
          join public.products p on p.id = e.product_id
         where e.created_at >= now() - make_interval(days => p_days)
         group by e.product_id, p.name
         order by opened desc, e.product_id
      ) t;
$$;

revoke all on function public.nivisa_admin_ar_list(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_ar_list(text, text, integer, integer) to service_role;

revoke all on function public.nivisa_admin_ar_report(integer) from public, anon, authenticated;
grant execute on function public.nivisa_admin_ar_report(integer) to service_role;
