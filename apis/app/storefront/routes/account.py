"""Profile, addresses, wishlist and writing a review."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.rbac import get_current_customer
from app.models.catalog import Product, Review, Wishlist
from app.models.commerce import Order, OrderItem
from app.models.customer import Address, Customer
from app.schemas.catalog import ProductCard, ReviewCreate, ReviewOut
from app.schemas.common import Message
from app.schemas.identity import AddressOut, AddressWrite, CustomerOut, CustomerProfileUpdate
from app.services import catalog as catalog_service

router = APIRouter(prefix="/account", tags=["Shop · Account"])


@router.put("/profile", response_model=CustomerOut)
async def update_profile(
    payload: CustomerProfileUpdate,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    if payload.name is not None:
        customer.name = payload.name
    if payload.email is not None:
        customer.email = payload.email.lower()
    await db.commit()
    return CustomerOut.model_validate(customer)


# --- Addresses --------------------------------------------------------------


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    rows = (
        await db.execute(
            select(Address)
            .where(Address.customer_id == customer.id, Address.is_archived.is_(False))
            .order_by(Address.is_default.desc(), Address.id.desc())
        )
    ).scalars().all()
    return [AddressOut.model_validate(a) for a in rows]


async def _clear_other_defaults(db: AsyncSession, customer_id: int, kind: str, keep_id: int | None) -> None:
    """Exactly one default per kind.

    Enforced here rather than by a partial unique index because the write
    that sets a new default and the write that clears the old one have to be
    the same statement pair - an index would make the second one an error
    instead of a correction.
    """
    query = update(Address).where(
        Address.customer_id == customer_id, Address.kind == kind, Address.is_default.is_(True)
    )
    if keep_id is not None:
        query = query.where(Address.id != keep_id)
    await db.execute(query.values(is_default=False))


@router.post("/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
async def add_address(
    payload: AddressWrite,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    existing = await db.scalar(
        select(func.count(Address.id)).where(
            Address.customer_id == customer.id, Address.kind == payload.kind,
            Address.is_archived.is_(False),
        )
    )
    row = Address(**payload.model_dump(), customer_id=customer.id)
    # The first address of a kind is the default whether or not the box was
    # ticked; otherwise checkout has nothing preselected.
    if not existing:
        row.is_default = True

    db.add(row)
    await db.flush()
    if row.is_default:
        await _clear_other_defaults(db, customer.id, row.kind, row.id)
    await db.commit()
    return AddressOut.model_validate(row)


@router.put("/addresses/{address_id}", response_model=AddressOut)
async def update_address(
    address_id: int,
    payload: AddressWrite,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    row = (
        await db.execute(
            select(Address).where(Address.id == address_id, Address.customer_id == customer.id)
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That address is not on your account.")

    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    await db.flush()
    if row.is_default:
        await _clear_other_defaults(db, customer.id, row.kind, row.id)
    await db.commit()
    return AddressOut.model_validate(row)


@router.delete("/addresses/{address_id}", response_model=Message)
async def remove_address(
    address_id: int,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    """Archives rather than deletes.

    Past orders keep a copy of the address text, so a delete would not
    rewrite history - but the row is also what a future "use this again"
    would point at, and orders in flight reference it.
    """
    row = (
        await db.execute(
            select(Address).where(Address.id == address_id, Address.customer_id == customer.id)
        )
    ).scalars().first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That address is not on your account.")
    row.is_archived = True
    row.is_default = False
    await db.commit()
    return Message(message="Address removed.")


# --- Wishlist ---------------------------------------------------------------


@router.get("/wishlist", response_model=list[ProductCard])
async def wishlist(
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    rows = (
        await db.execute(
            select(Product)
            .options(
                selectinload(Product.variants), selectinload(Product.images),
                selectinload(Product.category), selectinload(Product.brand),
            )
            .join(Wishlist, Wishlist.product_id == Product.id)
            .where(Wishlist.customer_id == customer.id, Product.status == "active")
            .order_by(Wishlist.created_at.desc())
        )
    ).scalars().unique().all()
    ratings = await catalog_service.rating_map(db, [p.id for p in rows])
    return [catalog_service.to_card(p, ratings) for p in rows]


@router.post("/wishlist/{product_id}", response_model=Message)
async def add_to_wishlist(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    exists = (
        await db.execute(
            select(Wishlist).where(
                Wishlist.customer_id == customer.id, Wishlist.product_id == product_id
            )
        )
    ).scalars().first()
    # Idempotent: a double tap on a heart icon is a very ordinary thing and
    # must not be a 409.
    if exists:
        return Message(message="Already saved.")

    product = (await db.execute(select(Product.id).where(Product.id == product_id))).first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that piece.")

    db.add(Wishlist(customer_id=customer.id, product_id=product_id))
    await db.commit()
    return Message(message="Saved.")


@router.delete("/wishlist/{product_id}", response_model=Message)
async def remove_from_wishlist(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    row = (
        await db.execute(
            select(Wishlist).where(
                Wishlist.customer_id == customer.id, Wishlist.product_id == product_id
            )
        )
    ).scalars().first()
    if row:
        await db.delete(row)
        await db.commit()
    return Message(message="Removed.")


# --- Reviews ----------------------------------------------------------------


@router.post("/reviews/{product_id}", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def write_review(
    product_id: int,
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    product = (await db.execute(select(Product).where(Product.id == product_id))).scalars().first()
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "We could not find that piece.")

    already = (
        await db.execute(
            select(Review.id).where(Review.product_id == product_id, Review.customer_id == customer.id)
        )
    ).first()
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already reviewed this piece.")

    # The verified badge is derived from delivered orders here, never taken
    # from the request. A client-supplied flag would make the badge worthless.
    delivered = (
        await db.execute(
            select(OrderItem.id)
            .join(Order, Order.id == OrderItem.order_id)
            .where(
                OrderItem.product_id == product_id,
                Order.customer_id == customer.id,
                Order.fulfilment_status.in_(("dispatched", "delivered")),
            )
        )
    ).first()

    review = Review(
        product_id=product_id,
        customer_id=customer.id,
        rating=payload.rating,
        title=payload.title,
        body=payload.body,
        author_name=payload.author_name or customer.name or "Verified buyer",
        is_verified_purchase=delivered is not None,
        status="pending",
    )
    db.add(review)
    await db.commit()
    return ReviewOut.model_validate(review)


@router.get("/recently-viewed", response_model=list[ProductCard])
async def recently_viewed(
    limit: int = Query(8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    customer: Customer = Depends(get_current_customer),
):
    from app.models.catalog import RecentlyViewed

    rows = (
        await db.execute(
            select(Product)
            .options(
                selectinload(Product.variants), selectinload(Product.images),
                selectinload(Product.category), selectinload(Product.brand),
            )
            .join(RecentlyViewed, RecentlyViewed.product_id == Product.id)
            .where(RecentlyViewed.customer_id == customer.id, Product.status == "active")
            .order_by(RecentlyViewed.updated_at.desc()).limit(limit)
        )
    ).scalars().unique().all()
    ratings = await catalog_service.rating_map(db, [p.id for p in rows])
    return [catalog_service.to_card(p, ratings) for p in rows]
