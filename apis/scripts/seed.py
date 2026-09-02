"""Create the schema and fill it with a working shop.

Idempotent: safe to run against an existing database. Every step checks for
what it is about to create, so a second run adds nothing and overwrites
nothing - which matters because this runs automatically on `docker compose
up` and would otherwise reset a developer's data every restart.

    python -m scripts.seed              # schema + roles + super admin + demo data
    python -m scripts.seed --no-demo    # schema + roles + super admin only
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select

from app.core import permissions as perms
from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.core.slug import slugify
from app.models import (
    Address, Attribute, Banner, Base, Brand, Cart, Category, Collection,
    CollectionProduct, Coupon, Customer, HomepageSection, Order, Page, Product,
    ProductAttribute, ProductImage, ProductRoom, ProductVariant, Role, Room,
    Setting, ShippingRate, StaffUser,
)


async def create_schema() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    print("  schema ready")


async def seed_roles(session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for definition in perms.SYSTEM_ROLES:
        existing = (
            await session.execute(select(Role).where(Role.slug == definition["slug"]))
        ).scalars().first()
        if existing:
            # System roles are kept in step with the registry: a permission
            # added to the codebase should reach the built-in roles without
            # anyone re-seeding by hand. Custom roles are never touched.
            existing.permissions = perms.normalise(definition["permissions"]) \
                if perms.WILDCARD not in definition["permissions"] else [perms.WILDCARD]
            existing.description = definition["description"]
            roles[definition["slug"]] = existing
            continue

        role = Role(
            slug=definition["slug"],
            name=definition["name"],
            description=definition["description"],
            permissions=definition["permissions"],
            is_system=True,
        )
        session.add(role)
        roles[definition["slug"]] = role

    await session.flush()
    print(f"  {len(roles)} roles")
    return roles


async def seed_super_admin(session, roles: dict[str, Role]) -> StaffUser | None:
    """Create the bootstrap account, once.

    Guarded on "does any super admin exist", not on the configured email.
    Keying on the email means editing SUPER_ADMIN_EMAIL later silently mints
    a *second* unrestricted account on the next start, leaving an older one
    behind with a password from the compose file that nobody remembers is
    still live. Renaming the account is the Staff screen's job.
    """
    email = settings.SUPER_ADMIN_EMAIL.lower()
    existing = (
        await session.execute(
            select(StaffUser).where(StaffUser.role_id == roles["super_admin"].id)
        )
    ).scalars().first()
    if existing:
        if existing.email != email:
            print(
                f"  super admin already exists as {existing.email}; "
                f"SUPER_ADMIN_EMAIL ({email}) ignored. Rename it on the Staff screen."
            )
        else:
            print(f"  super admin already exists: {email}")
        return existing

    user = StaffUser(
        name=settings.SUPER_ADMIN_NAME,
        email=email,
        password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
        role_id=roles["super_admin"].id,
        is_active=True,
        # Not forced here: this is the account someone signs in with the
        # first time, and a forced change on a password they just read from
        # the compose file is friction with no security gain. Production
        # changes it via the Staff screen.
        must_change_password=False,
    )
    session.add(user)
    await session.flush()
    print(f"  super admin: {email}")
    return user


async def seed_demo_staff(session, roles: dict[str, Role]) -> None:
    """One account per built-in role, so the permission model can be seen
    working without anyone having to create five accounts by hand."""
    accounts = [
        ("Meera Rao", "manager@nivisa.in", "store_manager"),
        ("Arun Shetty", "catalogue@nivisa.in", "catalogue_manager"),
        ("Divya Nair", "orders@nivisa.in", "order_manager"),
        ("Farid Khan", "support@nivisa.in", "support_agent"),
        ("Anita Desai", "viewer@nivisa.in", "viewer"),
    ]
    created = 0
    for name, email, role_slug in accounts:
        exists = (await session.execute(select(StaffUser.id).where(StaffUser.email == email))).first()
        if exists:
            continue
        session.add(
            StaffUser(
                name=name, email=email,
                password_hash=hash_password("Nivisa@2026"),
                role_id=roles[role_slug].id, is_active=True, must_change_password=False,
            )
        )
        created += 1
    await session.flush()
    if created:
        print(f"  {created} demo staff accounts (password Nivisa@2026)")


async def seed_settings(session) -> None:
    defaults = [
        ("store", "store_profile", "Store details", {
            "name": settings.STORE_NAME,
            "email": settings.STORE_EMAIL,
            "phone": settings.STORE_PHONE,
            "address": "Nivisa Studio, Indiranagar, Bengaluru 560038",
            "gstin": "",
        }),
        ("checkout", "checkout_rules", "Checkout", {
            "minimum_order_value": 0,
            "allow_guest_checkout": False,
            "order_note_enabled": True,
        }),
        ("tax", "tax_profile", "Tax", {
            "prices_include_tax": True,
            "default_rate": 18,
        }),
        # Storefront copy that is not a page: the announcement strip, and the
        # editorial bands on the homepage. Blank announcement means no bar -
        # the storefront falls back to quoting the real free-delivery
        # threshold, which the API derives from the live shipping zones.
        ("store", "storefront_content", "Storefront copy", {
            "announcement": "",
        }),
    ]
    for group, key, label, value in defaults:
        exists = (await session.execute(select(Setting.id).where(Setting.key == key))).first()
        if not exists:
            session.add(Setting(key=key, value=value, label=label, group=group))
    await session.flush()


async def seed_pages(session) -> None:
    pages = [
        ("privacy-policy", "Privacy Policy"),
        ("terms-of-use", "Terms of Use"),
        ("shipping-delivery", "Shipping & Delivery"),
        ("returns-refunds", "Returns & Refunds"),
        ("warranty", "Warranty"),
        ("care-guide", "Care Guide"),
        ("about-us", "About Nivisa"),
        ("contact", "Contact"),
    ]
    created = 0
    for slug, title in pages:
        exists = (await session.execute(select(Page.id).where(Page.slug == slug))).first()
        if exists:
            continue
        session.add(
            Page(
                slug=slug, title=title,
                body=(
                    f"<p>{title} content has not been written yet. "
                    "Staff can edit this page in the dashboard under Content.</p>"
                ),
                is_published=True,
                # System pages are linked from the footer and checkout, so the
                # dashboard allows editing but not deleting them.
                is_system=True,
            )
        )
        created += 1
    await session.flush()
    if created:
        print(f"  {created} content pages")


async def seed_shipping(session) -> None:
    if (await session.execute(select(ShippingRate.id))).first():
        return
    session.add_all([
        ShippingRate(
            name="Bengaluru metro", postcode_prefixes="560,561,562",
            rate=Decimal("499.00"), free_above=Decimal("25000.00"),
            estimated_days_min=2, estimated_days_max=5, position=0,
        ),
        ShippingRate(
            name="Karnataka", postcode_prefixes="56,57,58,59",
            rate=Decimal("1499.00"), free_above=Decimal("50000.00"),
            estimated_days_min=4, estimated_days_max=9, position=1,
        ),
        # No prefixes: the fallback. There should be exactly one, or a
        # delivery outside every listed zone would ship free by accident.
        ShippingRate(
            name="Rest of India", postcode_prefixes="",
            rate=Decimal("2499.00"), free_above=Decimal("75000.00"),
            estimated_days_min=7, estimated_days_max=14, position=99,
        ),
    ])
    await session.flush()
    print("  3 shipping zones")


async def seed_catalogue(session) -> None:
    if (await session.execute(select(Product.id))).first():
        print("  catalogue already populated, skipping demo products")
        return

    # --- Taxonomy
    categories: dict[str, Category] = {}
    tree = {
        "Seating": ["Sofas", "Armchairs", "Dining Chairs", "Benches"],
        "Tables": ["Dining Tables", "Coffee Tables", "Side Tables", "Desks"],
        "Storage": ["Wardrobes", "Sideboards", "Bookcases", "Chests"],
        "Beds": ["Bed Frames", "Headboards"],
        "Lighting": ["Floor Lamps", "Table Lamps", "Pendants"],
    }
    for position, (parent_name, children) in enumerate(tree.items()):
        parent = Category(name=parent_name, slug=slugify(parent_name), position=position)
        session.add(parent)
        await session.flush()
        categories[parent_name] = parent
        for child_position, child_name in enumerate(children):
            child = Category(
                name=child_name, slug=slugify(child_name),
                parent_id=parent.id, position=child_position,
            )
            session.add(child)
            categories[child_name] = child
    await session.flush()

    rooms: dict[str, Room] = {}
    for position, name in enumerate(["Living", "Bedroom", "Dining", "Study", "Kids", "Outdoor"]):
        room = Room(name=name, slug=slugify(name), position=position)
        session.add(room)
        rooms[name] = room
    await session.flush()

    brands: dict[str, Brand] = {}
    for name in ["Nivisa Studio", "Teak & Twine", "Coromandel Works"]:
        brand = Brand(name=name, slug=slugify(name))
        session.add(brand)
        brands[name] = brand
    await session.flush()

    attributes: dict[tuple[str, str], Attribute] = {}
    attribute_seed = {
        "material": ["Solid Teak", "Solid Sheesham", "Mango Wood", "Rattan", "Powder-coated Steel", "Marble"],
        "finish": ["Natural Oil", "Walnut Stain", "Matte Black", "Whitewash", "Honey Lacquer"],
        "colour": [("Sand", "#D8CBB8"), ("Terracotta", "#B4552D"), ("Ink", "#1C1917"),
                   ("Verdigris", "#5C7A6B"), ("Ochre", "#C98A2B")],
        "style": ["Contemporary", "Mid-century", "Rustic", "Minimal"],
        "upholstery": ["Cotton Weave", "Boucle", "Full-grain Leather", "Linen"],
    }
    for kind, values in attribute_seed.items():
        for position, value in enumerate(values):
            name, hex_code = value if isinstance(value, tuple) else (value, None)
            attribute = Attribute(
                kind=kind, name=name, slug=slugify(name), hex_code=hex_code, position=position
            )
            session.add(attribute)
            attributes[(kind, name)] = attribute
    await session.flush()

    collections: dict[str, Collection] = {}
    collection_seed = [
        ("New This Season", True), ("Best Sellers", True), ("Small Spaces", True),
        ("The Teak Edit", False),
    ]
    for position, (name, featured) in enumerate(collection_seed):
        collection = Collection(
            name=name, slug=slugify(name), position=position, is_featured=featured
        )
        session.add(collection)
        collections[name] = collection
    await session.flush()

    # --- Products
    # Images are NOT set here. scripts/seed_media.py draws them and attaches
    # them, so this seeder owns the catalogue and that one owns the artwork -
    # and a shop that has since uploaded real photography is never overwritten
    # by re-running either.

    catalogue = [
        {
            "name": "Anara Three-Seater Sofa", "category": "Sofas", "brand": "Nivisa Studio",
            "tagline": "A deep, low sofa in a cotton weave that softens with use.",
            "rooms": ["Living"], "seats": 3, "warranty": 60, "assembly": True,
            "attributes": [("material", "Solid Teak"), ("upholstery", "Cotton Weave"),
                           ("colour", "Sand"), ("style", "Mid-century")],
            "variants": [
                ("ANR-SOF-3-SND", "Sand cotton weave", "124000.00", "148000.00", 4, 2140, 900, 780),
                ("ANR-SOF-3-INK", "Ink boucle", "132000.00", None, 2, 2140, 900, 780),
            ],
        },
        {
            "name": "Kavi Lounge Chair", "category": "Armchairs", "brand": "Teak & Twine",
            "tagline": "Rattan back, oiled teak frame, built for long afternoons.",
            "rooms": ["Living", "Study"], "seats": 1, "warranty": 36, "assembly": False,
            "attributes": [("material", "Rattan"), ("finish", "Natural Oil"), ("style", "Rustic")],
            "variants": [("KVI-LNG-01", None, "38500.00", "44000.00", 11, 720, 810, 900)],
        },
        {
            "name": "Sindhu Dining Table", "category": "Dining Tables", "brand": "Coromandel Works",
            "tagline": "A six-seat plank top with a shadow gap at every join.",
            "rooms": ["Dining"], "seats": 6, "warranty": 120, "assembly": True,
            "attributes": [("material", "Solid Sheesham"), ("finish", "Walnut Stain"),
                           ("style", "Contemporary")],
            "variants": [
                ("SDH-DIN-180", "1800mm, seats 6", "89000.00", None, 3, 1800, 900, 760),
                ("SDH-DIN-220", "2200mm, seats 8", "104000.00", None, 1, 2200, 1000, 760),
            ],
        },
        {
            "name": "Meru Sideboard", "category": "Sideboards", "brand": "Nivisa Studio",
            "tagline": "Four doors, cane fronts, and a cable pass at the back.",
            "rooms": ["Living", "Dining"], "warranty": 60, "assembly": False,
            "attributes": [("material", "Mango Wood"), ("finish", "Honey Lacquer")],
            "variants": [("MRU-SBD-160", None, "62000.00", "71000.00", 6, 1600, 420, 760)],
        },
        {
            "name": "Ilaa Bed Frame", "category": "Bed Frames", "brand": "Teak & Twine",
            "tagline": "A low platform with an upholstered headboard you can lean on.",
            "rooms": ["Bedroom"], "warranty": 84, "assembly": True,
            "attributes": [("material", "Solid Teak"), ("upholstery", "Linen"), ("colour", "Sand")],
            "variants": [
                ("ILA-BED-QN", "Queen", "78000.00", None, 5, 1650, 2100, 950),
                ("ILA-BED-KG", "King", "92000.00", None, 2, 1950, 2100, 950),
            ],
        },
        {
            "name": "Tara Writing Desk", "category": "Desks", "brand": "Nivisa Studio",
            "tagline": "Two drawers, a cable channel, and room for a second monitor.",
            "rooms": ["Study"], "warranty": 36, "assembly": True,
            "attributes": [("material", "Solid Sheesham"), ("finish", "Matte Black"),
                           ("style", "Minimal")],
            "variants": [("TRA-DSK-140", None, "44500.00", "52000.00", 9, 1400, 650, 750)],
        },
        {
            "name": "Ravi Floor Lamp", "category": "Floor Lamps", "brand": "Coromandel Works",
            "tagline": "A brass stem with a linen shade that throws a wide, warm pool.",
            "rooms": ["Living", "Bedroom"], "warranty": 24, "assembly": False,
            "attributes": [("material", "Powder-coated Steel"), ("colour", "Ochre")],
            "variants": [("RVI-FLR-01", None, "16500.00", None, 18, 400, 400, 1600)],
        },
        {
            "name": "Nila Coffee Table", "category": "Coffee Tables", "brand": "Nivisa Studio",
            "tagline": "A marble top on a slim steel base. Heavier than it looks.",
            "rooms": ["Living"], "warranty": 60, "assembly": False,
            "attributes": [("material", "Marble"), ("colour", "Verdigris"), ("style", "Contemporary")],
            "variants": [("NLA-CFT-110", None, "51000.00", "58000.00", 0, 1100, 600, 380)],
        },
        {
            "name": "Bela Bookcase", "category": "Bookcases", "brand": "Teak & Twine",
            "tagline": "Five open shelves, wall-fixing bracket included.",
            "rooms": ["Study", "Living"], "warranty": 60, "assembly": True,
            "attributes": [("material", "Mango Wood"), ("finish", "Whitewash")],
            "variants": [("BLA-BKC-190", None, "34000.00", None, 7, 900, 320, 1900)],
        },
        {
            "name": "Choti Kids Bench", "category": "Benches", "brand": "Nivisa Studio",
            "tagline": "Rounded everywhere it needs to be, at a height a five-year-old owns.",
            "rooms": ["Kids"], "seats": 2, "warranty": 24, "assembly": True,
            "attributes": [("material", "Mango Wood"), ("colour", "Terracotta")],
            "variants": [("CHT-BNC-90", None, "12500.00", "15000.00", 14, 900, 300, 340)],
        },
    ]

    products: list[Product] = []
    for entry in catalogue:
        product = Product(
            name=entry["name"],
            slug=slugify(entry["name"]),
            tagline=entry["tagline"],
            # Plain text with blank lines between paragraphs. The product
            # description is a plain-text field - the dashboard edits it in a
            # textarea, and the storefront renders it as text - so HTML here
            # would appear on the page as literal tags.
            description="\n\n".join([
                entry["tagline"],
                "Made to order in our Bengaluru workshop. Every piece is finished by hand, "
                "so the grain and tone vary a little from one to the next.",
            ]),
            category_id=categories[entry["category"]].id,
            brand_id=brands[entry["brand"]].id,
            status="active",
            assembly_required=entry.get("assembly"),
            assembly_note="Two-person assembly, roughly 30 minutes." if entry.get("assembly") else None,
            warranty_months=entry.get("warranty"),
            care_instructions="Dust with a dry cloth. Re-oil every six months. Keep out of direct sun.",
            seating_capacity=entry.get("seats"),
            specifications=[
                {"label": "Origin", "value": "Bengaluru, India"},
                {"label": "Lead time", "value": "3 to 5 weeks"},
            ],
            meta_title=f"{entry['name']} | Nivisa",
            meta_description=entry["tagline"],
        )
        session.add(product)
        await session.flush()
        products.append(product)

        for position, (sku, label, price, compare, stock, width, depth, height) in enumerate(entry["variants"]):
            session.add(
                ProductVariant(
                    product_id=product.id, sku=sku, option_label=label,
                    price=Decimal(price),
                    compare_at_price=Decimal(compare) if compare else None,
                    cost_price=Decimal(price) * Decimal("0.55"),
                    tax_rate=Decimal("18.00"),
                    stock_quantity=stock, low_stock_threshold=3,
                    width_mm=width, depth_mm=depth, height_mm=height,
                    lead_time_days=28, position=position,
                )
            )

        for room_name in entry["rooms"]:
            session.add(ProductRoom(product_id=product.id, room_id=rooms[room_name].id))
        for key in entry["attributes"]:
            session.add(ProductAttribute(product_id=product.id, attribute_id=attributes[key].id))

    await session.flush()

    for position, product in enumerate(products[:6]):
        session.add(
            CollectionProduct(
                collection_id=collections["New This Season"].id,
                product_id=product.id, position=position,
            )
        )
    for position, product in enumerate(products[2:8]):
        session.add(
            CollectionProduct(
                collection_id=collections["Best Sellers"].id,
                product_id=product.id, position=position,
            )
        )
    await session.flush()
    print(f"  {len(products)} products, {len(categories)} categories, {len(attributes)} attributes")


async def seed_homepage(session) -> None:
    if (await session.execute(select(HomepageSection.id))).first():
        return
    session.add_all([
        # The hero, the trust pillars and the promo band carry their copy in
        # `config` rather than living as hardcoded JSX. A shop that cannot
        # change its own headline without a release does not really own it.
        HomepageSection(
            kind="hero", position=0,
            title="Furniture that fits the room you actually have.",
            subtitle=(
                "Every piece lists its real dimensions before you buy, arrives "
                "assembled by our own team, and is built from materials we name "
                "in full. No showroom markup."
            ),
            config={
                "eyebrow": "Measured for Indian homes",
                "primary_cta": {"label": "Shop all furniture", "href": "/shop"},
                "secondary_cta": {"label": "Start with the living room", "href": "/rooms/living"},
                "stats": [
                    {"value": "10 yr", "label": "Structural warranty"},
                    {"value": "Free", "label": "Delivery & assembly"},
                    {"value": "7 day", "label": "No-questions returns"},
                ],
            },
        ),
        HomepageSection(kind="banner", position=6, config={"placement": "home_hero"}),
        HomepageSection(
            kind="collection_rail", title="New this season",
            subtitle="Pieces that have just come off the bench.",
            position=3, config={"collection_slug": "new-this-season", "limit": 8},
        ),
        HomepageSection(
            kind="room_grid", title="Shop by room",
            subtitle="Start where you are standing.", position=2, config={},
        ),
        HomepageSection(
            kind="collection_rail", title="Best sellers",
            subtitle="What our customers keep coming back for.",
            position=4, config={"collection_slug": "best-sellers", "limit": 8},
        ),
        HomepageSection(
            kind="trust", position=5,
            title="The parts of furniture shopping that usually go wrong.",
            config={
                "pillars": [
                    {"icon": "material", "title": "We name the material",
                     "body": "Solid teak, or engineered wood. It says which, on every listing."},
                    {"icon": "measure", "title": "Measured before you buy",
                     "body": "Real width, depth and height, so you can check it fits first."},
                    {"icon": "delivery", "title": "Delivered and assembled",
                     "body": "Our own team carries it in and builds it. No third-party handover."},
                    {"icon": "warranty", "title": "Ten-year structural warranty",
                     "body": "On the frame and the joinery, which is what actually fails."},
                ],
            },
        ),
        HomepageSection(
            kind="editorial", position=7,
            title="Built to be lived with, not looked after.",
            subtitle=(
                "Every piece is finished by hand in our Bengaluru workshop, so the "
                "grain and tone vary a little from one to the next."
            ),
            config={
                "eyebrow": "Made here",
                "cta": {"label": "See what is new", "href": "/shop?sort=newest"},
            },
        ),
    ])
    await session.flush()

    if not (await session.execute(select(Banner.id))).first():
        session.add(
            Banner(
                title="Made in Bengaluru, built to last",
                subtitle="Solid wood furniture, finished by hand.",
                # Filled in by scripts/seed_media.py.
                image_url="",
                mobile_image_url=None,
                alt_text="A living room with a low teak sofa and a marble coffee table",
                link_url="/shop", cta_label="Shop all furniture",
                placement="home_hero", position=0,
            )
        )
    await session.flush()
    print("  homepage sections and hero banner")


async def seed_coupons(session) -> None:
    if (await session.execute(select(Coupon.id))).first():
        return
    now = datetime.now(timezone.utc)
    session.add_all([
        Coupon(
            code="WELCOME10", description="10% off a first order, capped at Rs 5,000.",
            discount_type="percent", discount_value=Decimal("10"),
            max_discount=Decimal("5000"), min_order_value=Decimal("20000"),
            starts_at=now, ends_at=now + timedelta(days=365),
            usage_limit_per_customer=1, is_active=True,
        ),
        Coupon(
            code="FLAT2000", description="Rs 2,000 off orders over Rs 40,000.",
            discount_type="fixed", discount_value=Decimal("2000"),
            min_order_value=Decimal("40000"),
            starts_at=now, ends_at=now + timedelta(days=90),
            usage_limit=200, is_active=True,
        ),
    ])
    await session.flush()
    print("  2 coupons")


async def seed_customers(session) -> None:
    if (await session.execute(select(Customer.id))).first():
        return
    demo = [
        ("9876543210", "Priya Menon", "priya@example.com", "560038"),
        ("9812345678", "Rohan Gupta", "rohan@example.com", "400050"),
    ]
    for phone, name, email, pincode in demo:
        customer = Customer(phone=phone, name=name, email=email)
        session.add(customer)
        await session.flush()
        session.add(
            Address(
                customer_id=customer.id, kind="shipping", label="Home",
                full_name=name, phone=phone,
                line1="12, Second Cross", line2="Domlur",
                city="Bengaluru" if pincode.startswith("560") else "Mumbai",
                state="Karnataka" if pincode.startswith("560") else "Maharashtra",
                postal_code=pincode, country="IN", is_default=True,
            )
        )
    await session.flush()
    print("  2 demo customers (sign in with the console OTP)")


async def main() -> None:
    include_demo = "--no-demo" not in sys.argv

    print(f"Seeding {settings.APP_NAME} [{settings.APP_ENV}]")
    await create_schema()

    async with SessionLocal() as session:
        roles = await seed_roles(session)
        await seed_super_admin(session, roles)
        await seed_settings(session)
        await seed_pages(session)
        await seed_shipping(session)

        if include_demo:
            if settings.is_production:
                # Demo products in a production catalogue are a shop with
                # fake stock on the shelf. Refuse rather than warn.
                print("  refusing to seed demo data in production")
            else:
                await seed_demo_staff(session, roles)
                await seed_catalogue(session)
                await seed_homepage(session)
                await seed_coupons(session)
                await seed_customers(session)

        await session.commit()

    print("\nDone. Sign in to the dashboard with:")
    print(f"  email    {settings.SUPER_ADMIN_EMAIL}")
    print(f"  password {settings.SUPER_ADMIN_PASSWORD}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
