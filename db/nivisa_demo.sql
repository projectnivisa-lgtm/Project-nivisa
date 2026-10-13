--
-- PostgreSQL database dump
--

\restrict rdrNEPLwdtk0x8YK9kcEfL8FPGnjPR7mgIh19u0X60kRegpDsc4fffQUh5yI6MG

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    kind character varying(16) NOT NULL,
    label character varying(40),
    full_name character varying(160) NOT NULL,
    phone character varying(20) NOT NULL,
    line1 character varying(240) NOT NULL,
    line2 character varying(240),
    landmark character varying(160),
    city character varying(120) NOT NULL,
    state character varying(120) NOT NULL,
    postal_code character varying(12) NOT NULL,
    country character varying(2) NOT NULL,
    is_default boolean NOT NULL,
    is_archived boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_address_kind CHECK (((kind)::text = ANY ((ARRAY['shipping'::character varying, 'billing'::character varying])::text[])))
);


--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: ar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_events (
    id integer NOT NULL,
    product_id integer NOT NULL,
    kind character varying(16) NOT NULL,
    session_token character varying(64) NOT NULL,
    platform character varying(16),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ar_event_kind CHECK (((kind)::text = ANY ((ARRAY['opened'::character varying, 'added_to_cart'::character varying])::text[])))
);


--
-- Name: ar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ar_events_id_seq OWNED BY public.ar_events.id;


--
-- Name: attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attributes (
    id integer NOT NULL,
    kind character varying(32) NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(140) NOT NULL,
    hex_code character varying(9),
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_attribute_kind CHECK (((kind)::text = ANY ((ARRAY['material'::character varying, 'finish'::character varying, 'colour'::character varying, 'style'::character varying, 'upholstery'::character varying])::text[])))
);


--
-- Name: attributes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attributes_id_seq OWNED BY public.attributes.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_id integer,
    actor_name character varying(160),
    actor_email character varying(190),
    action character varying(60) NOT NULL,
    entity character varying(60) NOT NULL,
    entity_id character varying(60),
    summary character varying(400),
    changes jsonb,
    ip_address character varying(64),
    user_agent character varying(300),
    status character varying(16) NOT NULL,
    response_status integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id integer NOT NULL,
    title character varying(200) NOT NULL,
    subtitle character varying(300),
    image_url character varying(500) NOT NULL,
    mobile_image_url character varying(500),
    alt_text character varying(300) NOT NULL,
    link_url character varying(500),
    cta_label character varying(60),
    placement character varying(32) NOT NULL,
    "position" integer NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.banners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: banners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.banners_id_seq OWNED BY public.banners.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(180) NOT NULL,
    description text,
    logo_url character varying(500),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_cart_item_quantity CHECK ((quantity > 0))
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id integer NOT NULL,
    customer_id integer,
    session_token character varying(64),
    coupon_code character varying(40),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: carts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    parent_id integer,
    name character varying(160) NOT NULL,
    slug character varying(180) NOT NULL,
    description text,
    image_url character varying(500),
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: collection_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_products (
    collection_id integer NOT NULL,
    product_id integer NOT NULL,
    "position" integer NOT NULL
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(180) NOT NULL,
    description text,
    image_url character varying(500),
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    is_featured boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: coupon_redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_redemptions (
    id integer NOT NULL,
    coupon_id integer NOT NULL,
    customer_id integer,
    order_id integer,
    amount numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupon_redemptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupon_redemptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupon_redemptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupon_redemptions_id_seq OWNED BY public.coupon_redemptions.id;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    description character varying(300),
    discount_type character varying(10) NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    max_discount numeric(12,2),
    min_order_value numeric(12,2) NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    usage_limit integer,
    usage_limit_per_customer integer,
    used_count integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_coupon_type CHECK (((discount_type)::text = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::text[])))
);


--
-- Name: coupons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: coupons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    name character varying(160),
    email character varying(190),
    is_active boolean NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: homepage_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_sections (
    id integer NOT NULL,
    kind character varying(40) NOT NULL,
    title character varying(200),
    subtitle character varying(300),
    config jsonb NOT NULL,
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: homepage_sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.homepage_sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: homepage_sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.homepage_sections_id_seq OWNED BY public.homepage_sections.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    delta integer NOT NULL,
    balance_after integer NOT NULL,
    reason character varying(32) NOT NULL,
    note character varying(300),
    order_id integer,
    staff_user_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_events (
    id integer NOT NULL,
    order_id integer NOT NULL,
    kind character varying(32) NOT NULL,
    message character varying(400) NOT NULL,
    from_value character varying(40),
    to_value character varying(40),
    staff_user_id integer,
    staff_name character varying(160),
    customer_visible boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_events_id_seq OWNED BY public.order_events.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    variant_id integer,
    product_id integer,
    product_name character varying(240) NOT NULL,
    variant_label character varying(160),
    sku character varying(64) NOT NULL,
    image_url character varying(500),
    unit_price numeric(12,2) NOT NULL,
    quantity integer NOT NULL,
    discount_amount numeric(12,2) NOT NULL,
    tax_rate numeric(5,2) NOT NULL,
    tax_amount numeric(12,2) NOT NULL,
    line_total numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_number character varying(32) NOT NULL,
    customer_id integer,
    fulfilment_status character varying(20) NOT NULL,
    payment_status character varying(24) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount_total numeric(12,2) NOT NULL,
    shipping_total numeric(12,2) NOT NULL,
    tax_total numeric(12,2) NOT NULL,
    grand_total numeric(12,2) NOT NULL,
    refunded_total numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    coupon_code character varying(40),
    shipping_address jsonb NOT NULL,
    billing_address jsonb,
    customer_note text,
    staff_note text,
    courier_name character varying(120),
    tracking_number character varying(120),
    tracking_url character varying(500),
    placed_at timestamp with time zone,
    paid_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason character varying(300),
    expected_delivery_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_order_fulfilment_status CHECK (((fulfilment_status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'packed'::character varying, 'dispatched'::character varying, 'delivered'::character varying, 'cancelled'::character varying, 'returned'::character varying])::text[]))),
    CONSTRAINT ck_order_payment_status CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying, 'partially_refunded'::character varying])::text[])))
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_challenges (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    code_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    attempts integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_challenges_id_seq OWNED BY public.otp_challenges.id;


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id integer NOT NULL,
    slug character varying(120) NOT NULL,
    title character varying(200) NOT NULL,
    body text NOT NULL,
    meta_title character varying(200),
    meta_description character varying(400),
    is_published boolean NOT NULL,
    is_system boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    order_id integer NOT NULL,
    provider character varying(32) NOT NULL,
    provider_reference character varying(120),
    method character varying(40),
    amount numeric(12,2) NOT NULL,
    status character varying(20) NOT NULL,
    failure_reason character varying(300),
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_payment_status CHECK (((status)::text = ANY ((ARRAY['initiated'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: product_ar_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_ar_assets (
    id integer NOT NULL,
    product_id integer NOT NULL,
    status character varying(16) NOT NULL,
    model_url character varying(500),
    ios_model_url character varying(500),
    poster_url character varying(500),
    real_width_mm integer,
    real_height_mm integer,
    real_depth_mm integer,
    scale_mode character varying(8) NOT NULL,
    placement character varying(8) NOT NULL,
    version integer NOT NULL,
    validation_note text,
    uploaded_by integer,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ar_placement CHECK (((placement)::text = ANY ((ARRAY['floor'::character varying, 'wall'::character varying])::text[]))),
    CONSTRAINT ck_ar_scale_mode CHECK (((scale_mode)::text = ANY ((ARRAY['fixed'::character varying, 'manual'::character varying])::text[]))),
    CONSTRAINT ck_ar_status CHECK (((status)::text = ANY ((ARRAY['unavailable'::character varying, 'processing'::character varying, 'ready'::character varying, 'failed'::character varying, 'deprecated'::character varying])::text[])))
);


--
-- Name: product_ar_assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_ar_assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_ar_assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_ar_assets_id_seq OWNED BY public.product_ar_assets.id;


--
-- Name: product_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_attributes (
    product_id integer NOT NULL,
    attribute_id integer NOT NULL
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    url character varying(500) NOT NULL,
    alt_text character varying(300) NOT NULL,
    kind character varying(24) NOT NULL,
    "position" integer NOT NULL,
    variant_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_rooms (
    product_id integer NOT NULL,
    room_id integer NOT NULL
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id integer NOT NULL,
    product_id integer NOT NULL,
    sku character varying(64) NOT NULL,
    option_label character varying(160),
    price numeric(12,2) NOT NULL,
    compare_at_price numeric(12,2),
    cost_price numeric(12,2),
    tax_rate numeric(5,2) NOT NULL,
    stock_quantity integer NOT NULL,
    low_stock_threshold integer NOT NULL,
    backorder_allowed boolean NOT NULL,
    width_mm integer,
    depth_mm integer,
    height_mm integer,
    weight_g integer,
    boxed_width_mm integer,
    boxed_depth_mm integer,
    boxed_height_mm integer,
    lead_time_days integer,
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_variant_price_non_negative CHECK ((price >= (0)::numeric)),
    CONSTRAINT ck_variant_stock_non_negative CHECK ((stock_quantity >= 0))
);


--
-- Name: product_variants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_variants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_variants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_variants_id_seq OWNED BY public.product_variants.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(240) NOT NULL,
    slug character varying(260) NOT NULL,
    tagline character varying(300),
    description text,
    category_id integer,
    brand_id integer,
    status character varying(16) NOT NULL,
    assembly_required boolean,
    assembly_note text,
    warranty_months integer,
    care_instructions text,
    seating_capacity integer,
    specifications jsonb,
    meta_title character varying(200),
    meta_description character varying(400),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_product_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: recently_viewed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recently_viewed (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    product_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recently_viewed_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recently_viewed_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recently_viewed_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recently_viewed_id_seq OWNED BY public.recently_viewed.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    product_id integer NOT NULL,
    customer_id integer,
    rating integer NOT NULL,
    title character varying(200),
    body text,
    author_name character varying(160) NOT NULL,
    status character varying(16) NOT NULL,
    is_verified_purchase boolean NOT NULL,
    staff_reply text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_review_rating CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT ck_review_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    slug character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    permissions jsonb NOT NULL,
    is_system boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    slug character varying(140) NOT NULL,
    description text,
    image_url character varying(500),
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer NOT NULL,
    key character varying(80) NOT NULL,
    value jsonb NOT NULL,
    label character varying(160) NOT NULL,
    "group" character varying(40) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settings_id_seq OWNED BY public.settings.id;


--
-- Name: shipping_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_rates (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    postcode_prefixes character varying(500) NOT NULL,
    rate numeric(12,2) NOT NULL,
    free_above numeric(12,2),
    estimated_days_min integer,
    estimated_days_max integer,
    "position" integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shipping_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shipping_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shipping_rates_id_seq OWNED BY public.shipping_rates.id;


--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_users (
    id integer NOT NULL,
    name character varying(160) NOT NULL,
    email character varying(190) NOT NULL,
    phone character varying(20),
    password_hash character varying(255) NOT NULL,
    role_id integer NOT NULL,
    is_active boolean NOT NULL,
    last_login_at timestamp with time zone,
    must_change_password boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_users_id_seq OWNED BY public.staff_users.id;


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    product_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wishlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.wishlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wishlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.wishlists_id_seq OWNED BY public.wishlists.id;


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: ar_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_events ALTER COLUMN id SET DEFAULT nextval('public.ar_events_id_seq'::regclass);


--
-- Name: attributes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes ALTER COLUMN id SET DEFAULT nextval('public.attributes_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: banners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners ALTER COLUMN id SET DEFAULT nextval('public.banners_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: carts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: coupon_redemptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions ALTER COLUMN id SET DEFAULT nextval('public.coupon_redemptions_id_seq'::regclass);


--
-- Name: coupons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: homepage_sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_sections ALTER COLUMN id SET DEFAULT nextval('public.homepage_sections_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: order_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events ALTER COLUMN id SET DEFAULT nextval('public.order_events_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_challenges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_challenges ALTER COLUMN id SET DEFAULT nextval('public.otp_challenges_id_seq'::regclass);


--
-- Name: pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages ALTER COLUMN id SET DEFAULT nextval('public.pages_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: product_ar_assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ar_assets ALTER COLUMN id SET DEFAULT nextval('public.product_ar_assets_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_variants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants ALTER COLUMN id SET DEFAULT nextval('public.product_variants_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: recently_viewed id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed ALTER COLUMN id SET DEFAULT nextval('public.recently_viewed_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings ALTER COLUMN id SET DEFAULT nextval('public.settings_id_seq'::regclass);


--
-- Name: shipping_rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates ALTER COLUMN id SET DEFAULT nextval('public.shipping_rates_id_seq'::regclass);


--
-- Name: staff_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_users ALTER COLUMN id SET DEFAULT nextval('public.staff_users_id_seq'::regclass);


--
-- Name: wishlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists ALTER COLUMN id SET DEFAULT nextval('public.wishlists_id_seq'::regclass);


--
-- Data for Name: attributes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attributes (id, kind, name, slug, hex_code, "position", is_active, created_at, updated_at) FROM stdin;
1	material	Solid Teak	solid-teak	\N	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	material	Solid Sheesham	solid-sheesham	\N	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	material	Mango Wood	mango-wood	\N	2	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	material	Rattan	rattan	\N	3	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	material	Powder-coated Steel	powder-coated-steel	\N	4	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	material	Marble	marble	\N	5	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
7	finish	Natural Oil	natural-oil	\N	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
8	finish	Walnut Stain	walnut-stain	\N	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
9	finish	Matte Black	matte-black	\N	2	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
10	finish	Whitewash	whitewash	\N	3	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
11	finish	Honey Lacquer	honey-lacquer	\N	4	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
12	colour	Sand	sand	#D8CBB8	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
13	colour	Terracotta	terracotta	#B4552D	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
14	colour	Ink	ink	#1C1917	2	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
15	colour	Verdigris	verdigris	#5C7A6B	3	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
16	colour	Ochre	ochre	#C98A2B	4	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
17	style	Contemporary	contemporary	\N	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
18	style	Mid-century	mid-century	\N	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
19	style	Rustic	rustic	\N	2	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
20	style	Minimal	minimal	\N	3	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
21	upholstery	Cotton Weave	cotton-weave	\N	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
22	upholstery	Boucle	boucle	\N	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
23	upholstery	Full-grain Leather	full-grain-leather	\N	2	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
24	upholstery	Linen	linen	\N	3	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
\.


--
-- Data for Name: banners; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.banners (id, title, subtitle, image_url, mobile_image_url, alt_text, link_url, cta_label, placement, "position", starts_at, ends_at, is_active, created_at, updated_at) FROM stdin;
1	Made in Bengaluru, built to last	Solid wood furniture, finished by hand.	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2400&h=1000&q=80	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1200&h=1500&q=80	A living room with a low teak sofa and a marble coffee table	/shop	Shop all furniture	home_hero	0	\N	\N	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brands (id, name, slug, description, logo_url, is_active, created_at, updated_at) FROM stdin;
1	Nivisa Studio	nivisa-studio	\N	\N	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	Teak & Twine	teak-twine	\N	\N	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	Coromandel Works	coromandel-works	\N	\N	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, parent_id, name, slug, description, image_url, "position", is_active, created_at, updated_at) FROM stdin;
1	\N	Seating	seating	\N	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
2	1	Sofas	sofas	\N	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
3	1	Armchairs	armchairs	\N	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
4	1	Dining Chairs	dining-chairs	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
5	1	Benches	benches	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	3	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
6	\N	Tables	tables	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
7	6	Dining Tables	dining-tables	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
8	6	Coffee Tables	coffee-tables	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
9	6	Side Tables	side-tables	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
10	6	Desks	desks	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	3	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
11	\N	Storage	storage	\N	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
12	11	Wardrobes	wardrobes	\N	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
13	11	Sideboards	sideboards	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
14	11	Bookcases	bookcases	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
15	11	Chests	chests	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	3	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
16	\N	Beds	beds	\N	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&h=900&q=80	3	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
17	16	Bed Frames	bed-frames	\N	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
18	16	Headboards	headboards	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
19	\N	Lighting	lighting	\N	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&h=900&q=80	4	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
20	19	Floor Lamps	floor-lamps	\N	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
21	19	Table Lamps	table-lamps	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
22	19	Pendants	pendants	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
\.


--
-- Data for Name: collection_products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collection_products (collection_id, product_id, "position") FROM stdin;
1	1	0
1	2	1
1	3	2
1	4	3
1	5	4
1	6	5
2	3	0
2	4	1
2	5	2
2	6	3
2	7	4
2	8	5
3	11	101
2	12	102
3	13	103
4	15	105
4	17	107
3	19	109
4	20	110
3	22	112
3	24	114
4	25	115
3	26	116
4	31	121
3	35	125
3	36	126
4	39	129
3	40	130
2	42	132
3	47	137
\.


--
-- Data for Name: collections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collections (id, name, slug, description, image_url, "position", is_active, is_featured, created_at, updated_at) FROM stdin;
1	New This Season	new-this-season	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	0	t	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
2	Best Sellers	best-sellers	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	1	t	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
3	Small Spaces	small-spaces	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	2	t	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
4	The Teak Edit	the-teak-edit	\N	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&h=900&q=80	3	t	f	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coupons (id, code, description, discount_type, discount_value, max_discount, min_order_value, starts_at, ends_at, usage_limit, usage_limit_per_customer, used_count, is_active, created_at, updated_at) FROM stdin;
1	WELCOME10	10% off a first order, capped at Rs 5,000.	percent	10.00	5000.00	20000.00	2026-08-31 11:35:24.533028+00	2027-08-31 11:35:24.533028+00	\N	1	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	FLAT2000	Rs 2,000 off orders over Rs 40,000.	fixed	2000.00	\N	40000.00	2026-08-31 11:35:24.533028+00	2026-11-29 11:35:24.533028+00	200	\N	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
\.


--
-- Data for Name: homepage_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.homepage_sections (id, kind, title, subtitle, config, "position", is_active, created_at, updated_at) FROM stdin;
5	hero	Furniture that fits the room you actually have.	Every piece lists its real dimensions before you buy, arrives assembled by our own team, and is built from materials we name in full. No showroom markup.	{"stats": [{"label": "Structural warranty", "value": "10 yr"}, {"label": "Delivery & assembly", "value": "Free"}, {"label": "No-questions returns", "value": "7 day"}], "eyebrow": "Measured for Indian homes", "primary_cta": {"href": "/shop", "label": "Shop all furniture"}, "secondary_cta": {"href": "/rooms/living", "label": "Start with the living room"}}	0	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
6	banner	\N	\N	{"placement": "home_hero"}	6	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
7	collection_rail	New this season	Pieces that have just come off the bench.	{"limit": 8, "collection_slug": "new-this-season"}	3	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
8	room_grid	Shop by room	Start where you are standing.	{}	2	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
9	collection_rail	Best sellers	What our customers keep coming back for.	{"limit": 8, "collection_slug": "best-sellers"}	4	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
10	trust	The parts of furniture shopping that usually go wrong.	\N	{"pillars": [{"body": "Solid teak, or engineered wood. It says which, on every listing.", "icon": "material", "title": "We name the material"}, {"body": "Real width, depth and height, so you can check it fits first.", "icon": "measure", "title": "Measured before you buy"}, {"body": "Our own team carries it in and builds it. No third-party handover.", "icon": "delivery", "title": "Delivered and assembled"}, {"body": "On the frame and the joinery, which is what actually fails.", "icon": "warranty", "title": "Ten-year structural warranty"}]}	5	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
11	editorial	Built to be lived with, not looked after.	Every piece is finished by hand in our Bengaluru workshop, so the grain and tone vary a little from one to the next.	{"cta": {"href": "/shop?sort=newest", "label": "See what is new"}, "eyebrow": "Made here"}	7	t	2026-08-31 13:27:48.822768+00	2026-08-31 13:27:48.822768+00
\.


--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pages (id, slug, title, body, meta_title, meta_description, is_published, is_system, created_at, updated_at) FROM stdin;
1	privacy-policy	Privacy Policy	<p>Privacy Policy content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	terms-of-use	Terms of Use	<p>Terms of Use content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	shipping-delivery	Shipping & Delivery	<p>Shipping & Delivery content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	returns-refunds	Returns & Refunds	<p>Returns & Refunds content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	warranty	Warranty	<p>Warranty content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	care-guide	Care Guide	<p>Care Guide content has not been written yet. Staff can edit this page in the dashboard under Content.</p>	\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
7	about-us	About Nivisa		\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
8	contact	Contact		\N	\N	t	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
\.


--
-- Data for Name: product_ar_assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_ar_assets (id, product_id, status, model_url, ios_model_url, poster_url, real_width_mm, real_height_mm, real_depth_mm, scale_mode, placement, version, validation_note, uploaded_by, published_at, created_at, updated_at) FROM stdin;
2	10	unavailable	\N	\N	/media/ar/2026/09/156a6164f0f4-WhatsApp-Image-2026-08-31-at-11.51.15-AM.jpeg	\N	\N	\N	fixed	floor	1	\N	1	\N	2026-09-01 06:16:46.313612+00	2026-09-01 06:17:14.88406+00
4	9	ready	https://project-nivisa.b-cdn.net/ar/2026/09/b39e6f22b6b2-m.glb	https://project-nivisa.b-cdn.net/ar/2026/09/940f14bd64a2-m.usdz	\N	900	1900	320	fixed	floor	3	Note: No poster image. The AR button will have no preview.	1	2026-09-03 13:12:50.148832+00	2026-09-03 11:47:39.14302+00	2026-09-03 13:12:50.131209+00
1	1	ready	https://project-nivisa.b-cdn.net/ar/2026/09/695728bec10c-m.glb	https://project-nivisa.b-cdn.net/ar/2026/09/a40f5153b4fc-m.usdz	\N	2140	780	900	fixed	floor	7	Note: No poster image. The AR button will have no preview.	1	2026-09-03 11:47:36.242267+00	2026-08-31 12:57:02.802004+00	2026-09-03 11:47:36.213876+00
3	5	ready	https://project-nivisa.b-cdn.net/ar/2026/09/7971df2ea78f-m.glb	https://project-nivisa.b-cdn.net/ar/2026/09/ca36f46fd667-m.usdz	\N	1650	950	2100	fixed	floor	3	Note: No poster image. The AR button will have no preview.	1	2026-09-03 11:47:38.517076+00	2026-09-03 11:47:36.857718+00	2026-09-03 11:47:38.501799+00
\.


--
-- Data for Name: product_attributes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_attributes (product_id, attribute_id) FROM stdin;
1	1
1	21
1	12
1	18
2	4
2	7
2	19
3	2
3	8
3	17
4	3
4	11
5	1
5	24
5	12
6	2
6	9
6	20
7	5
7	16
8	6
8	15
8	17
9	3
9	10
10	3
10	13
11	1
11	24
11	12
12	2
12	22
12	14
13	21
13	16
14	23
14	13
15	4
15	7
16	2
16	8
17	1
17	18
18	5
18	15
19	3
19	7
20	1
20	7
21	3
21	13
22	3
22	11
23	6
23	17
24	5
24	14
25	1
25	7
26	3
26	20
27	2
27	8
28	5
28	15
29	3
29	16
30	3
30	12
31	1
31	8
32	3
32	10
33	2
33	11
34	3
34	12
35	1
35	18
36	3
36	20
37	3
37	13
38	2
38	8
39	1
39	19
40	3
40	10
41	3
41	12
42	2
42	24
43	4
43	19
44	22
44	12
45	5
45	14
46	1
46	7
47	5
47	16
48	5
48	17
49	4
49	19
50	5
50	13
51	5
51	17
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_images (id, product_id, url, alt_text, kind, "position", variant_id, created_at, updated_at) FROM stdin;
191	11	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kosi Two-Seater Sofa: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
192	11	https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kosi Two-Seater Sofa: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
193	11	https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Kosi Two-Seater Sofa: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
194	11	https://project-nivisa.b-cdn.net/generated/2026/10/95d3c50f9f4d-kosi-two-seater-sofa-dimension.svg	Measured drawing of Kosi Two-Seater Sofa showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
195	12	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ganga Sectional Sofa: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
196	12	https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ganga Sectional Sofa: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
197	12	https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Ganga Sectional Sofa: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
198	12	https://project-nivisa.b-cdn.net/generated/2026/10/035d026c7ce6-ganga-sectional-sofa-dimension.svg	Measured drawing of Ganga Sectional Sofa showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
199	13	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Veda Accent Armchair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
200	13	https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Veda Accent Armchair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
201	13	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Veda Accent Armchair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
202	13	https://project-nivisa.b-cdn.net/generated/2026/10/76205166d74c-veda-accent-armchair-dimension.svg	Measured drawing of Veda Accent Armchair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
203	14	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Leela Recliner Armchair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
204	14	https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Leela Recliner Armchair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
205	14	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Leela Recliner Armchair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
206	14	https://project-nivisa.b-cdn.net/generated/2026/10/6aaa9deb410a-leela-recliner-armchair-dimension.svg	Measured drawing of Leela Recliner Armchair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
207	15	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Patio Rattan Lounge Chair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
208	15	https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Patio Rattan Lounge Chair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
209	15	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Patio Rattan Lounge Chair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
210	15	https://project-nivisa.b-cdn.net/generated/2026/10/a016ec29020b-patio-rattan-lounge-chair-dimension.svg	Measured drawing of Patio Rattan Lounge Chair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
211	16	https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sutra Dining Chair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
212	16	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sutra Dining Chair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
213	16	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Sutra Dining Chair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
214	16	https://project-nivisa.b-cdn.net/generated/2026/10/0929d4876516-sutra-dining-chair-dimension.svg	Measured drawing of Sutra Dining Chair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
215	17	https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Asha Cane Dining Chair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
216	17	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Asha Cane Dining Chair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
217	17	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Asha Cane Dining Chair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
218	17	https://project-nivisa.b-cdn.net/generated/2026/10/02ba8a24ad76-asha-cane-dining-chair-dimension.svg	Measured drawing of Asha Cane Dining Chair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
219	18	https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Monsoon Garden Chair: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
220	18	https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Monsoon Garden Chair: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
221	18	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Monsoon Garden Chair: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
222	18	https://project-nivisa.b-cdn.net/generated/2026/10/d1e535be7e4b-monsoon-garden-chair-dimension.svg	Measured drawing of Monsoon Garden Chair showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
223	19	https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ritu Entryway Bench: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
224	19	https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ritu Entryway Bench: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
225	19	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Ritu Entryway Bench: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
226	19	https://project-nivisa.b-cdn.net/generated/2026/10/74548578bc67-ritu-entryway-bench-dimension.svg	Measured drawing of Ritu Entryway Bench showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
227	20	https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Terrace Teak Bench: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
228	20	https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Terrace Teak Bench: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
157	2	https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Kavi Lounge Chair: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
158	2	/media/generated/2026/09/e22e1328d084-kavi-lounge-chair-dimension.svg	Measured drawing of Kavi Lounge Chair showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
159	3	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sindhu Dining Table: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
160	3	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sindhu Dining Table: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
161	3	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Sindhu Dining Table: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
162	3	/media/generated/2026/09/fc5b56c8cf1b-sindhu-dining-table-dimension.svg	Measured drawing of Sindhu Dining Table showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
163	4	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Meru Sideboard: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
164	4	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Meru Sideboard: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
165	4	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Meru Sideboard: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
166	4	/media/generated/2026/09/f6154587c899-meru-sideboard-dimension.svg	Measured drawing of Meru Sideboard showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
167	5	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ilaa Bed Frame: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
168	5	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ilaa Bed Frame: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
169	5	https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Ilaa Bed Frame: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
229	20	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Terrace Teak Bench: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
230	20	https://project-nivisa.b-cdn.net/generated/2026/10/fab5b928d680-terrace-teak-bench-dimension.svg	Measured drawing of Terrace Teak Bench showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
231	21	https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Pebble Kids Stool: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
232	21	https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Pebble Kids Stool: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
233	21	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Pebble Kids Stool: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
234	21	https://project-nivisa.b-cdn.net/generated/2026/10/8be3f50772c2-pebble-kids-stool-dimension.svg	Measured drawing of Pebble Kids Stool showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
235	22	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kaveri Four-Seater Dining Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
236	22	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kaveri Four-Seater Dining Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
237	22	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Kaveri Four-Seater Dining Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
238	22	https://project-nivisa.b-cdn.net/generated/2026/10/a015cc80a1d0-kaveri-four-seater-dining-table-dimension.svg	Measured drawing of Kaveri Four-Seater Dining Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
239	23	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Raja Marble Dining Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
240	23	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Raja Marble Dining Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
241	23	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Raja Marble Dining Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
242	23	https://project-nivisa.b-cdn.net/generated/2026/10/5ebb2b0b1b3d-raja-marble-dining-table-dimension.svg	Measured drawing of Raja Marble Dining Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
243	24	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Balcony Bistro Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
244	24	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Balcony Bistro Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
245	24	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Balcony Bistro Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
246	24	https://project-nivisa.b-cdn.net/generated/2026/10/1d39f05d38e2-balcony-bistro-table-dimension.svg	Measured drawing of Balcony Bistro Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
247	25	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Oval Teak Coffee Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
248	25	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Oval Teak Coffee Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
249	25	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Oval Teak Coffee Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
250	25	https://project-nivisa.b-cdn.net/generated/2026/10/cae657e4e0ad-oval-teak-coffee-table-dimension.svg	Measured drawing of Oval Teak Coffee Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
251	26	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ira Nesting Coffee Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
252	26	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ira Nesting Coffee Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
253	26	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Ira Nesting Coffee Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
254	26	https://project-nivisa.b-cdn.net/generated/2026/10/5567db3c3c9a-ira-nesting-coffee-table-dimension.svg	Measured drawing of Ira Nesting Coffee Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
255	27	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bindu Side Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
256	27	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bindu Side Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
257	27	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Bindu Side Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
258	27	https://project-nivisa.b-cdn.net/generated/2026/10/7014eb387712-bindu-side-table-dimension.svg	Measured drawing of Bindu Side Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
259	28	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Garden Side Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
260	28	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Garden Side Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
261	28	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Garden Side Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
262	28	https://project-nivisa.b-cdn.net/generated/2026/10/fc47fbf0944e-garden-side-table-dimension.svg	Measured drawing of Garden Side Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
263	29	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Doodle Kids Activity Table: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
264	29	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Doodle Kids Activity Table: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
265	29	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Doodle Kids Activity Table: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
151	1	https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Anara Three-Seater Sofa: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
152	1	https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Anara Three-Seater Sofa: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
153	1	https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Anara Three-Seater Sofa: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
154	1	/media/generated/2026/09/f47fddb332f2-anara-three-seater-sofa-dimension.svg	Measured drawing of Anara Three-Seater Sofa showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
155	2	https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kavi Lounge Chair: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
156	2	https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kavi Lounge Chair: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
170	5	/media/generated/2026/09/e2006955cb40-ilaa-bed-frame-dimension.svg	Measured drawing of Ilaa Bed Frame showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
171	6	https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tara Writing Desk: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
172	6	https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tara Writing Desk: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
173	6	https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Tara Writing Desk: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
174	6	/media/generated/2026/09/2da3b44f6835-tara-writing-desk-dimension.svg	Measured drawing of Tara Writing Desk showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
175	7	https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ravi Floor Lamp: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
176	7	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Ravi Floor Lamp: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
177	7	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Ravi Floor Lamp: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
178	7	/media/generated/2026/09/7ea86fc81001-ravi-floor-lamp-dimension.svg	Measured drawing of Ravi Floor Lamp showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
179	8	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Nila Coffee Table: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
180	8	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Nila Coffee Table: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
181	8	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Nila Coffee Table: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
182	8	/media/generated/2026/09/ce1eca718674-nila-coffee-table-dimension.svg	Measured drawing of Nila Coffee Table showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
183	9	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bela Bookcase: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
184	9	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bela Bookcase: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
185	9	https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Bela Bookcase: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
186	9	/media/generated/2026/09/811de8d860ad-bela-bookcase-dimension.svg	Measured drawing of Bela Bookcase showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
187	10	https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Choti Kids Bench: a similar piece against a plain background	studio	0	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
188	10	https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Choti Kids Bench: a similar piece in a furnished room	lifestyle	1	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
189	10	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Choti Kids Bench: a close view of a similar material	detail	2	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
190	10	/media/generated/2026/09/daa6ec445326-choti-kids-bench-dimension.svg	Measured drawing of Choti Kids Bench showing its width and height	dimension	3	\N	2026-09-01 07:28:16.965203+00	2026-09-01 07:28:16.965203+00
266	29	https://project-nivisa.b-cdn.net/generated/2026/10/d5cb001a1f2b-doodle-kids-activity-table-dimension.svg	Measured drawing of Doodle Kids Activity Table showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
267	30	https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Chhota Kids Study Desk: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
268	30	https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Chhota Kids Study Desk: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
269	30	https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Chhota Kids Study Desk: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
270	30	https://project-nivisa.b-cdn.net/generated/2026/10/9ef3a8d77f32-chhota-kids-study-desk-dimension.svg	Measured drawing of Chhota Kids Study Desk showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
271	31	https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Arjun Executive Desk: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
272	31	https://images.unsplash.com/photo-1593062096033-9a26b09da705?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Arjun Executive Desk: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
273	31	https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Arjun Executive Desk: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
274	31	https://project-nivisa.b-cdn.net/generated/2026/10/f553ee6df084-arjun-executive-desk-dimension.svg	Measured drawing of Arjun Executive Desk showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
275	32	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sita Two-Door Wardrobe: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
276	32	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sita Two-Door Wardrobe: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
277	32	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Sita Two-Door Wardrobe: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
278	32	https://project-nivisa.b-cdn.net/generated/2026/10/27bd958e2868-sita-two-door-wardrobe-dimension.svg	Measured drawing of Sita Two-Door Wardrobe showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
279	33	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Maharani Four-Door Wardrobe: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
280	33	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Maharani Four-Door Wardrobe: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
281	33	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Maharani Four-Door Wardrobe: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
282	33	https://project-nivisa.b-cdn.net/generated/2026/10/9fac6c3f873d-maharani-four-door-wardrobe-dimension.svg	Measured drawing of Maharani Four-Door Wardrobe showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
283	34	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tiny Tots Wardrobe: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
284	34	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tiny Tots Wardrobe: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
285	34	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Tiny Tots Wardrobe: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
286	34	https://project-nivisa.b-cdn.net/generated/2026/10/e3b6f17efd5b-tiny-tots-wardrobe-dimension.svg	Measured drawing of Tiny Tots Wardrobe showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
287	35	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Lata Compact Sideboard: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
288	35	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Lata Compact Sideboard: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
289	35	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Lata Compact Sideboard: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
290	35	https://project-nivisa.b-cdn.net/generated/2026/10/d3937d9cf622-lata-compact-sideboard-dimension.svg	Measured drawing of Lata Compact Sideboard showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
291	36	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Nook Wall Shelf: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
292	36	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Nook Wall Shelf: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
293	36	https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Nook Wall Shelf: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
294	36	https://project-nivisa.b-cdn.net/generated/2026/10/33180bc13afd-nook-wall-shelf-dimension.svg	Measured drawing of Nook Wall Shelf showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
295	37	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kahani Kids Bookshelf: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
296	37	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Kahani Kids Bookshelf: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
297	37	https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Kahani Kids Bookshelf: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
298	37	https://project-nivisa.b-cdn.net/generated/2026/10/890927bc19fe-kahani-kids-bookshelf-dimension.svg	Measured drawing of Kahani Kids Bookshelf showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
299	38	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Gita Chest of Drawers: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
300	38	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Gita Chest of Drawers: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
301	38	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Gita Chest of Drawers: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
302	38	https://project-nivisa.b-cdn.net/generated/2026/10/04aa6ecce429-gita-chest-of-drawers-dimension.svg	Measured drawing of Gita Chest of Drawers showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
303	39	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Heirloom Storage Chest: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
304	39	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Heirloom Storage Chest: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
305	39	https://images.unsplash.com/photo-1558997519-83ea9252edf8?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Heirloom Storage Chest: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
306	39	https://project-nivisa.b-cdn.net/generated/2026/10/232ee7327afb-heirloom-storage-chest-dimension.svg	Measured drawing of Heirloom Storage Chest showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
307	40	https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Jodi Shoe Cabinet: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
308	40	https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Jodi Shoe Cabinet: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
309	40	https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Jodi Shoe Cabinet: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
310	40	https://project-nivisa.b-cdn.net/generated/2026/10/21b8f9f98beb-jodi-shoe-cabinet-dimension.svg	Measured drawing of Jodi Shoe Cabinet showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
311	41	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sapna Kids Single Bed: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
312	41	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Sapna Kids Single Bed: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
313	41	https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Sapna Kids Single Bed: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
314	41	https://project-nivisa.b-cdn.net/generated/2026/10/c805c5398a37-sapna-kids-single-bed-dimension.svg	Measured drawing of Sapna Kids Single Bed showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
315	42	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Shanti Storage Bed: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
316	42	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Shanti Storage Bed: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
317	42	https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Shanti Storage Bed: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
318	42	https://project-nivisa.b-cdn.net/generated/2026/10/ca7c7c95f355-shanti-storage-bed-dimension.svg	Measured drawing of Shanti Storage Bed showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
319	43	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bunai Cane Headboard: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
320	43	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bunai Cane Headboard: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
321	43	https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Bunai Cane Headboard: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
322	43	https://project-nivisa.b-cdn.net/generated/2026/10/65429ffe0e4b-bunai-cane-headboard-dimension.svg	Measured drawing of Bunai Cane Headboard showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
323	44	https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Narm Padded Headboard: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
324	44	https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Narm Padded Headboard: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
325	44	https://images.unsplash.com/photo-1592789705501-f9ae4278a9c9?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Narm Padded Headboard: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
326	44	https://project-nivisa.b-cdn.net/generated/2026/10/8ae11cfdd12b-narm-padded-headboard-dimension.svg	Measured drawing of Narm Padded Headboard showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
327	45	https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Chandra Arc Floor Lamp: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
328	45	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Chandra Arc Floor Lamp: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
329	45	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Chandra Arc Floor Lamp: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
330	45	https://project-nivisa.b-cdn.net/generated/2026/10/1f7a728fab98-chandra-arc-floor-lamp-dimension.svg	Measured drawing of Chandra Arc Floor Lamp showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
331	46	https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Garden Lantern Floor Lamp: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
332	46	https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Garden Lantern Floor Lamp: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
333	46	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Garden Lantern Floor Lamp: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
334	46	https://project-nivisa.b-cdn.net/generated/2026/10/6df9da7138ad-garden-lantern-floor-lamp-dimension.svg	Measured drawing of Garden Lantern Floor Lamp showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
335	47	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Diya Table Lamp: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
336	47	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Diya Table Lamp: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
337	47	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Diya Table Lamp: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
338	47	https://project-nivisa.b-cdn.net/generated/2026/10/6fb6ccaf5db0-diya-table-lamp-dimension.svg	Measured drawing of Diya Table Lamp showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
339	48	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Peetal Brass Table Lamp: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
340	48	https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Peetal Brass Table Lamp: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
341	48	https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Peetal Brass Table Lamp: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
342	48	https://project-nivisa.b-cdn.net/generated/2026/10/c7c47b80225a-peetal-brass-table-lamp-dimension.svg	Measured drawing of Peetal Brass Table Lamp showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
343	49	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bunai Rattan Pendant: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
344	49	https://images.unsplash.com/photo-1519643381401-22c77e60520e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Bunai Rattan Pendant: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
345	49	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Bunai Rattan Pendant: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
346	49	https://project-nivisa.b-cdn.net/generated/2026/10/6177a927307f-bunai-rattan-pendant-dimension.svg	Measured drawing of Bunai Rattan Pendant showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
347	50	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tamra Copper Dome Pendant: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
348	50	https://images.unsplash.com/photo-1519643381401-22c77e60520e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Tamra Copper Dome Pendant: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
349	50	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Tamra Copper Dome Pendant: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
350	50	https://project-nivisa.b-cdn.net/generated/2026/10/b3fd36e83174-tamra-copper-dome-pendant-dimension.svg	Measured drawing of Tamra Copper Dome Pendant showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
351	51	https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Mahal Crystal Chandelier: a similar piece against a plain background	studio	0	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
352	51	https://images.unsplash.com/photo-1519643381401-22c77e60520e?auto=format&fit=crop&w=1600&h=1200&q=80	Stand-in photograph for Mahal Crystal Chandelier: a similar piece in a furnished room	lifestyle	1	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
353	51	https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&h=1200&q=80	Stand-in photograph for Mahal Crystal Chandelier: a close view of a similar material	detail	2	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
354	51	https://project-nivisa.b-cdn.net/generated/2026/10/eacd098f823f-mahal-crystal-chandelier-dimension.svg	Measured drawing of Mahal Crystal Chandelier showing its width and height	dimension	3	\N	2026-10-13 07:07:46.651689+00	2026-10-13 07:07:46.651689+00
\.


--
-- Data for Name: product_rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_rooms (product_id, room_id) FROM stdin;
1	1
2	1
2	4
3	3
4	1
4	3
5	2
6	4
7	1
7	2
8	1
9	4
9	1
10	5
11	1
12	1
13	1
13	2
14	1
15	6
16	3
17	3
18	6
19	1
20	6
21	5
22	3
23	3
24	6
25	1
26	1
27	1
27	2
28	6
29	5
30	5
30	4
31	4
32	2
33	2
34	5
35	3
35	1
36	4
36	1
37	5
38	2
39	2
39	1
40	1
41	5
42	2
43	2
44	2
45	1
46	6
47	2
47	4
48	1
48	4
49	3
49	1
50	3
51	3
51	1
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_variants (id, product_id, sku, option_label, price, compare_at_price, cost_price, tax_rate, stock_quantity, low_stock_threshold, backorder_allowed, width_mm, depth_mm, height_mm, weight_g, boxed_width_mm, boxed_depth_mm, boxed_height_mm, lead_time_days, "position", is_active, created_at, updated_at) FROM stdin;
2	1	ANR-SOF-3-INK	Ink boucle	132000.00	\N	72600.00	18.00	2	3	f	2140	900	780	\N	\N	\N	\N	28	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	3	SDH-DIN-180	1800mm, seats 6	89000.00	\N	48950.00	18.00	3	3	f	1800	900	760	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	3	SDH-DIN-220	2200mm, seats 8	104000.00	\N	57200.00	18.00	1	3	f	2200	1000	760	\N	\N	\N	\N	28	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	4	MRU-SBD-160	\N	62000.00	71000.00	34100.00	18.00	6	3	f	1600	420	760	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
7	5	ILA-BED-QN	Queen	78000.00	\N	42900.00	18.00	5	3	f	1650	2100	950	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
8	5	ILA-BED-KG	King	92000.00	\N	50600.00	18.00	2	3	f	1950	2100	950	\N	\N	\N	\N	28	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
9	6	TRA-DSK-140	\N	44500.00	52000.00	24475.00	18.00	9	3	f	1400	650	750	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
10	7	RVI-FLR-01	\N	16500.00	\N	9075.00	18.00	18	3	f	400	400	1600	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
11	8	NLA-CFT-110	\N	51000.00	58000.00	28050.00	18.00	0	3	f	1100	600	380	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
12	9	BLA-BKC-190	\N	34000.00	\N	18700.00	18.00	7	3	f	900	320	1900	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	2	KVI-LNG-01	\N	38500.00	44000.00	21175.00	18.00	10	3	f	720	810	900	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:47:02.772673+00
13	10	CHT-BNC-90	\N	12500.00	15000.00	6875.00	18.00	12	3	f	900	300	340	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-10-13 06:30:58.242593+00
1	1	ANR-SOF-3-SND	Sand cotton weave	124000.00	148000.00	68200.00	18.00	3	3	f	2140	900	780	\N	\N	\N	\N	28	0	t	2026-08-31 11:35:23.084683+00	2026-10-13 06:43:10.767911+00
14	11	DMO-KTS-001	\N	68000.00	76000.00	37400.00	18.00	6	3	f	1680	860	790	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
15	12	DMO-GSS-002	\N	185000.00	210000.00	101750.00	18.00	2	3	f	2900	1700	800	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
16	13	DMO-VAA-003	\N	24500.00	\N	13475.00	18.00	10	3	f	760	780	820	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
17	14	DMO-LRA-004	\N	108000.00	120000.00	59400.00	18.00	3	3	f	900	950	1020	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
18	15	DMO-PRLC-005	\N	21000.00	24000.00	11550.00	18.00	12	3	f	780	820	860	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
19	16	DMO-SDC-006	\N	8900.00	\N	4895.00	18.00	24	3	f	450	520	820	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
20	17	DMO-ACDC-007	\N	14500.00	16500.00	7975.00	18.00	16	3	f	470	530	830	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
21	18	DMO-MGC-008	\N	6500.00	\N	3575.00	18.00	30	3	f	520	560	800	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
22	19	DMO-REB-009	\N	18500.00	\N	10175.00	18.00	9	3	f	1100	380	460	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
23	20	DMO-TTB-010	\N	32000.00	36000.00	17600.00	18.00	5	3	f	1500	450	450	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
24	21	DMO-PKS-011	\N	4900.00	\N	2695.00	18.00	40	3	f	320	320	300	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
25	22	DMO-KFDT-012	\N	46000.00	52000.00	25300.00	18.00	7	3	f	1300	800	760	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
26	23	DMO-RMDT-013	\N	165000.00	\N	90750.00	18.00	2	3	f	2400	1000	760	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
27	24	DMO-BBT-014	\N	9500.00	\N	5225.00	18.00	15	3	f	600	600	740	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
28	25	DMO-OTCT-015	\N	27500.00	31000.00	15125.00	18.00	8	3	f	1100	600	400	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
29	26	DMO-INCT-016	\N	8200.00	\N	4510.00	18.00	20	3	f	700	500	420	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
30	27	DMO-BST-017	\N	6900.00	\N	3795.00	18.00	25	3	f	450	450	550	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
31	28	DMO-GST-018	\N	7800.00	\N	4290.00	18.00	18	3	f	420	420	500	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
32	29	DMO-DKAT-019	\N	9200.00	\N	5060.00	18.00	12	3	f	800	600	500	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
33	30	DMO-CKSD-020	\N	16000.00	18500.00	8800.00	18.00	10	3	f	900	550	600	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
34	31	DMO-AED-021	\N	112000.00	\N	61600.00	18.00	3	3	f	1800	850	760	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
35	32	DMO-STW-022	\N	58000.00	64000.00	31900.00	18.00	6	3	f	1000	580	2000	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
36	33	DMO-MFW-023	\N	145000.00	\N	79750.00	18.00	2	3	f	2000	600	2150	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
37	34	DMO-TTW-024	\N	22000.00	\N	12100.00	18.00	8	3	f	800	500	1400	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
38	35	DMO-LCS-025	\N	38000.00	42000.00	20900.00	18.00	7	3	f	1200	400	760	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
39	36	DMO-NWS-026	\N	4500.00	\N	2475.00	18.00	35	3	f	800	220	300	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
40	37	DMO-KKB-027	\N	9800.00	\N	5390.00	18.00	14	3	f	700	300	900	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
41	38	DMO-GCOD-028	\N	29000.00	\N	15950.00	18.00	9	3	f	900	450	950	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
42	39	DMO-HSC-029	\N	72000.00	80000.00	39600.00	18.00	3	3	f	1200	550	600	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
43	40	DMO-JSC-030	\N	11500.00	\N	6325.00	18.00	16	3	f	800	320	1000	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
44	41	DMO-SKSB-031	\N	26000.00	29000.00	14300.00	18.00	6	3	f	1000	2000	800	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
45	42	DMO-SSB-032	\N	138000.00	152000.00	75900.00	18.00	3	3	f	1950	2150	1050	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
46	43	DMO-BCH-033	\N	9500.00	\N	5225.00	18.00	12	3	f	1600	60	1100	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
47	44	DMO-NPH-034	\N	18000.00	21000.00	9900.00	18.00	9	3	f	1650	80	1200	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
48	45	DMO-CAFL-035	\N	28500.00	\N	15675.00	18.00	8	3	f	400	1500	1900	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
49	46	DMO-GLFL-036	\N	8800.00	\N	4840.00	18.00	20	3	f	300	300	1100	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
50	47	DMO-DTL-037	\N	3900.00	\N	2145.00	18.00	40	3	f	200	200	380	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
51	48	DMO-PBTL-038	\N	12500.00	14000.00	6875.00	18.00	14	3	f	300	300	550	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
52	49	DMO-BRP-039	\N	7500.00	\N	4125.00	18.00	22	3	f	450	450	350	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
53	50	DMO-TCDP-040	\N	54000.00	\N	29700.00	18.00	5	3	f	600	600	450	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
54	51	DMO-MCC-041	\N	115000.00	130000.00	63250.00	18.00	2	3	f	900	900	1000	\N	\N	\N	\N	21	0	t	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, slug, tagline, description, category_id, brand_id, status, assembly_required, assembly_note, warranty_months, care_instructions, seating_capacity, specifications, meta_title, meta_description, created_at, updated_at) FROM stdin;
1	Anara Three-Seater Sofa	anara-three-seater-sofa	A deep, low sofa in a cotton weave that softens with use.	A deep, low sofa in a cotton weave that softens with use.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	2	1	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	3	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Anara Three-Seater Sofa | Nivisa	A deep, low sofa in a cotton weave that softens with use.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	Kavi Lounge Chair	kavi-lounge-chair	Rattan back, oiled teak frame, built for long afternoons.	Rattan back, oiled teak frame, built for long afternoons.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	3	2	active	f	\N	36	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Kavi Lounge Chair | Nivisa	Rattan back, oiled teak frame, built for long afternoons.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	Sindhu Dining Table	sindhu-dining-table	A six-seat plank top with a shadow gap at every join.	A six-seat plank top with a shadow gap at every join.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	7	3	active	t	Two-person assembly, roughly 30 minutes.	120	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	6	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Sindhu Dining Table | Nivisa	A six-seat plank top with a shadow gap at every join.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	Meru Sideboard	meru-sideboard	Four doors, cane fronts, and a cable pass at the back.	Four doors, cane fronts, and a cable pass at the back.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	13	1	active	f	\N	60	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Meru Sideboard | Nivisa	Four doors, cane fronts, and a cable pass at the back.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	Ilaa Bed Frame	ilaa-bed-frame	A low platform with an upholstered headboard you can lean on.	A low platform with an upholstered headboard you can lean on.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	17	2	active	t	Two-person assembly, roughly 30 minutes.	84	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Ilaa Bed Frame | Nivisa	A low platform with an upholstered headboard you can lean on.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	Tara Writing Desk	tara-writing-desk	Two drawers, a cable channel, and room for a second monitor.	Two drawers, a cable channel, and room for a second monitor.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	10	1	active	t	Two-person assembly, roughly 30 minutes.	36	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Tara Writing Desk | Nivisa	Two drawers, a cable channel, and room for a second monitor.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
7	Ravi Floor Lamp	ravi-floor-lamp	A brass stem with a linen shade that throws a wide, warm pool.	A brass stem with a linen shade that throws a wide, warm pool.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	20	3	active	f	\N	24	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Ravi Floor Lamp | Nivisa	A brass stem with a linen shade that throws a wide, warm pool.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
8	Nila Coffee Table	nila-coffee-table	A marble top on a slim steel base. Heavier than it looks.	A marble top on a slim steel base. Heavier than it looks.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	8	1	active	f	\N	60	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Nila Coffee Table | Nivisa	A marble top on a slim steel base. Heavier than it looks.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
9	Bela Bookcase	bela-bookcase	Five open shelves, wall-fixing bracket included.	Five open shelves, wall-fixing bracket included.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	14	2	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Bela Bookcase | Nivisa	Five open shelves, wall-fixing bracket included.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
10	Choti Kids Bench	choti-kids-bench	Rounded everywhere it needs to be, at a height a five-year-old owns.	Rounded everywhere it needs to be, at a height a five-year-old owns.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	5	1	active	t	Two-person assembly, roughly 30 minutes.	24	Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.	2	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "3 to 5 weeks"}]	Choti Kids Bench | Nivisa	Rounded everywhere it needs to be, at a height a five-year-old owns.	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
11	Kosi Two-Seater Sofa	kosi-two-seater-sofa	A compact sofa for flats where every centimetre is spoken for.	A compact sofa for flats where every centimetre is spoken for.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	2	1	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	2	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Kosi Two-Seater Sofa | Nivisa	A compact sofa for flats where every centimetre is spoken for.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
12	Ganga Sectional Sofa	ganga-sectional-sofa	An L-shaped sectional that seats the whole family for a match.	An L-shaped sectional that seats the whole family for a match.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	2	3	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	5	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Ganga Sectional Sofa | Nivisa	An L-shaped sectional that seats the whole family for a match.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
13	Veda Accent Armchair	veda-accent-armchair	A small-footprint armchair in a warm ochre weave.	A small-footprint armchair in a warm ochre weave.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	3	1	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Veda Accent Armchair | Nivisa	A small-footprint armchair in a warm ochre weave.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
14	Leela Recliner Armchair	leela-recliner-armchair	Full-grain leather that reclines in one smooth, silent movement.	Full-grain leather that reclines in one smooth, silent movement.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	3	3	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Leela Recliner Armchair | Nivisa	Full-grain leather that reclines in one smooth, silent movement.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
15	Patio Rattan Lounge Chair	patio-rattan-lounge-chair	Weather-treated rattan for a balcony or a covered terrace.	Weather-treated rattan for a balcony or a covered terrace.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	3	2	active	t	Two-person assembly, roughly 30 minutes.	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Patio Rattan Lounge Chair | Nivisa	Weather-treated rattan for a balcony or a covered terrace.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
16	Sutra Dining Chair	sutra-dining-chair	A sturdy everyday dining chair, sold singly.	A sturdy everyday dining chair, sold singly.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	4	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Sutra Dining Chair | Nivisa	A sturdy everyday dining chair, sold singly.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
17	Asha Cane Dining Chair	asha-cane-dining-chair	Hand-woven cane back on a solid teak frame.	Hand-woven cane back on a solid teak frame.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	4	2	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Asha Cane Dining Chair | Nivisa	Hand-woven cane back on a solid teak frame.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
18	Monsoon Garden Chair	monsoon-garden-chair	Powder-coated steel that shrugs off a monsoon.	Powder-coated steel that shrugs off a monsoon.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	4	3	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Monsoon Garden Chair | Nivisa	Powder-coated steel that shrugs off a monsoon.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
19	Ritu Entryway Bench	ritu-entryway-bench	A place to sit and take your shoes off by the door.	A place to sit and take your shoes off by the door.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	5	1	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	2	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Ritu Entryway Bench | Nivisa	A place to sit and take your shoes off by the door.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
20	Terrace Teak Bench	terrace-teak-bench	Oiled teak that greys gracefully in the sun.	Oiled teak that greys gracefully in the sun.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	5	2	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	3	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Terrace Teak Bench | Nivisa	Oiled teak that greys gracefully in the sun.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
21	Pebble Kids Stool	pebble-kids-stool	Rounded edges and a height made for small people.	Rounded edges and a height made for small people.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	5	1	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	1	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Pebble Kids Stool | Nivisa	Rounded edges and a height made for small people.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
22	Kaveri Four-Seater Dining Table	kaveri-four-seater-dining-table	A four-seat table sized for a city dining corner.	A four-seat table sized for a city dining corner.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	7	1	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	4	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Kaveri Four-Seater Dining Table | Nivisa	A four-seat table sized for a city dining corner.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
23	Raja Marble Dining Table	raja-marble-dining-table	Eight seats around a single slab of white marble.	Eight seats around a single slab of white marble.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	7	3	active	t	Two-person assembly, roughly 30 minutes.	120	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	8	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Raja Marble Dining Table | Nivisa	Eight seats around a single slab of white marble.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
24	Balcony Bistro Table	balcony-bistro-table	A round two-seater for morning chai on the balcony.	A round two-seater for morning chai on the balcony.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	7	3	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	2	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Balcony Bistro Table | Nivisa	A round two-seater for morning chai on the balcony.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
25	Oval Teak Coffee Table	oval-teak-coffee-table	Soft oval corners, so nobody's shin finds them.	Soft oval corners, so nobody's shin finds them.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	8	2	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Oval Teak Coffee Table | Nivisa	Soft oval corners, so nobody's shin finds them.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
26	Ira Nesting Coffee Table	ira-nesting-coffee-table	Two tables that tuck into one when guests leave.	Two tables that tuck into one when guests leave.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	8	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Ira Nesting Coffee Table | Nivisa	Two tables that tuck into one when guests leave.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
27	Bindu Side Table	bindu-side-table	A drum-shaped side table with a lipped top.	A drum-shaped side table with a lipped top.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	9	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Bindu Side Table | Nivisa	A drum-shaped side table with a lipped top.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
28	Garden Side Table	garden-side-table	Somewhere to put a glass down in the garden.	Somewhere to put a glass down in the garden.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	9	3	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Garden Side Table | Nivisa	Somewhere to put a glass down in the garden.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
29	Doodle Kids Activity Table	doodle-kids-activity-table	A low table for drawing, building and spilling.	A low table for drawing, building and spilling.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	9	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Doodle Kids Activity Table | Nivisa	A low table for drawing, building and spilling.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
30	Chhota Kids Study Desk	chhota-kids-study-desk	A desk with a slanted reading top that grows with them.	A desk with a slanted reading top that grows with them.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	10	1	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Chhota Kids Study Desk | Nivisa	A desk with a slanted reading top that grows with them.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
31	Arjun Executive Desk	arjun-executive-desk	A broad teak desk with a leather writing inlay.	A broad teak desk with a leather writing inlay.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	10	3	active	t	Two-person assembly, roughly 30 minutes.	84	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Arjun Executive Desk | Nivisa	A broad teak desk with a leather writing inlay.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
32	Sita Two-Door Wardrobe	sita-two-door-wardrobe	Hanging space, four shelves and a locker drawer.	Hanging space, four shelves and a locker drawer.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	12	1	active	f	\N	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Sita Two-Door Wardrobe | Nivisa	Hanging space, four shelves and a locker drawer.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
33	Maharani Four-Door Wardrobe	maharani-four-door-wardrobe	A full wall of storage with a mirrored centre door.	A full wall of storage with a mirrored centre door.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	12	3	active	t	Two-person assembly, roughly 30 minutes.	120	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Maharani Four-Door Wardrobe | Nivisa	A full wall of storage with a mirrored centre door.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
34	Tiny Tots Wardrobe	tiny-tots-wardrobe	A child-height wardrobe they can open themselves.	A child-height wardrobe they can open themselves.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	12	1	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Tiny Tots Wardrobe | Nivisa	A child-height wardrobe they can open themselves.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
35	Lata Compact Sideboard	lata-compact-sideboard	Two doors and two drawers for a smaller dining room.	Two doors and two drawers for a smaller dining room.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	13	2	active	f	\N	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Lata Compact Sideboard | Nivisa	Two doors and two drawers for a smaller dining room.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
36	Nook Wall Shelf	nook-wall-shelf	A single floating shelf for the books you are reading now.	A single floating shelf for the books you are reading now.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	14	1	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Nook Wall Shelf | Nivisa	A single floating shelf for the books you are reading now.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
37	Kahani Kids Bookshelf	kahani-kids-bookshelf	Front-facing shelves so picture books show their covers.	Front-facing shelves so picture books show their covers.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	14	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Kahani Kids Bookshelf | Nivisa	Front-facing shelves so picture books show their covers.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
38	Gita Chest of Drawers	gita-chest-of-drawers	Five soft-close drawers on full-extension runners.	Five soft-close drawers on full-extension runners.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	15	1	active	f	\N	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Gita Chest of Drawers | Nivisa	Five soft-close drawers on full-extension runners.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
39	Heirloom Storage Chest	heirloom-storage-chest	A brass-cornered trunk built to be handed down.	A brass-cornered trunk built to be handed down.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	15	3	active	t	Two-person assembly, roughly 30 minutes.	120	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Heirloom Storage Chest | Nivisa	A brass-cornered trunk built to be handed down.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
40	Jodi Shoe Cabinet	jodi-shoe-cabinet	Tilt-out bins that hold sixteen pairs by the door.	Tilt-out bins that hold sixteen pairs by the door.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	15	1	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Jodi Shoe Cabinet | Nivisa	Tilt-out bins that hold sixteen pairs by the door.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
41	Sapna Kids Single Bed	sapna-kids-single-bed	A single bed with a guard rail that comes off later.	A single bed with a guard rail that comes off later.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	17	1	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Sapna Kids Single Bed | Nivisa	A single bed with a guard rail that comes off later.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
42	Shanti Storage Bed	shanti-storage-bed	A king bed with hydraulic lift-up storage underneath.	A king bed with hydraulic lift-up storage underneath.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	17	3	active	t	Two-person assembly, roughly 30 minutes.	120	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Shanti Storage Bed | Nivisa	A king bed with hydraulic lift-up storage underneath.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
43	Bunai Cane Headboard	bunai-cane-headboard	A cane headboard that fixes to the wall behind any bed.	A cane headboard that fixes to the wall behind any bed.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	18	2	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Bunai Cane Headboard | Nivisa	A cane headboard that fixes to the wall behind any bed.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
44	Narm Padded Headboard	narm-padded-headboard	Channel-stitched boucle, soft enough to lean on and read.	Channel-stitched boucle, soft enough to lean on and read.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	18	1	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Narm Padded Headboard | Nivisa	Channel-stitched boucle, soft enough to lean on and read.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
45	Chandra Arc Floor Lamp	chandra-arc-floor-lamp	An arc that reaches over the sofa from the corner.	An arc that reaches over the sofa from the corner.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	20	3	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Chandra Arc Floor Lamp | Nivisa	An arc that reaches over the sofa from the corner.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
46	Garden Lantern Floor Lamp	garden-lantern-floor-lamp	A teak lantern for the terrace, weather-sealed.	A teak lantern for the terrace, weather-sealed.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	20	2	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Garden Lantern Floor Lamp | Nivisa	A teak lantern for the terrace, weather-sealed.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
47	Diya Table Lamp	diya-table-lamp	A small bedside lamp with a warm, dimmable glow.	A small bedside lamp with a warm, dimmable glow.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	21	1	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Diya Table Lamp | Nivisa	A small bedside lamp with a warm, dimmable glow.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
48	Peetal Brass Table Lamp	peetal-brass-table-lamp	Spun brass base, pleated linen shade.	Spun brass base, pleated linen shade.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	21	3	active	f	\N	24	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Peetal Brass Table Lamp | Nivisa	Spun brass base, pleated linen shade.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
49	Bunai Rattan Pendant	bunai-rattan-pendant	A hand-woven rattan shade that throws patterned light.	A hand-woven rattan shade that throws patterned light.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	22	2	active	f	\N	12	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Bunai Rattan Pendant | Nivisa	A hand-woven rattan shade that throws patterned light.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
50	Tamra Copper Dome Pendant	tamra-copper-dome-pendant	A hammered copper dome to hang over the dining table.	A hammered copper dome to hang over the dining table.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	22	3	active	f	\N	36	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Tamra Copper Dome Pendant | Nivisa	A hammered copper dome to hang over the dining table.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
51	Mahal Crystal Chandelier	mahal-crystal-chandelier	Three tiers of hand-cut crystal for a double-height room.	Three tiers of hand-cut crystal for a double-height room.\n\nMade to order in our Bengaluru workshop. Every piece is finished by hand, so the grain and tone vary a little from one to the next.	22	3	active	t	Two-person assembly, roughly 30 minutes.	60	Dust with a dry cloth. Keep out of direct sun and away from damp walls.	\N	[{"label": "Origin", "value": "Bengaluru, India"}, {"label": "Lead time", "value": "2 to 4 weeks"}]	Mahal Crystal Chandelier | Nivisa	Three tiers of hand-cut crystal for a double-height room.	2026-10-13 07:07:45.07232+00	2026-10-13 07:07:45.07232+00
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, slug, name, description, permissions, is_system, created_at, updated_at) FROM stdin;
1	super_admin	Super Admin	Unrestricted access, including staff and roles.	["*"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	order_manager	Order Manager	Fulfilment desk. Orders and customers, read-only catalogue.	["dashboard.view", "products.read", "taxonomy.read", "orders.read", "orders.fulfil", "orders.cancel", "customers.read", "reports.view"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	support_agent	Support Agent	Answers customers. Can read orders and reply to reviews, cannot change stock or pricing.	["dashboard.view", "products.read", "taxonomy.read", "orders.read", "customers.read", "customers.write", "reviews.moderate"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	viewer	Viewer	Read-only across the dashboard. Useful for finance and stakeholders.	["dashboard.view", "products.read", "taxonomy.read", "orders.read", "customers.read", "coupons.read", "content.read", "reports.view", "reports.export"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	store_manager	Store Manager	Runs the shop day to day. Everything except staff, roles and settings.	["dashboard.view", "products.read", "products.write", "products.publish", "inventory.write", "ar.manage", "taxonomy.read", "taxonomy.write", "orders.read", "orders.fulfil", "orders.cancel", "orders.refund", "customers.read", "customers.write", "coupons.read", "coupons.write", "reviews.moderate", "content.read", "content.write", "reports.view", "reports.export", "audit.read"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 12:56:49.296767+00
3	catalogue_manager	Catalogue Manager	Owns products, taxonomy and merchandising. No access to orders or customers.	["dashboard.view", "products.read", "products.write", "products.delete", "products.publish", "inventory.write", "ar.manage", "taxonomy.read", "taxonomy.write", "reviews.moderate", "content.read", "content.write", "reports.view"]	t	2026-08-31 11:35:23.084683+00	2026-08-31 12:56:49.296767+00
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rooms (id, name, slug, description, image_url, "position", is_active, created_at, updated_at) FROM stdin;
1	Living	living	\N	https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&h=900&q=80	0	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
2	Bedroom	bedroom	\N	https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=900&q=80	1	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
3	Dining	dining	\N	https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1200&h=900&q=80	2	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
4	Study	study	\N	https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1200&h=900&q=80	3	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
5	Kids	kids	\N	https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&h=900&q=80	4	t	2026-08-31 11:35:23.084683+00	2026-09-01 06:27:19.984099+00
6	Outdoor	outdoor	\N	https://images.unsplash.com/photo-1416331108676-a22ccb276e35?auto=format&fit=crop&w=1200&h=900&q=80	5	t	2026-08-31 11:35:23.084683+00	2026-09-01 07:28:16.965203+00
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (id, key, value, label, "group", created_at, updated_at) FROM stdin;
1	store_profile	{"name": "Nivisa", "email": "hello@nivisa.in", "gstin": "", "phone": "+91 80 0000 0000", "address": "Nivisa Studio, Indiranagar, Bengaluru 560038"}	Store details	store	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	checkout_rules	{"order_note_enabled": true, "minimum_order_value": 0, "allow_guest_checkout": false}	Checkout	checkout	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	tax_profile	{"default_rate": 18, "prices_include_tax": true}	Tax	tax	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	storefront_content	{"announcement": ""}	Storefront copy	store	2026-08-31 13:25:53.688299+00	2026-08-31 13:25:53.688299+00
\.


--
-- Data for Name: shipping_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shipping_rates (id, name, postcode_prefixes, rate, free_above, estimated_days_min, estimated_days_max, "position", is_active, created_at, updated_at) FROM stdin;
1	Bengaluru metro	560,561,562	499.00	25000.00	2	5	0	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
2	Karnataka	56,57,58,59	1499.00	50000.00	4	9	1	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
3	Rest of India		2499.00	75000.00	7	14	99	t	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
\.


--
-- Data for Name: staff_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_users (id, name, email, phone, password_hash, role_id, is_active, last_login_at, must_change_password, created_at, updated_at) FROM stdin;
2	Meera Rao	manager@nivisa.in	\N	$2b$12$PDzWImIPEXaAndMAku.Z4.Mn32b4JbPXhEUGZeeUSQuUcEx8bTadi	2	t	\N	f	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
5	Farid Khan	support@nivisa.in	\N	$2b$12$cGEY/eTzLPmMfafU6ks/0eQ9ZZsrRjVRgtmIyPLSz6EbLXKcwgFOS	5	t	\N	f	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
6	Anita Desai	viewer@nivisa.in	\N	$2b$12$3ciRT8KNYSBAjoixEnw9muR6UnyBUoPZmsErGx4Fvl2HHRwEUZTqe	6	t	\N	f	2026-08-31 11:35:23.084683+00	2026-08-31 11:35:23.084683+00
4	Divya Nair	orders@nivisa.in	\N	$2b$12$mzWyx4.egyK3Ifs3QcjqE.W9IO.CsNfJY3TaE2pbfV2jvCNEIBJAK	4	t	2026-08-31 13:07:17.919562+00	f	2026-08-31 11:35:23.084683+00	2026-08-31 13:07:17.703199+00
3	Arun Shetty	catalogue@nivisa.in	\N	$2b$12$kguH2L6yj7nMOmJXd.Fl2uhVnNV.3jbRw6udv58yR12OLvCWzpBbC	3	t	2026-08-31 13:07:18.326248+00	f	2026-08-31 11:35:23.084683+00	2026-08-31 13:07:18.111938+00
1	Super Admin	superadmin@nivisa.in	\N	$2b$12$Woo5gVDajw4SkGPCHSjiq.brNl4oJ3ZG9HW1yJch7Mm4u7k9FHaBG	1	t	2026-10-13 06:44:18.914721+00	f	2026-08-31 11:35:23.084683+00	2026-10-13 06:44:18.673685+00
\.


--
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.addresses_id_seq', 5, true);


--
-- Name: ar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ar_events_id_seq', 8, true);


--
-- Name: attributes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attributes_id_seq', 24, true);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 75, true);


--
-- Name: banners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.banners_id_seq', 1, true);


--
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brands_id_seq', 3, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 14, true);


--
-- Name: carts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carts_id_seq', 290, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 22, true);


--
-- Name: collections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.collections_id_seq', 4, true);


--
-- Name: coupon_redemptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupon_redemptions_id_seq', 1, false);


--
-- Name: coupons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.coupons_id_seq', 2, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 7, true);


--
-- Name: homepage_sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.homepage_sections_id_seq', 11, true);


--
-- Name: inventory_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_movements_id_seq', 4, true);


--
-- Name: order_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_events_id_seq', 10, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 4, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 4, true);


--
-- Name: otp_challenges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_challenges_id_seq', 12, true);


--
-- Name: pages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pages_id_seq', 8, true);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 4, true);


--
-- Name: product_ar_assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_ar_assets_id_seq', 4, true);


--
-- Name: product_images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_images_id_seq', 354, true);


--
-- Name: product_variants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_variants_id_seq', 54, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 51, true);


--
-- Name: recently_viewed_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recently_viewed_id_seq', 1, false);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 1, false);


--
-- Name: roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roles_id_seq', 6, true);


--
-- Name: rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rooms_id_seq', 6, true);


--
-- Name: settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settings_id_seq', 4, true);


--
-- Name: shipping_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shipping_rates_id_seq', 3, true);


--
-- Name: staff_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.staff_users_id_seq', 6, true);


--
-- Name: wishlists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.wishlists_id_seq', 1, true);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: ar_events ar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_events
    ADD CONSTRAINT ar_events_pkey PRIMARY KEY (id);


--
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: collection_products collection_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_pkey PRIMARY KEY (collection_id, product_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: coupon_redemptions coupon_redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: homepage_sections homepage_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_sections
    ADD CONSTRAINT homepage_sections_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: order_events order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_challenges otp_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_challenges
    ADD CONSTRAINT otp_challenges_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_ar_assets product_ar_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ar_assets
    ADD CONSTRAINT product_ar_assets_pkey PRIMARY KEY (id);


--
-- Name: product_attributes product_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attributes
    ADD CONSTRAINT product_attributes_pkey PRIMARY KEY (product_id, attribute_id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_rooms product_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_rooms
    ADD CONSTRAINT product_rooms_pkey PRIMARY KEY (product_id, room_id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: recently_viewed recently_viewed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT recently_viewed_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: shipping_rates shipping_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rates
    ADD CONSTRAINT shipping_rates_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: product_ar_assets uq_ar_asset_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ar_assets
    ADD CONSTRAINT uq_ar_asset_product UNIQUE (product_id);


--
-- Name: attributes uq_attribute_kind_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attributes
    ADD CONSTRAINT uq_attribute_kind_slug UNIQUE (kind, slug);


--
-- Name: cart_items uq_cart_variant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT uq_cart_variant UNIQUE (cart_id, variant_id);


--
-- Name: recently_viewed uq_recent_customer_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT uq_recent_customer_product UNIQUE (customer_id, product_id);


--
-- Name: settings uq_setting_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT uq_setting_key UNIQUE (key);


--
-- Name: product_variants uq_variant_sku; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT uq_variant_sku UNIQUE (sku);


--
-- Name: wishlists uq_wishlist_customer_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT uq_wishlist_customer_product UNIQUE (customer_id, product_id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: ix_addresses_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_addresses_customer_id ON public.addresses USING btree (customer_id);


--
-- Name: ix_ar_events_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ar_events_kind ON public.ar_events USING btree (kind);


--
-- Name: ix_ar_events_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ar_events_product_id ON public.ar_events USING btree (product_id);


--
-- Name: ix_ar_events_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ar_events_session_token ON public.ar_events USING btree (session_token);


--
-- Name: ix_attributes_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_kind ON public.attributes USING btree (kind);


--
-- Name: ix_attributes_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attributes_slug ON public.attributes USING btree (slug);


--
-- Name: ix_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: ix_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: ix_audit_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_entity ON public.audit_logs USING btree (entity);


--
-- Name: ix_audit_logs_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);


--
-- Name: ix_banners_placement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_banners_placement ON public.banners USING btree (placement);


--
-- Name: ix_brands_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_brands_slug ON public.brands USING btree (slug);


--
-- Name: ix_cart_items_cart_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cart_items_cart_id ON public.cart_items USING btree (cart_id);


--
-- Name: ix_cart_items_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cart_items_variant_id ON public.cart_items USING btree (variant_id);


--
-- Name: ix_carts_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_carts_customer_id ON public.carts USING btree (customer_id);


--
-- Name: ix_carts_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_carts_session_token ON public.carts USING btree (session_token);


--
-- Name: ix_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_categories_parent_id ON public.categories USING btree (parent_id);


--
-- Name: ix_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_categories_slug ON public.categories USING btree (slug);


--
-- Name: ix_collections_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_collections_slug ON public.collections USING btree (slug);


--
-- Name: ix_coupon_redemptions_coupon_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_coupon_redemptions_coupon_id ON public.coupon_redemptions USING btree (coupon_id);


--
-- Name: ix_coupon_redemptions_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_coupon_redemptions_customer_id ON public.coupon_redemptions USING btree (customer_id);


--
-- Name: ix_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_coupons_code ON public.coupons USING btree (code);


--
-- Name: ix_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customers_email ON public.customers USING btree (email);


--
-- Name: ix_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_customers_phone ON public.customers USING btree (phone);


--
-- Name: ix_inventory_movements_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_movements_variant_id ON public.inventory_movements USING btree (variant_id);


--
-- Name: ix_order_events_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_events_order_id ON public.order_events USING btree (order_id);


--
-- Name: ix_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: ix_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: ix_orders_fulfilment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_fulfilment_status ON public.orders USING btree (fulfilment_status);


--
-- Name: ix_orders_order_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_orders_order_number ON public.orders USING btree (order_number);


--
-- Name: ix_orders_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_payment_status ON public.orders USING btree (payment_status);


--
-- Name: ix_orders_status_placed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_status_placed ON public.orders USING btree (fulfilment_status, created_at);


--
-- Name: ix_otp_challenges_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_otp_challenges_phone ON public.otp_challenges USING btree (phone);


--
-- Name: ix_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_pages_slug ON public.pages USING btree (slug);


--
-- Name: ix_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_order_id ON public.payments USING btree (order_id);


--
-- Name: ix_payments_provider_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payments_provider_reference ON public.payments USING btree (provider_reference);


--
-- Name: ix_product_ar_assets_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_ar_assets_product_id ON public.product_ar_assets USING btree (product_id);


--
-- Name: ix_product_ar_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_ar_assets_status ON public.product_ar_assets USING btree (status);


--
-- Name: ix_product_images_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_images_product_id ON public.product_images USING btree (product_id);


--
-- Name: ix_product_images_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_images_variant_id ON public.product_images USING btree (variant_id);


--
-- Name: ix_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: ix_product_variants_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_variants_sku ON public.product_variants USING btree (sku);


--
-- Name: ix_products_brand_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_brand_id ON public.products USING btree (brand_id);


--
-- Name: ix_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_category_id ON public.products USING btree (category_id);


--
-- Name: ix_products_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_name ON public.products USING btree (name);


--
-- Name: ix_products_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_products_slug ON public.products USING btree (slug);


--
-- Name: ix_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_status ON public.products USING btree (status);


--
-- Name: ix_products_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_status_created ON public.products USING btree (status, created_at);


--
-- Name: ix_recently_viewed_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recently_viewed_customer_id ON public.recently_viewed USING btree (customer_id);


--
-- Name: ix_recently_viewed_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_recently_viewed_product_id ON public.recently_viewed USING btree (product_id);


--
-- Name: ix_reviews_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reviews_customer_id ON public.reviews USING btree (customer_id);


--
-- Name: ix_reviews_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reviews_product_id ON public.reviews USING btree (product_id);


--
-- Name: ix_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reviews_status ON public.reviews USING btree (status);


--
-- Name: ix_roles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_roles_slug ON public.roles USING btree (slug);


--
-- Name: ix_rooms_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_rooms_slug ON public.rooms USING btree (slug);


--
-- Name: ix_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_settings_key ON public.settings USING btree (key);


--
-- Name: ix_staff_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_staff_users_email ON public.staff_users USING btree (email);


--
-- Name: ix_staff_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_staff_users_role_id ON public.staff_users USING btree (role_id);


--
-- Name: ix_wishlists_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wishlists_customer_id ON public.wishlists USING btree (customer_id);


--
-- Name: ix_wishlists_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_wishlists_product_id ON public.wishlists USING btree (product_id);


--
-- Name: addresses addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: ar_events ar_events_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_events
    ADD CONSTRAINT ar_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: carts carts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: collection_products collection_products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_products collection_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: coupon_redemptions coupon_redemptions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: coupon_redemptions coupon_redemptions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_redemptions
    ADD CONSTRAINT coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: order_events order_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_events order_events_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_staff_user_id_fkey FOREIGN KEY (staff_user_id) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_ar_assets product_ar_assets_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ar_assets
    ADD CONSTRAINT product_ar_assets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_ar_assets product_ar_assets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ar_assets
    ADD CONSTRAINT product_ar_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.staff_users(id) ON DELETE SET NULL;


--
-- Name: product_attributes product_attributes_attribute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attributes
    ADD CONSTRAINT product_attributes_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES public.attributes(id) ON DELETE CASCADE;


--
-- Name: product_attributes product_attributes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_attributes
    ADD CONSTRAINT product_attributes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: product_rooms product_rooms_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_rooms
    ADD CONSTRAINT product_rooms_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_rooms product_rooms_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_rooms
    ADD CONSTRAINT product_rooms_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: recently_viewed recently_viewed_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT recently_viewed_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: recently_viewed recently_viewed_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recently_viewed
    ADD CONSTRAINT recently_viewed_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: staff_users staff_users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- Name: wishlists wishlists_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rdrNEPLwdtk0x8YK9kcEfL8FPGnjPR7mgIh19u0X60kRegpDsc4fffQUh5yI6MG

