-- The admin product list, computed in the database.
--
-- WHY A FUNCTION
--   PostgREST can filter and embed, but this endpoint also searches across a
--   product's name AND its variants' SKUs, filters through three join tables
--   (rooms, collections, AR assets), and sorts by values that only exist once
--   a product's variants are aggregated - lowest active price, total stock.
--   Composing that as PostgREST query strings would be fragile in a way that
--   fails quietly: a filter PostgREST does not understand comes back as 200
--   and an empty list, which looks like a catalogue with nothing in it.
--
--   The SQLAlchemy version also cheats slightly - it fetches up to 500 rows
--   and sorts price and stock in Python, because those are derived. In SQL
--   they are just aggregates, so this is both simpler and correct for a
--   catalogue larger than 500.
--
-- PARITY NOTES - the fiddly bits, reproduced deliberately
--   * price_from is the lowest ACTIVE variant's price, falling back to the
--     lowest of any variant when none are active, so a card never shows zero
--     for a product that plainly has a price.
--   * low_stock is true if ANY active, non-backorder variant is at or below
--     its own threshold - per variant, not against a global number.
--   * ar_status 'missing' covers both a product with no AR row and one whose
--     row says 'unavailable': to a merchandiser those are the same thing.
--   * A collection IS its order, so filtering by one sorts by the
--     merchandiser's position and ignores `sort`.
--
-- SECURITY
--   Read-only, service_role only. Never granted to anon - it exposes cost
--   prices indirectly through nothing here, but it is the admin catalogue and
--   has no business being public.

create or replace function public.nivisa_admin_products(
    p_q             text default null,
    p_status        text default null,
    p_category_id   integer default null,
    p_brand_id      integer default null,
    p_room_id       integer default null,
    p_collection_id integer default null,
    p_stock         text default null,
    p_ar            text default null,
    p_sort          text default 'recent',
    p_limit         integer default 25,
    p_offset        integer default 0
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
    -- One statement, with `filtered` referenced twice: once to count the whole
    -- result and once to build the page. A CTE does not survive into a second
    -- statement, and computing the total from the paged rows would report the
    -- page size as the total.
    with base as (
        select
            p.id, p.name, p.slug, p.status, p.updated_at,
            p.category_id, p.brand_id,
            -- Lowest ACTIVE variant price, falling back to the lowest of any
            -- variant, so a card never shows zero for a product with a price.
            coalesce(min(v.price) filter (where v.is_active), min(v.price), 0) as price_from,
            coalesce(sum(v.stock_quantity), 0) as total_stock,
            count(v.id) as variant_count,
            -- Per variant against its OWN threshold, not a global number.
            coalesce(bool_or(v.is_active and not v.backorder_allowed
                             and v.stock_quantity <= v.low_stock_threshold), false) as low_stock,
            coalesce(bool_or(v.is_active
                             and (v.backorder_allowed or v.stock_quantity > 0)), false) as in_stock,
            ar.status as ar_status,
            cp.position as collection_position
        from public.products p
        left join public.product_variants v on v.product_id = p.id
        left join public.product_ar_assets ar on ar.product_id = p.id
        left join public.collection_products cp
               on cp.product_id = p.id and cp.collection_id = p_collection_id
        where (p_status is null or p.status = p_status)
          and (p_category_id is null or p.category_id = p_category_id)
          and (p_brand_id is null or p.brand_id = p_brand_id)
          and (p_collection_id is null or cp.collection_id is not null)
          and (p_room_id is null or exists (
                  select 1 from public.product_rooms pr
                   where pr.product_id = p.id and pr.room_id = p_room_id))
          and (p_ar is null
               or (p_ar = 'missing' and (ar.id is null or ar.status = 'unavailable'))
               or (p_ar <> 'missing' and ar.status = p_ar))
          -- Name OR sku: staff search by the number on the box far more often
          -- than by the marketing name.
          and (p_q is null or p.name ilike '%' || p_q || '%'
               or exists (select 1 from public.product_variants v2
                           where v2.product_id = p.id and v2.sku ilike '%' || p_q || '%'))
        group by p.id, ar.status, cp.position
    ),
    filtered as (
        select * from base
         where p_stock is null
            or (p_stock = 'low' and low_stock)
            or (p_stock = 'out' and not in_stock)
            or (p_stock = 'in'  and in_stock)
    )
    select
        (select count(*) from filtered),
        coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
                'category', case when c.id is null then null else jsonb_build_object(
                    'id', c.id, 'parent_id', c.parent_id, 'name', c.name, 'slug', c.slug,
                    'description', c.description, 'image_url', c.image_url,
                    'position', c.position, 'is_active', c.is_active) end,
                'brand', case when b.id is null then null else jsonb_build_object(
                    'id', b.id, 'name', b.name, 'slug', b.slug,
                    'description', b.description, 'logo_url', b.logo_url,
                    'is_active', b.is_active) end,
                'price_from', o.price_from,
                'total_stock', o.total_stock,
                'variant_count', o.variant_count,
                'low_stock', o.low_stock,
                'primary_image', (
                    -- A studio shot if there is one, otherwise the first image.
                    select jsonb_build_object('id', i.id, 'url', i.url,
                               'alt_text', i.alt_text, 'kind', i.kind,
                               'position', i.position, 'variant_id', i.variant_id)
                      from public.product_images i
                     where i.product_id = o.id
                     order by (i.kind = 'studio') desc, i.position, i.id
                     limit 1),
                'updated_at', o.updated_at,
                'ar_status', o.ar_status
            ) order by o.ord)
            from (
                select f.*, row_number() over (
                    order by
                        -- A collection IS its order: the merchandiser decided
                        -- what a customer sees first, so `sort` is ignored.
                        case when p_collection_id is not null then f.collection_position end asc nulls last,
                        case when p_collection_id is null and p_sort = 'name' then f.name end asc,
                        case when p_collection_id is null and p_sort = 'price_asc' then f.price_from end asc,
                        case when p_collection_id is null and p_sort = 'price_desc' then f.price_from end desc,
                        case when p_collection_id is null and p_sort = 'stock' then f.total_stock end asc,
                        case when p_collection_id is null
                              and p_sort not in ('name','price_asc','price_desc','stock')
                             then f.updated_at end desc,
                        f.id desc
                ) as ord
                from filtered f
                order by ord
                limit p_limit offset p_offset
            ) o
            left join public.categories c on c.id = o.category_id
            left join public.brands b on b.id = o.brand_id
        ), '[]'::jsonb)
    into total, items;

    return jsonb_build_object(
        'items', items, 'total', total,
        'limit', p_limit, 'offset', p_offset,
        'has_more', p_offset + p_limit < total
    );
end;
$$;

revoke all on function public.nivisa_admin_products(
    text, text, integer, integer, integer, integer, text, text, text, integer, integer) from public;
revoke all on function public.nivisa_admin_products(
    text, text, integer, integer, integer, integer, text, text, text, integer, integer) from anon;
revoke all on function public.nivisa_admin_products(
    text, text, integer, integer, integer, integer, text, text, text, integer, integer) from authenticated;
grant execute on function public.nivisa_admin_products(
    text, text, integer, integer, integer, integer, text, text, text, integer, integer) to service_role;
