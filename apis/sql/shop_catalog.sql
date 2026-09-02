-- The storefront catalogue: filtering, sorting, counting.
--
-- WHY THIS RETURNS IDS RATHER THAN CARDS
--   catalog.to_card builds twenty fields from a product and its variants -
--   the "from" price, the compare-at belonging to that same variant, the
--   hover image, the dimensions of the variant the price came from. Rebuilding
--   that in SQL would be a second definition of what a product card is, and
--   the two would drift.
--
--   So this does what only SQL can - descend the category tree, AND across
--   facets while OR-ing within one, order by a derived price - and returns the
--   matching ids in order plus the ratings. The application fetches those
--   products through PostgREST and runs the existing to_card over them, so a
--   card is defined once.
--
-- PARITY NOTES
--   * A category includes its DESCENDANTS: browsing "Units & Cabinets" must
--     show TV units, which sit on the leaf rather than the parent.
--   * Attribute facets OR within a kind and AND across kinds - oak *or*
--     walnut, and fabric - which is what ticking two boxes in two lists means.
--   * The variant conditions are one EXISTS, not several: "some variant matches
--     all of these", not "one is cheap and a different one is in stock".
--   * Only `active` products are ever visible. Draft and archived are staff
--     concepts and a customer meeting one is a leak.
--
-- Readable by the anon key is NOT wanted here either: the API holds
-- service_role and is the only caller.

create or replace function public.nivisa_shop_products(
    p_q            text default null,
    p_category     text default null,
    p_room         text default null,
    p_collection   text default null,
    p_brand        text default null,
    p_material     text[] default null,
    p_finish       text[] default null,
    p_colour       text[] default null,
    p_style        text[] default null,
    p_min_price    numeric default null,
    p_max_price    numeric default null,
    p_max_width_mm integer default null,
    p_seats        integer default null,
    p_in_stock     boolean default null,
    p_sort         text default 'featured',
    p_limit        integer default 24,
    p_offset       integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    category_ids integer[];
    total integer;
    ids jsonb;
    ratings jsonb;
begin
    if p_category is not null then
        with recursive tree as (
            select id from public.categories where slug = p_category
            union all
            select c.id from public.categories c join tree t on c.parent_id = t.id
        )
        select array_agg(id) into category_ids from tree;

        -- A slug nobody has is not "no filter": it is a 404, and the route
        -- raises one when this comes back empty.
        if category_ids is null then
            return jsonb_build_object('total', 0, 'ids', '[]'::jsonb,
                                      'ratings', '{}'::jsonb, 'category_missing', true);
        end if;
    end if;


    with matched as (
        select p.id,
               (select min(v.price) from public.product_variants v
                 where v.product_id = p.id and v.is_active) as from_price,
               (select avg(r.rating) from public.reviews r
                 where r.product_id = p.id and r.status = 'approved') as avg_rating,
               p.created_at
          from public.products p
         where p.status = 'active'
           and (p_category is null or p.category_id = any(category_ids))
           and (p_q is null
                or p.name ilike '%' || p_q || '%'
                or p.tagline ilike '%' || p_q || '%'
                or p.description ilike '%' || p_q || '%')
           and (p_brand is null or p.brand_id =
                (select b.id from public.brands b where b.slug = p_brand))
           and (p_seats is null or p.seating_capacity >= p_seats)
           and (p_room is null or exists (
                 select 1 from public.product_rooms pr
                  join public.rooms rm on rm.id = pr.room_id
                 where pr.product_id = p.id and rm.slug = p_room))
           and (p_collection is null or exists (
                 select 1 from public.collection_products cp
                  join public.collections cl on cl.id = cp.collection_id
                 where cp.product_id = p.id and cl.slug = p_collection))
           -- One EXISTS per facet kind: OR within, AND across.
           and (p_material is null or exists (
                 select 1 from public.product_attributes pa
                  join public.attributes a on a.id = pa.attribute_id
                 where pa.product_id = p.id and a.kind = 'material' and a.slug = any(p_material)))
           and (p_finish is null or exists (
                 select 1 from public.product_attributes pa
                  join public.attributes a on a.id = pa.attribute_id
                 where pa.product_id = p.id and a.kind = 'finish' and a.slug = any(p_finish)))
           and (p_colour is null or exists (
                 select 1 from public.product_attributes pa
                  join public.attributes a on a.id = pa.attribute_id
                 where pa.product_id = p.id and a.kind = 'colour' and a.slug = any(p_colour)))
           and (p_style is null or exists (
                 select 1 from public.product_attributes pa
                  join public.attributes a on a.id = pa.attribute_id
                 where pa.product_id = p.id and a.kind = 'style' and a.slug = any(p_style)))
           -- All variant conditions satisfied by the SAME variant.
           and (
                (p_min_price is null and p_max_price is null
                 and p_max_width_mm is null and p_in_stock is not true)
                or exists (
                     select 1 from public.product_variants v
                      where v.product_id = p.id and v.is_active
                        and (p_min_price is null or v.price >= p_min_price)
                        and (p_max_price is null or v.price <= p_max_price)
                        and (p_max_width_mm is null or v.width_mm <= p_max_width_mm)
                        and (p_in_stock is not true
                             or v.stock_quantity > 0 or v.backorder_allowed)))
    )
    select
        (select count(*) from matched),
        coalesce((
            select jsonb_agg(m.id order by m.ord)
              from (
                select id, row_number() over (
                        order by
                          case when p_sort = 'price_asc'  then from_price end asc nulls last,
                          case when p_sort = 'price_desc' then from_price end desc nulls last,
                          case when p_sort = 'rating'     then avg_rating end desc nulls last,
                          created_at desc,
                          id desc
                       ) as ord
                  from matched
              ) m
             where m.ord > p_offset and m.ord <= p_offset + p_limit
        ), '[]'::jsonb)
    into total, ids;

    select coalesce(jsonb_object_agg(product_id::text,
               jsonb_build_array(round(avg_rating, 2), n)), '{}'::jsonb)
      into ratings
      from (
        select r.product_id, avg(r.rating) as avg_rating, count(*)::int as n
          from public.reviews r
         where r.status = 'approved'
           and r.product_id in (select (value#>>'{}')::int from jsonb_array_elements(ids))
         group by r.product_id
      ) t;

    return jsonb_build_object('total', total, 'ids', ids, 'ratings', ratings);
end;
$$;

revoke all on function public.nivisa_shop_products(
    text, text, text, text, text, text[], text[], text[], text[],
    numeric, numeric, integer, integer, boolean, text, integer, integer) from public, anon, authenticated;
grant execute on function public.nivisa_shop_products(
    text, text, text, text, text, text[], text[], text[], text[],
    numeric, numeric, integer, integer, boolean, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Everything the filter panel needs, in one call.
--
-- Only attributes actually present on a VISIBLE product are returned: a filter
-- that can only ever return nothing is worse than no filter. Same for brands.
-- The price range spans active variants of visible products, so the slider
-- cannot be dragged to a price nothing is sold at.
-- ---------------------------------------------------------------------------
create or replace function public.nivisa_shop_filters()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'attributes', coalesce((
            select jsonb_object_agg(kind, items)
              from (
                select a.kind,
                       -- Every field AttributeOut declares. Building the
                       -- object by hand means a column left out here is a
                       -- field silently missing from the filter panel, which
                       -- is how hex_code went absent the first time.
                       jsonb_agg(jsonb_build_object(
                           'id', a.id, 'kind', a.kind, 'name', a.name,
                           'slug', a.slug, 'hex_code', a.hex_code,
                           'position', a.position,
                           'is_active', a.is_active)
                       order by a.position, a.name) as items
                  from public.attributes a
                 where a.is_active
                   and exists (select 1 from public.product_attributes pa
                                join public.products p on p.id = pa.product_id
                               where pa.attribute_id = a.id and p.status = 'active')
                 group by a.kind
              ) g), '{}'::jsonb),
        'brands', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', b.id, 'name', b.name, 'slug', b.slug,
                       'description', b.description, 'logo_url', b.logo_url,
                       'is_active', b.is_active) order by b.name)
              from public.brands b
             where b.is_active
               and exists (select 1 from public.products p
                            where p.brand_id = b.id and p.status = 'active')), '[]'::jsonb),
        'price', (
            select jsonb_build_object(
                       'min', coalesce(min(v.price), 0),
                       'max', coalesce(max(v.price), 0))
              from public.product_variants v
              join public.products p on p.id = v.product_id
             where p.status = 'active' and v.is_active)
    );
$$;

revoke all on function public.nivisa_shop_filters() from public, anon, authenticated;
grant execute on function public.nivisa_shop_filters() to service_role;
