# API gaps — resolved

This file used to catalogue where the copied Navakarnataka book-catalogue
backend could not serve a furniture store. That backend no longer exists:
`apis/` was rebuilt furniture-native, and every gap it recorded is now
either present or deliberately out of scope.

| Was missing | Now |
|---|---|
| Multiple images | `product_images`, ordered, typed `studio`/`lifestyle`/`detail`/`dimension`, with required alt text |
| Variants | `product_variants` — the sellable unit, carrying SKU, price, stock and dimensions |
| Material, finish, colour, style, upholstery | One `attributes` table with a `kind`, driving the shop's facets |
| Room taxonomy | `rooms`, many-per-product, with "shop by room" served from it |
| Structured dimensions | Integer millimetre columns on the variant, plus boxed dimensions |
| Assembly, warranty, care | Columns on the product; null hides the section rather than filling it |
| Ratings on list responses | One grouped query per page — no N+1 |
| Merchandiser-defined collections | `collections`, created and ordered in the dashboard |
| Rating and discount sorting | `sort=rating`, `price_asc`, `price_desc`, `newest` |
| Pagination shape | One envelope everywhere: `{items, total, limit, offset, has_more}` |
| Category slugs | Real slugs, unique, generated from the name |
| Bilingual `{en, kn}` fields | Gone. Single-language fields |
| Payment token in a query string | `POST /orders/{n}/pay` returns a URL; the session token stays in the Authorization header |
| Order state derived from four integer columns | Two explicit enums, `fulfilment_status` and `payment_status`, with a transition table the API enforces |
| No RBAC (every account was super admin) | A permission registry, roles, and a guard on every admin endpoint |

**AR and 3D (Phase 13) is now built** — see the section below.

Still out of scope, and not faked anywhere: conversion rate, sessions and
traffic sources. Nothing in the dashboard displays a figure it cannot derive
from real rows.

---

## The storefront has been migrated

`web/` now runs against this backend. The adapter layer that existed to
translate book vocabulary is gone; what remains derives stock state, discount
percent and badges, which is work that belongs on the client.

Four things were added to the API to serve it honestly:

- `GET /catalog/serviceability/{pincode}` — will we deliver, when, and for how
  much, answered from the same shipping zones that price the order.
- `GET /store` — the shop's own contact details, from the settings staff edit.
- `default_variant_id` on a product card, so a single-option piece can be added
  to the cart from a grid or a wishlist. A card with several options links to
  the product page instead, because choosing a finish for someone is guessing.
- A quantity-only cart update, so a line's variant cannot be resent wrong.

Two deletions, both because there was no backend for them and a link to an
empty page is worse than no link: the admin panel that lived inside `web/`
(duplicating `admin_dashboard/`), and the blog.

`docs/DESIGN.md` is unaffected: it records visual and interaction decisions,
none of which depended on the backend.


---

## Phase 13 — AR and 3D

Built. The storefront's `ProductArMetadata` type described this subsystem
before it existed; it now exists.

**The rule everything else follows:** a model shown at the wrong size in
someone's living room is worse than no model, because it answers the only
question AR is being asked — *will this fit, will it look right* — and answers
it confidently and wrongly. So publishing is gated on arithmetic: a model's
stated real-world size must agree with the variant's own dimensions within 5%,
and `POST /admin/ar/{id}/publish` refuses otherwise. The dashboard shows the
same check live, but the server is what protects customers.

| | |
|---|---|
| Model | `product_ar_assets` — one per product, versioned |
| Formats | `.glb` for Android and the web, `.usdz` for iOS. Neither substitutes for the other, so they are separate slots and a product may have one without the other |
| Permission | `ar.manage`, held by Super Admin, Store Manager and Catalogue Manager |
| Storefront | `ar` appears on a product **only** when status is `ready`, so an unfinished or failed model cannot leak into the shop |
| Viewer | None. iOS uses `<a rel="ar">` (AR Quick Look), Android uses a Scene Viewer intent with `resizable=false`. A WebGL library would be hundreds of kilobytes on the device least able to afford it |
| Desktop | No AR button. It says the piece has a model, says to open the page on a phone, and names the dimensions |

### AR analytics

Two numbers, both observable: how many sessions opened AR on a product, and
how many of those went on to add it to the cart.

There is deliberately **no placement rate**. AR is handed to the operating
system, and neither iOS Quick Look nor Android Scene Viewer reports back
whether the model was placed in a room. Any such figure would be invented, and
one invented number discredits the two real ones.

### Not built

Automatic model optimisation (draco/meshopt compression, poly reduction) and
server-side USDZ generation from a glTF. Both are real pipeline work with real
dependencies; today a 3D artist uploads both formats, and the 40 MB ceiling is
what keeps a model downloadable over mobile data.
