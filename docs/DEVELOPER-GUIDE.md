# Nivisa — developer guide

Start here if you are new to the codebase. This covers what the project is,
how the pieces fit together, and how to get it running on your machine. The
root [`README.md`](../README.md) goes deeper on individual features (roles,
AR, imagery, going to production); this file is the map and the setup.

---

## 1. What Nivisa is

An online furniture store for an Indian retailer, made of three applications
over one API:

| App | Folder | Audience | Stack |
|---|---|---|---|
| **API** | `apis/` | Both front ends | Python 3.12, FastAPI, SQLAlchemy 2 (async), PostgreSQL 16 |
| **Storefront** | `web/` | Customers | Next.js 16 (App Router), React 19, TanStack Query, Tailwind 4 |
| **Staff dashboard** | `admin_dashboard/` | Shop staff | React 18, Vite 5, `@google/model-viewer` for 3D previews |

The storefront and the dashboard are separate apps on purpose: different
users, different auth, almost no shared code.

Customer-facing features: catalogue browsing by category, room and
collection; faceted filters (material, finish, colour, style, price); product
pages with variants and millimetre dimensions; cart, checkout, orders,
wishlist; phone-OTP login; and **"View in your room" AR** on phones.

Staff features: products and variants, taxonomy, collections, homepage
bands, banners, content pages, coupons, shipping zones, orders, customers,
reviews, reports, audit log, staff accounts and role-based permissions, and
3D model management for AR.

### How the pieces talk

```
  Browser ──► Storefront (Next.js :3001) ──┐
     │         server-side fetches ────────┤
     └─────────────────────────────────────┤
                                           ▼
  Browser ──► Dashboard (Vite :5174) ──► /api proxy ──► API (FastAPI :8000)
                                                          │
                                   ┌──────────────────────┼─────────────────────┐
                                   ▼                      ▼                     ▼
                         PostgreSQL (:5433)       Media storage           Providers
                     or Supabase over HTTPS     local disk / Bunny /   payments · SMS ·
                         (DATA_BACKEND)          S3 (STORAGE_PROVIDER)  email (Mailpit)
```

- The **storefront** calls the API from both the browser and the Next.js
  server. Those two sides can need different addresses (inside Docker the
  server reaches `http://api:8000`, the browser `http://localhost:8000`),
  which is why there are two variables: `NEXT_PUBLIC_API_BASE_URL` and
  `INTERNAL_API_BASE_URL`.
- The **dashboard** never calls the API across origins in development. Vite
  proxies `/api` and `/media` to `VITE_API_PROXY_TARGET`, so CORS doesn't
  come into it.
- All API routes live under `/api/v1`: storefront routes at `/api/v1/...`,
  staff routes at `/api/v1/admin/...`. Interactive docs are at `/docs`.

### Two data backends

The API can reach its data two ways, chosen by `DATA_BACKEND`:

| Value | How | Used by |
|---|---|---|
| `postgres` (default) | SQLAlchemy over the Postgres wire protocol | Local Docker stack, any normal host |
| `supabase` | Supabase PostgREST over HTTPS (`app/core/supabase.py`) | Staging on cPanel, whose host blocks outbound port 5432 |

Routes branch on `settings.DATA_BACKEND == "supabase"` and call a
`*_supabase.py` service. The complex queries on the Supabase path are
Postgres functions defined in `apis/sql/` and called through `rpc()`. When
you change a read path, **change both branches** or they'll drift apart. The
reasoning is in [`CPANEL-SUPABASE-HTTP.md`](CPANEL-SUPABASE-HTTP.md).

### Swappable providers

Anything that costs money sits behind a `*_PROVIDER` variable with a free
local implementation, so local and production run the same code:

| Variable | Local | Production |
|---|---|---|
| `PAYMENT_PROVIDER` | `mock`: a local Pay/Decline screen | `phonepe` |
| `SMS_PROVIDER` | `console`: OTP is always `123456` | `msg91` |
| `EMAIL_PROVIDER` | `smtp` → Mailpit inbox | `smtp` → a real relay |
| `STORAGE_PROVIDER` | `local`: a Docker volume | `bunny` or `s3` |

With `APP_ENV=production`, the API won't start while any stand-in is still
configured or `SECRET_KEY` still has its default value.

---

## 2. Repository map

```
apis/                     FastAPI backend
  main.py                 App entry point (uvicorn main:app)
  passenger_wsgi.py       cPanel/Passenger WSGI bridge to the same app
  app/
    core/                 config, database, security, permissions registry, RBAC, audit, supabase client
    models/               SQLAlchemy models by domain (catalog, commerce, customer, content, rbac, ar, system)
    schemas/              Pydantic request/response models
    providers/            payments, storage, notifications (email + SMS)
    services/             business logic: pricing, cart, orders, catalogue, AR (+ *_supabase variants)
    admin/routes/         staff API, every endpoint permission-guarded
    storefront/routes/    public API: catalog, cart, orders, account, auth, content, mock checkout
  scripts/                seed.py (schema + demo data), seed_media.py (stand-in images)
  sql/                    Postgres functions for the Supabase/PostgREST path
  requirements.txt

web/                      Next.js storefront
  src/app/(storefront)/   customer routes: shop, product, category, rooms, collection, cart, account, ...
  src/app/checkout/       checkout flow
  src/app/design-system/  live token/component reference page
  src/api/  src/hooks/    API client and TanStack Query hooks
  src/components/         UI, including product/ArButton.tsx
  src/styles/globals.css  design tokens (reasoning in docs/DESIGN.md)

admin_dashboard/          React + Vite staff dashboard
  src/pages/              one file per screen (Products, ProductEditor, Orders, Roles, ...)
  src/components/ src/lib/
  vite.config.ts          dev proxy to the API

tools/                    one-off scripts run from a laptop (see section 6)
docs/                     design decisions, deployment guides
assets/                   the client's raw product photographs
docker-compose*.yml       local stack and its variants (see section 3)
nivisa.sh / nivisa.bat    one-command launcher around docker compose
render.yaml               Render deployment blueprint
```

---

## 3. Local setup: Docker (recommended)

### Prerequisites

- **Docker Desktop** with Compose v2 (`docker compose version` should work)
- **Git**
- These ports free: `3001`, `5174`, `8000`, `5433`, `6379`, `1025`, `8025`

That's all. You don't need Python or Node on the host, or any cloud account.

### First run

```bash
git clone <repo-url> "Project Nivisa"
```

```bash
cd "Project Nivisa"
```

Then start everything with the launcher. It checks ports, builds, waits
until each service is actually answering, and prints the URLs:

```bash
./nivisa.sh
```

On Windows, run `nivisa` from a Command Prompt or double-click
`nivisa.bat`. Or skip the launcher:

```bash
docker compose up --build
```

The first build takes a few minutes. On first start the API creates the
schema and seeds roles, staff, content pages, shipping zones and ten demo
products. The seed is idempotent, so later restarts leave your data alone.

### What you get

| | URL |
|---|---|
| Storefront | http://localhost:3001 |
| Staff dashboard | http://localhost:5174 |
| API docs (Swagger) | http://localhost:8000/docs |
| Mail inbox (Mailpit) | http://localhost:8025 |
| PostgreSQL | `localhost:5433`, user `nivisa`, password `nivisa`, db `nivisa` |

**Staff login:** `superadmin@nivisa.in` / `Nivisa@2026`. Five more role
accounts (`manager@`, `catalogue@`, `orders@`, `support@`, `viewer@`) use the
same password. See the README for what each role can do.

**Customer login:** phone `9876543210` or `9812345678`, OTP `123456`.

**Test payment:** checkout sends you to a mock gateway page with **Pay** and
**Decline** buttons.

Source folders are bind-mounted, so edits hot-reload: the API through
`uvicorn --reload`, the dashboard through Vite, and the storefront through
`next dev`. On Docker the storefront runs `next dev --webpack` with polling,
because Turbopack doesn't see file changes across a Windows bind mount. Each
route compiles on its first visit, which takes 2–3 s. That's normal for the
dev server and doesn't mean the site is slow.

### Launcher commands

| `./nivisa.sh …` | Does |
|---|---|
| *(nothing)* | Build and start |
| `down` | Stop, keep the database |
| `reset` | Stop, **delete** the database, start fresh |
| `restart` | Restart api, web, admin |
| `logs [service]` | Follow logs |
| `seed` | Re-run the seeder |
| `psql` | Database shell |
| `status` | What's running |

### Compose file variants

`docker-compose.yml` is the base stack and the only compose file you need
after a fresh clone. Some machines also have these local files, which aren't
committed:

| File | Loaded | Purpose |
|---|---|---|
| `docker-compose.override.yml` | **Automatically**, by any plain `docker compose` command, including the launcher | Phone testing over Wi‑Fi: production web build bound to a hard-coded LAN IP, Bunny storage |
| `docker-compose.local.yml` | Only with `-f` | Desktop-only run pinned to local Postgres; moves Postgres to host port 5434 |
| `docker-compose.demo.yml` | Only with `-f` | Production `next build` of the storefront, for showing the site to the client |

If `docker-compose.override.yml` exists, plain `docker compose up` gives you
the phone setup. For normal desktop work, load the files explicitly:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

For a fast client demo, where there's no hot reload and each code change
means a restart of about a minute:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.demo.yml up -d web
```

### ⚠ Don't edit staging data by accident

`apis/.env` is read by the API inside Docker too, because `./apis` is
mounted at `/app`. On machines where it's set up for staging it contains
`DATA_BACKEND=supabase` and the **shared staging Supabase** credentials. The
base `docker-compose.yml` doesn't override `DATA_BACKEND`, so the base file
alone with that `.env` will read and write **staging data the client sees**.

The `local` and `override` compose files both pin `DATA_BACKEND: postgres`
for this reason. If you have a staging `apis/.env`, always include one of
them. To check which backend is live, look at the first lines of
`docker compose logs api`, or ask the database directly.

---

## 4. Local setup: native (without Docker)

Use this to run one piece against a remote API, or to use IDE debuggers.
Prerequisites: **Python 3.12**, **Node 20**, and a PostgreSQL 16 instance.
The easy way to get Postgres is to start only the infrastructure from Compose:

```bash
docker compose up -d db cache mail
```

### API

```bash
cd apis
```

```bash
python -m venv .venv
```

Activate the environment with `source .venv/Scripts/activate` in Git Bash, or
`.venv\Scripts\activate` in PowerShell or cmd. Then:

```bash
pip install -r requirements.txt
```

```bash
cp .env.example .env
```

Edit `.env`. At minimum, set `DATABASE_URL` to the Compose Postgres
(`postgresql+asyncpg://nivisa:nivisa@localhost:5433/nivisa`), set
`MEDIA_ROOT` to a local folder such as `./media`, and add
`http://localhost:3001` to `CORS_ORIGINS`. Then seed and run:

```bash
python -m scripts.seed
```

```bash
uvicorn main:app --reload --port 8000
```

### Storefront

```bash
cd web
```

```bash
npm install
```

Create `web/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm run dev
```

It runs on http://localhost:3000. Set `NEXT_PUBLIC_DEMO_CONTENT=true` to work
on layout with no API at all; the page shows sample furniture and a visible
banner.

### Dashboard

```bash
cd admin_dashboard
```

```bash
npm install
```

```bash
npm run dev
```

It runs on http://localhost:5174 and proxies to `http://127.0.0.1:8000` by
default. To point it elsewhere, set `VITE_API_PROXY_TARGET` in
`admin_dashboard/.env.local`.

In the Claude desktop app, `.claude/launch.json` has `nivisa-web` and
`nivisa-admin` entries that start these two dev servers.

### Front ends against staging

Point the front ends at the deployed API instead of a local one:

```
# web/.env.local
NEXT_PUBLIC_API_BASE_URL=https://staging.thirdeyegfx.in/nivisa

# admin_dashboard/.env.local
VITE_API_PROXY_TARGET=https://staging.thirdeyegfx.in/nivisa
```

This only works natively. Compose sets these variables in the container
environment, and those take precedence over `.env.local`. Staging allows
CORS from ports 3000, 3001 and 5174 only.

---

## 5. Everyday commands

```bash
docker compose logs -f api
```

```bash
docker compose exec db psql -U nivisa -d nivisa
```

```bash
docker compose exec api python -m scripts.seed_media
```

`seed_media` fills in stand-in photos for anything without an image. Add
`--drawings` for local SVGs or `--replace` to redo them.

```bash
docker compose down -v
```

That one deletes the volumes and gives you a completely fresh database.

Code quality:

```bash
docker compose exec api ruff check .
```

```bash
npm --prefix admin_dashboard run typecheck
```

```bash
npm --prefix web run lint
```

`pytest` and `pytest-asyncio` are in `requirements.txt`, but there's no test
suite in the repo yet.

---

## 6. Tools (`tools/`)

These run from a laptop against whichever database `apis/.env` names. Read
each script's docstring before running it, because several of them write to
staging.

| Script | Does |
|---|---|
| `apply_sql.py` | Applies `apis/sql/*.sql` (the PostgREST functions) in one transaction |
| `enable_rls.py` | Turns on row-level security for Supabase tables |
| `load_dump.py` | Loads a database dump |
| `import_client_assets.py` | Turns the client's `assets/` photo folders into categories on Bunny |
| `migrate_media_to_bunny.py` | Moves locally stored media to Bunny |
| `seed_demo_products.py` | Seeds demo products into a target database |
| `make_placeholder_model.py` / `make_placeholder_usdz.py` | Generate placeholder `.glb` / `.usdz` files for AR testing |
| `check_photo_banks.py` | Checks that the storefront's and API's stock-photo lists match |

---

## 7. Conventions worth knowing before you change things

- **Permissions** are `<group>.<action>` strings registered in
  `apis/app/core/permissions.py`. Guard every admin endpoint with
  `Depends(require("products.write"))`. The dashboard hides what a role can't
  use, but the API is what enforces it. You need both.
- **Price, stock and dimensions belong to a variant**, never to a product.
  Every product has at least one variant.
- **Dimensions are integer millimetres. Money is quantised at every step.**
- **Orders snapshot** product name, SKU, image and address at checkout.
- **Nothing that is referenced gets deleted**: archive, deactivate or
  suspend it instead.
- **AR models are published only if their real-world size matches the
  product's dimensions within 5%**, and the server enforces that.
- **Design tokens** live in `web/src/styles/globals.css`. Read
  [`DESIGN.md`](DESIGN.md) before touching colour, type or spacing.
- **Comments explain why**, often at length. Match that style.

---

## 8. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Launcher says a port is in use | Another project holds it. Free it, or change the *published* port in compose. If you move the storefront, also change `STOREFRONT_URL` and `NEXT_PUBLIC_SITE_URL`. |
| Storefront edits don't show up (Docker) | Make sure the web service runs with `--webpack` (the base file does). The override/demo files run a production build, so they need a restart. |
| Server-rendered pages are empty, but client-side data loads | `INTERNAL_API_BASE_URL` is wrong or missing: the Next.js server can't reach the API at the browser's address. |
| API calls fail in the browser but work with curl | CORS: add the page's exact origin, port included, to `CORS_ORIGINS`. |
| Dashboard shows staging data when you expected local | `admin_dashboard/.env.local` or `web/.env.local` points at staging, or the API is using `DATA_BACKEND=supabase` (see section 3). |
| AR button never appears on a phone over LAN | The page isn't hydrating under `next dev` over a LAN address. Use the production build from the override file. iPhones need HTTPS for the page too. |
| Catalogue suddenly empty on the Supabase path | A wrong PostgREST filter returns `[]` with status 200. Check the query before you check the data. |
| `nivisa reset` lost your products | That's what it does: it deletes the database volume. Use `down` to stop without losing data. |

---

## 9. Further reading

- [`README.md`](../README.md): features in depth: roles, AR, imagery, going to production
- [`docs/DESIGN.md`](DESIGN.md): visual and interaction design decisions
- [`docs/DEPLOY-CPANEL.md`](DEPLOY-CPANEL.md): deploying the API to cPanel
- [`docs/CPANEL-SUPABASE-HTTP.md`](CPANEL-SUPABASE-HTTP.md): why and how the API reaches Supabase over HTTPS
- [`admin_dashboard/README-deploy.md`](../admin_dashboard/README-deploy.md): deploying the dashboard
- `apis/.env.example`: every API setting, with comments
