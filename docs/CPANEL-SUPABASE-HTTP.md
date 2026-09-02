# Running on cPanel with Supabase over HTTPS

The plan for keeping the API on the cPanel box and reaching Supabase through
port 443, because that box is allowed nothing else.

---

## What forced this

The hosting account permits outbound 443 and 80, and refuses everything else.
Verified from the account's own shell:

```
OPEN     api.github.com:443
OPEN     example.com:80
OPEN     aws-0-ap-northeast-2.pooler.supabase.com:443   <- same host, reachable
BLOCKED  aws-0-ap-northeast-2.pooler.supabase.com:5432
BLOCKED  aws-0-ap-northeast-2.pooler.supabase.com:6543
```

The same hostname answers on 443 and refuses 5432, so this is an outbound port
rule on the account, not DNS, routing, or Supabase. Postgres does not answer on
443 either - the port accepts TCP and then times out, so there is no shortcut
in changing the port.

That leaves PostgREST, which Supabase publishes at
`https://<ref>.supabase.co/rest/v1/` on 443.

---

## What this costs, honestly

The application talks to Postgres through SQLAlchemy. PostgREST is a different
thing, not a different address:

| | |
|---|---|
| Files using a database session | 24 |
| SQLAlchemy queries | 221 |
| ORM relationships | 24 |
| Endpoints | 132 |
| Places that commit a transaction | 24 |

Two of those numbers matter more than the rest.

**Relationships.** `product.images` and `variant.product` are loaded for you
today. Over PostgREST every one becomes an explicit embed or a second request,
at every call site that touches it.

**Transactions.** PostgREST has no multi-statement transaction: each call is
its own. Placing an order writes the order, its line items, an order event, a
coupon redemption, a stock adjustment per variant, and empties the cart - and
either all of that happens or none of it does. Over HTTP that is a sequence of
independent requests, and a failure halfway leaves stock decremented for an
order that does not exist.

So the transactional writes do not get "ported". They move into PL/pgSQL
functions inside Postgres, called as a single RPC. That is the part to get
right; the rest is volume.

---

## The keys

Two, and the difference matters.

| Key | Bypasses RLS | Where it may go |
|---|---|---|
| `publishable` / `anon` | No | Browsers, public code |
| `service_role` | **Yes** | Server `.env` only |

This database has RLS enabled on all 36 tables with **zero policies**, which
denies everything. That was deliberate: `tools/enable_rls.py` turned it on
after confirming that without it the anon key returned staff password hashes
and the entire customer table to anyone who asked.

Consequences:

* The publishable key reads **nothing**. Confirmed - every table returns
  `0 rows`, and inserts fail with *"new row violates row-level security
  policy"*. Note that reads return an empty list rather than an error, so a
  storefront built on it looks like an empty shop with nothing in the log.
* The API must use `service_role`, which bypasses RLS entirely. Keep RLS on and
  write no policies: nothing else should reach these tables.

`service_role` is equivalent to full database access. It belongs in `.env` on
the server, never in the repository, never in a browser bundle, and never
pasted into a chat window.

---

## Step by step

### 1. Get the service_role key

Supabase → **Project Settings → API Keys → `service_role`**. Copy it.

### 2. Put it in `apis/.env` on the cPanel box

Add these three lines. `.env` is git-ignored, so it stays out of the public
repository:

```
DATA_BACKEND=supabase
SUPABASE_URL=https://xwlhzqijyivptlfbsszn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<the service_role key>
```

Leave `DATABASE_URL` where it is. It is still correct, still unreachable from
this box, and still what you would use from a laptop to run migrations and the
seeder - both of which need a real Postgres connection and cannot go through
PostgREST.

### 3. Confirm the box can reach it

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://xwlhzqijyivptlfbsszn.supabase.co/rest/v1/categories?select=id&limit=1"
```

`200` means the whole path works: the firewall permits it and the key bypasses
RLS. `401` is a wrong key. `404` is a wrong project ref.

### 4. Then the port itself, in stages

Ordered so the shop comes back as early as possible rather than all at once at
the end:

1. **Catalogue reads** - categories, products, rooms, collections, search.
   This is most of the storefront and the part customers see. Once it is done
   the shop browses.
2. **Content and store profile** - the About and Contact bodies, the footer.
   Small, and already tolerant of failure since `loadOptionalPage`.
3. **Cart** - reads, plus single-row writes. No cross-table atomicity needed.
4. **Auth and customer** - OTP, profile, addresses, wishlist.
5. **Checkout and orders** - the PL/pgSQL functions. This is the careful part
   and it goes last, with the stock arithmetic tested before it carries a real
   order.
6. **The admin dashboard's API** - the largest surface and the least urgent,
   because staff can wait where customers cannot.

Each stage is behind `DATA_BACKEND`, so the Postgres path keeps working
locally and in Docker. That is what makes it possible to test a stage against
both backends and compare, rather than porting blind.

---

## What does not change

* **Images.** Bunny is on 443 and already works. All 139 photographs are
  uploaded and every URL is in `tools/client-assets-manifest.json`.
* **The storefront.** It talks to this API, not to the database. Nothing in
  `web/` changes.
* **The schema.** Same tables, same data. Only the transport changes.
* **Local development.** `docker compose up` still runs real Postgres on 5432
  with `DATA_BACKEND=postgres`, which stays the default.

---

## The things that will bite

Written down now so they are decisions rather than surprises.

* **Migrations and seeding cannot go through PostgREST.** `scripts/seed.py`,
  `tools/load_dump.py` and `tools/import_client_assets.py` need a real Postgres
  connection, so they must be run from a machine that has one. In practice
  that means a laptop, not the box.
* **`SELECT` returns `[]` where it used to raise.** A permission or filter
  mistake is silence, not an error. Every ported read needs a test that asserts
  rows come back, or an empty catalogue will look like working code.
* **Numeric types.** Prices cross as JSON. They must land in `Decimal`, not
  `float`, or money develops rounding errors that nobody notices until a
  total is a paisa out.
* **Latency.** Each query becomes an HTTPS round trip. Anything that loops a
  query per row will be slow in a way it was not before, and the fix is to
  fetch in one request rather than to add caching.
