# Nivisa

Furniture commerce: a FastAPI backend, a React staff dashboard, and a Next.js
storefront.

```
apis/              FastAPI + PostgreSQL. Storefront API and admin API.
admin_dashboard/   React + Vite staff dashboard.
web/               Next.js storefront.
docs/              Design decisions.
```


All three run from one `docker compose up`. The storefront and the dashboard
are separate applications on purpose: they have different audiences, different
auth, and almost no shared code.

---

## Running it

Docker is the only prerequisite. Nothing here touches a payment gateway, an
SMS provider, a CDN or a mail relay, so it costs nothing to run and needs no
account anywhere.

**Windows** — double-click `nivisa.bat`, or from a prompt:

```bat
nivisa
```

**macOS, Linux, or Git Bash on Windows:**

```bash
./nivisa.sh
```

Either one builds the images, starts everything, waits until the services
genuinely answer, and prints the URLs and sign-in details. Both check the
ports first and name the clash, rather than letting Docker fail with a wall
of text that does not say which port.

| Command | What it does |
|---|---|
| `nivisa` | Build and start everything |
| `nivisa down` | Stop, keeping the database |
| `nivisa reset` | Stop, **delete** the database, start fresh |
| `nivisa restart` | Restart the three application containers |
| `nivisa logs [service]` | Follow the logs |
| `nivisa seed` | Re-run the seeder (idempotent) |
| `nivisa psql` | Open a database shell |
| `nivisa status` | What is running |

Or drive Compose yourself, if you would rather:

```bash
docker compose up --build
```

| | |
|---|---|
| Storefront | http://localhost:3001 |
| Staff dashboard | http://localhost:5174 |
| API docs | http://localhost:8000/docs |
| Mail inbox (Mailpit) | http://localhost:8025 |
| PostgreSQL | `localhost:5433` — `nivisa` / `nivisa` |

> The storefront is published on **3001**, because port 3000 is in use by
> another project on this machine. To move it, change the published port in
> `docker-compose.yml` and change `STOREFRONT_URL` and `NEXT_PUBLIC_SITE_URL`
> alongside it — the payment gateway is told where to send the browser back
> to, so a port changed in one place and not the others strands the customer
> after paying.

The database is created and seeded automatically on first start: roles, the
super admin, content pages, shipping zones, and a demo catalogue of ten
furniture products. The seed is idempotent, so restarting never resets your
data.

### Sign in

**Super admin — full access to everything:**

```
superadmin@nivisa.in
Nivisa@2026
```

Five more accounts exist so the permission model can be seen working without
creating anything. All use the same password, `Nivisa@2026`:

| Email | Role | What they can do |
|---|---|---|
| `manager@nivisa.in` | Store Manager | Everything except staff, roles and settings |
| `catalogue@nivisa.in` | Catalogue Manager | Products, taxonomy, content. No orders or customers |
| `orders@nivisa.in` | Order Manager | Orders and customers. Read-only catalogue |
| `support@nivisa.in` | Support Agent | Read orders, edit customers, reply to reviews |
| `viewer@nivisa.in` | Viewer | Read-only across the dashboard |

> Change the super admin's password on the Staff screen before this is
> reachable by anyone but you. The password above is in a file in the repo.

### Signing in as a customer

The storefront logs in by phone OTP. With `SMS_PROVIDER=console` and
`APP_ENV=local` the code is always **`123456`** and is also returned in the
API response, so no log-reading is needed. The seed creates two demo
customers: `9876543210` and `9812345678`.

That fixed code requires *both* the console provider and the local
environment — neither alone unlocks it.

### Paying for a test order

`PAYMENT_PROVIDER=mock` sends the browser to a stand-in checkout screen at
`/api/v1/checkout/mock` with a **Pay** and a **Decline** button, then returns
it to the storefront carrying only the order number — exactly as a real
gateway does. The outcome is discovered by re-reading the order, never from
the redirect URL.

### Useful commands

```bash
docker compose logs -f api          # follow the API log (OTP codes appear here)
docker compose exec db psql -U nivisa -d nivisa
docker compose run --rm api python -m scripts.seed
docker compose exec api python -m scripts.seed_media   # images for anything without one
docker compose down -v              # start completely fresh
```

---

## Running against the staging API

The API is deployed at **https://staging.thirdeyegfx.in/nivisa/** — cPanel,
with Supabase behind it and uploads on Bunny. It is served under the `/nivisa`
path prefix, so that prefix is part of the base URL everywhere: the storefront
appends `/api/v1` to it, and the deployment sets its own `root_path` to match,
which is why `/nivisa/docs` and `/nivisa/openapi.json` resolve.

Point the front ends at it by running them natively — not through Compose,
which sets these as real environment variables and wins over the files.

**Storefront** — `web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=https://staging.thirdeyegfx.in/nivisa
```

**Dashboard** — `admin_dashboard/.env.local`:

```
VITE_API_PROXY_TARGET=https://staging.thirdeyegfx.in/nivisa
```

The dashboard goes through the Vite proxy rather than calling across origins,
so the browser still only makes same-origin requests. A path prefix in the
target is kept, so `/api/v1/admin/orders` arrives as
`/nivisa/api/v1/admin/orders`. Only a *built* dashboard, served from somewhere
that cannot forward `/api`, needs the cross-origin route — that is what
`VITE_API_URL` is for, and it requires the dashboard's origin in the API's
`CORS_ORIGINS`.

Comment the staging line out in either file to go back to the local stack.

`CORS_ORIGINS` on the deployment already lists `http://localhost:3000`,
`:3001` and `:5174`, so a storefront on any of those three is allowed. A
storefront on a fourth port fails in the browser while curl against the same
URL succeeds — the port, not the code, is what to check.

---

## Roles and permissions

A permission is a `<group>.<action>` string, and the registry in
[`apis/app/core/permissions.py`](apis/app/core/permissions.py) is the single
source of truth. Every admin endpoint declares what it needs:

```python
@router.post("", dependencies=[Depends(require("products.write"))])
```

Three things follow from having one registry:

- **The dashboard is served the list**, so a permission added to the backend
  appears in the role editor with no frontend release.
- **The staff row is re-read on every request**, not trusted from the token,
  so revoking a permission or deactivating an account takes effect at once
  rather than when a token expires.
- **Hiding and enforcing are separate.** The dashboard hides what a role
  cannot use; the API refuses it regardless. Either alone is a bug — hiding
  alone is security by obscurity, enforcing alone leaves staff clicking
  buttons that always fail.

Six roles ship with the product. Create as many more as you like on
**Settings → Roles & permissions**; each is a set of checkboxes over the same
registry.

Two guards exist specifically to stop a shop locking itself out:

- The **Super Admin** role cannot be edited, and no custom role can be granted
  full access — otherwise the recovery path for every other mistake on that
  screen could itself be removed.
- Nobody can change their **own** role or deactivate their own account.

---

## Going to production

Every integration that costs money is chosen by a `*_PROVIDER` variable rather
than an `if DEBUG` branch, so the local path and the production path run the
same code. Switching is environment only — no code change, no rebuild.

| Variable | Local | Production |
|---|---|---|
| `PAYMENT_PROVIDER` | `mock` | `phonepe` + merchant credentials |
| `STORAGE_PROVIDER` | `local` (Docker volume) | `bunny`, or `s3` + bucket credentials |
| `EMAIL_PROVIDER` | `smtp` → Mailpit | `smtp` → your relay |
| `SMS_PROVIDER` | `console` (logs the OTP) | `msg91` + auth key |

`STORAGE_PROVIDER=s3` covers anything S3-compatible: AWS, Cloudflare R2,
DigitalOcean Spaces, Wasabi. **Bunny has its own provider** — `bunny` — using
Bunny's Edge Storage API rather than its S3 endpoint, which was still in
public preview when this was written.

Deploying the API to cPanel is a supported path and has its own guide:
[`docs/DEPLOY-CPANEL.md`](docs/DEPLOY-CPANEL.md). cPanel runs Passenger, which
speaks WSGI, so `apis/passenger_wsgi.py` bridges to the same ASGI app that
uvicorn and Docker run — nothing forks.

Set `APP_ENV=production` and the API **refuses to start** while `SECRET_KEY`
is still the default, `PAYMENT_PROVIDER` is still `mock`, or `SMS_PROVIDER` is
still `console`. A production box running on a shipped secret is a
forgeable-token box, and startup is the moment to find that out.

The full list, with what each value does, is in
[`apis/.env.example`](apis/.env.example).

Two things to do before real customers arrive:

1. Change the super admin password, and delete the five demo staff accounts.
2. Point `DATABASE_URL` at a managed PostgreSQL. The schema is created by
   `scripts/seed.py`; run it once with `--no-demo` so no sample furniture
   lands in a real catalogue (it also refuses to seed demo data when
   `APP_ENV=production`).

---

## How the backend is laid out

```
apis/app/
  core/          config, database, security, permissions, RBAC guards, audit
  models/        SQLAlchemy models, split by domain
  schemas/       Pydantic request/response models
  providers/     payments, storage, email, SMS — one interface, two backends each
  services/      pricing, cart, orders, catalogue serialisation
  admin/routes/  the staff API, each endpoint permission-guarded
  storefront/    the public API
```

A few decisions worth knowing before changing things:

- **Price and stock belong to a variant, never a product.** A sofa in three
  finishes is one product and three variants. Products with one option still
  get one variant, so nothing downstream needs a "does this have variants"
  branch.
- **Dimensions are integer millimetres**, not free text. "Under 2000mm wide"
  and "will it fit" are the two questions a furniture buyer actually asks,
  and neither can be answered by parsing a string at read time.
- **Fulfilment and payment are two independent enums**, each with a CHECK
  constraint and, for fulfilment, a transition table the API enforces. An
  illegal jump returns 409 rather than half-applying.
- **Orders copy what they need.** Product name, SKU, image and address are
  snapshotted at checkout, so renaming a product or editing an address never
  rewrites what a past invoice says.
- **Money is quantised at every step**, not once at the end. Rounding once
  produces a grand total that is a paisa off the sum of the lines above it.
- **Nothing is deleted that something else references.** Products archive,
  variants deactivate, customers and staff suspend, coupons deactivate,
  addresses archive.

---

## AR and 3D

Furniture is the case AR is genuinely good for, and the whole design turns on
one rule: **a model at the wrong scale is worse than no model.** It answers
"will this fit in my room" confidently and wrongly.

So a 3D model is only ever offered to a customer once its stated real-world
size agrees with the product's own dimensions, within 5%. The API refuses to
publish otherwise — the dashboard shows the same check as you type, but the
server is what enforces it.

Manage models on the product itself: **Catalogue → Products → the product →
AR & 3D**. Upload a `.glb` (Android, web) and a `.usdz` (iPhone, iPad), set the
real-world size, publish. It sits on the product because the size check is
against that product's own dimensions, a few sections up the same page. The
uploaded `.glb` renders in the page, so a model can be turned and checked
without downloading it into another program; the viewer is fetched on demand,
so nobody pays for it while editing a description.

To find what still needs one, the **Products** list has an AR column and an AR
filter — "Needs a model" is the view that used to be a screen of its own.

On the shop, a piece with a published model gets **View in your room**, which
opens the phone's own AR viewer — no 3D library is downloaded. Desktop says
the model exists, says to open the page on a phone, and gives the dimensions
instead.

Reporting is under **Reports**: how many sessions opened AR, and how many then
added to the cart. There is no "placement rate", because the operating system
never tells the page whether the model was actually placed — that number would
be invented.

---

## The storefront

Runs against the same API. Two things about it worth knowing:

- **Navigation is built from the catalogue**, not from a config file. Add a
  category, room or collection in the dashboard and it appears in the menu,
  with links that genuinely filter rather than falling back to a search.
- **The homepage is what the dashboard's Homepage screen says it is.** Bands
  are ordered there, collections are picked there, and each rail arrives from
  the API with its products already in it.

`NEXT_PUBLIC_DEMO_CONTENT=true` still renders sample furniture with a visible
banner, for working on the design with no API running.

### Catalogue imagery

There is no Nivisa photography, so everything you see is a stand-in, and there
are two kinds:

- **Stand-in photographs**, hotlinked from Unsplash. The default, because line
  art on every card reads as a wireframe to anyone being shown the shop. Free
  for commercial use with no attribution under the [Unsplash
  licence](https://unsplash.com/license). The bank lives in
  `apis/scripts/photos.py` and `web/src/config/stockImages.ts`, with the photo
  ids legible so any frame can be traced back to a photograph.
- **Drawn artwork**, SVG generated locally by `apis/scripts/artwork.py`. Costs
  no network, so the catalogue still renders on a train, in CI, or behind an
  egress proxy — which is where a page of remote URLs becomes a page of broken
  images.

```bash
docker compose exec api python -m scripts.seed_media             # photographs
docker compose exec api python -m scripts.seed_media --drawings  # local SVGs
docker compose exec api python -m scripts.seed_media --replace   # redo them
```

`python tools/check_photo_banks.py` checks the storefront's bank against the
API's; they cannot import each other, so this is what makes drift visible.

Switching between the two needs no extra flag — a run replaces stand-ins that
came from the other source. Neither ever touches an uploaded image: real
photography added through the dashboard wins, per product, with no code change.
Alt text on a stand-in says it is one, so nobody using a screen reader is told
a stock room is the piece they are buying. The one framing that is always
drawn is the dimension diagram, because a measured drawing is information
about a specific product and no stock library has one.

---

## What was removed

Both folders started as a copy of a Kannada book publisher's site. Everything
below was specific to that business and has been taken out rather than
carried forward as dead weight:

eBook reader, purchases and annotations · Hosathu magazine subscriptions ·
author, translator, editor, publisher, language and book-size masters ·
annual returns · eight hardcoded "collection" flag tables (now
merchandiser-created collections) · the `old_*` legacy migration tables ·
bilingual `{en, kn}` field pairs · the four-integer-column order state
machine · onboarding tours tied to deleted screens.

Two more removals from the storefront:

- **The admin panel that lived inside `web/`.** It duplicated
  `admin_dashboard/`, and two staff tools means every catalogue change has to
  be made twice.
- **The blog.** There is no backend for it, and a permanently empty "Journal"
  in the footer is a dead link. Adding one back means a blog in the API first.

The old code is in git history in all three folders if anything needs
recovering.
