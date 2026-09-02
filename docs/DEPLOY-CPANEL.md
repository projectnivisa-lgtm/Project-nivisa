# Deploying the API to cPanel

For the internal deployment: the API on the company cPanel, Postgres on
Supabase, uploads on Bunny, and SMS and payments still on their stand-ins
because the client has not supplied accounts for either.

Nothing was removed to make this work. `local` and `s3` storage both still
exist, the mock payment gateway still exists, the console SMS provider still
exists, and the production guards that refuse all three are still armed —
this deployment runs as `staging`, which is what that environment is for.

---

## What runs where

| Piece | Where | Notes |
|---|---|---|
| API | cPanel, Setup Python App | Passenger, via `passenger_wsgi.py` |
| Database | Supabase | Pooler connection, `?ssl=require` |
| Uploads | Bunny Edge Storage + pull zone | `STORAGE_PROVIDER=bunny` |
| SMS | Console stand-in | OTP is written to the log; testers read it there |
| Payments | Mock checkout | No gateway, no money |

---

## 1. Supabase

> **Already done for the internal deployment.** The project is live on
> PostgreSQL 17.6 and the whole local catalogue has been migrated into it —
> 36 tables, every row count verified against the source. See
> [Migrating the data](#migrating-the-data) below for how, and how to redo it.

1. Create the project. Pick **Mumbai (ap-south-1)** — the customers, the
   prices and the cPanel box are all in India.
2. Take the **connection pooler** string, not the direct one. The direct host
   is IPv6-only and shared cPanel boxes generally have IPv4 only. This is the
   single most common "it works locally" failure, and it was confirmed on this
   project: `db.<project-ref>.supabase.co` has an AAAA record and no A
   record, and the Docker containers here cannot reach it at all.

   Check the cPanel box before assuming either way:

   ```bash
   python -c "import socket; print(socket.getaddrinfo('db.YOURREF.supabase.co', 5432))"
   ```

   If that shows only `AF_INET6` entries and the box has no IPv6, use the
   pooler string from **Supabase → Connect → Session pooler**. Copy it from the
   dashboard rather than constructing it: the regional hostname is not
   guessable, and the pooler rejects a tenant it does not recognise.
3. Convert it to the async driver and add TLS:

```
DATABASE_URL=postgresql+asyncpg://postgres.PROJECT:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?ssl=require
```

Three details worth knowing rather than discovering:

- `postgresql+asyncpg://`, not `postgresql://` — the app is async throughout.
- `?ssl=require`, not `?sslmode=require` — asyncpg does not read libpq's
  spelling and will ignore it silently.
- The app already sets `statement_cache_size=0` on asyncpg, which is what
  makes it safe behind a transaction pooler. Nothing to configure.

---

## 2. Bunny

1. **Storage → Add Storage Zone.** Choose the region nearest you; Singapore
   is the closest to India that Bunny offers for storage.
2. **Pull Zone → Add Pull Zone**, origin type *Storage Zone*, pointed at the
   zone you just made. This is what the public reads from.
3. From the storage zone's **FTP & API Access** page, copy the **password**.
   That is the value for `BUNNY_ACCESS_KEY` — the account-level API key is a
   different thing and returns 401 on every upload.

```
STORAGE_PROVIDER=bunny
BUNNY_STORAGE_ZONE=nivisa-media
BUNNY_ACCESS_KEY=<the storage zone password>
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_PUBLIC_BASE_URL=https://nivisa-media.b-cdn.net
```

`BUNNY_PUBLIC_BASE_URL` is the **pull zone**. Every stored URL is built from
it, so getting it wrong means every image on the site is served uncached from
origin — it will look like it works.

### One Edge Rule is required, for iOS AR

Bunny ignores the Content-Type an upload is sent with and serves by its own
extension table, which has no entry for `.usdz`. Tested on this zone: a `.usdz`
uploaded as `model/vnd.usdz+zip` comes back as `application/octet-stream`, and
so does a `.bin` sent with the same header.

iOS AR Quick Look refuses a USDZ that is not `model/vnd.usdz+zip`. The customer
taps **View in your room**, nothing happens, and nothing is logged anywhere.
`.glb` is unaffected — Bunny's table knows that one.

Fix it once, on the pull zone:

**Pull Zone → project-nivisa → Edge Rules → Add Rule**

| Field | Value |
|---|---|
| Action | Set Response Header |
| Header name | `Content-Type` |
| Header value | `model/vnd.usdz+zip` |
| Condition | Request URL — Match Any — `*.usdz` |

Then purge the pull zone cache, since the wrong type is already cached at the
edge. Verify with:

```bash
curl -sI https://project-nivisa.b-cdn.net/ar/2026/08/51fb1a232b7c-sofa.usdz | grep -i content-type
# want: model/vnd.usdz+zip
```

---

## 3. The cPanel Python app

**Setup Python App → Create Application**

| Field | Value |
|---|---|
| Python version | 3.11 or newer |
| Application root | `nivisa-api` (wherever you upload `apis/`) |
| Application URL | the subdomain, e.g. `api.yourdomain.com` |
| Application startup file | `passenger_wsgi.py` |
| Application Entry point | `application` |

The startup file and entry point are not arbitrary — Passenger imports that
file and looks for a callable with that name. `passenger_wsgi.py` ships in
`apis/` and needs no editing.

Then, in the cPanel **terminal** (or SSH), activate the virtualenv cPanel
printed when it created the app and install:

```bash
source /home/USER/virtualenv/nivisa-api/3.11/bin/activate
cd /home/USER/nivisa-api
pip install -r requirements.txt
```

`boto3` and `a2wsgi` both install here. `a2wsgi` is the WSGI bridge Passenger
needs; `boto3` is only imported if you ever switch to `s3`.

---

## 4. Environment variables

Set these in the Python app's **Environment variables** panel, or in a `.env`
file in the application root — `passenger_wsgi.py` changes into that directory
at startup precisely so the `.env` is found.

```ini
APP_ENV=staging
SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(48))">

DATABASE_URL=postgresql+asyncpg://...pooler.supabase.com:5432/postgres?ssl=require
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=5

STORAGE_PROVIDER=bunny
BUNNY_STORAGE_ZONE=nivisa-media
BUNNY_ACCESS_KEY=...
BUNNY_STORAGE_HOST=sg.storage.bunnycdn.com
BUNNY_PUBLIC_BASE_URL=https://nivisa-media.b-cdn.net

PUBLIC_API_URL=https://api.yourdomain.com
STOREFRONT_URL=https://staging.yourdomain.com
CORS_ORIGINS=https://staging.yourdomain.com,https://admin.yourdomain.com

PAYMENT_PROVIDER=mock
SMS_PROVIDER=console
EMAIL_PROVIDER=console
```

### Why `APP_ENV=staging` and not `production`

Because SMS and payments are still stand-ins, and `production` refuses to
start while either is. That refusal is correct and stays: a shop taking real
card details through a mock gateway, or issuing tokens signed with a shipped
secret, should not boot.

`staging` gives you the real database and real storage with the stand-ins
still permitted. One consequence needs a decision from you.

### Signing in as a customer, without SMS

The fixed OTP `123456` requires console SMS **and** `APP_ENV=local` together —
by design, so that a staging box with SMS misconfigured cannot be signed into
with a guessable code. On `staging` you get a **random** code that goes to the
log and nowhere else. `dev_code` in the API response is `null`.

So sign-in works, but a tester needs the log:

```bash
# cPanel terminal, in the application root
grep "OTP for" ~/logs/*.log | tail -5
```

The line reads `[SMS:console] OTP for 9900000001 is 481923`. It is also
visible in the app's stderr log in the cPanel Python App UI.

If reading a log for every sign-in is too much friction for internal testing,
the alternative is `APP_ENV=local` on that box, which restores the fixed
`123456`. Be clear about the trade: **anyone who finds the URL can then sign
in as any phone number.** Acceptable behind a company-only domain or an IP
allow-list; not acceptable on anything publicly reachable. `staging` plus the
log is the safer default, and it is what the variables above are set to.

Demo seed data is also still permitted under `staging`. Use `--no-demo`
anyway (below).

**Set `APP_ENV=production` the day the client provides an SMS account and
gateway credentials**, and the guards will tell you what is still missing.

### Pool sizes

`DB_POOL_SIZE=3` / `DB_MAX_OVERFLOW=5` rather than the defaults of 10 and 20.
Passenger runs several worker processes and each keeps its own pool, so the
defaults multiply into a connection count a pooled Supabase plan will refuse.

---

## Migrating the data

The local Docker catalogue was moved into Supabase with two commands. Repeat
them to re-sync a fresh environment.

```bash
# 1. Dump: plain SQL, INSERTs rather than COPY, no ownership or ACLs
docker compose exec -T db pg_dump -U nivisa -d nivisa     --schema=public --no-owner --no-acl --inserts --quote-all-identifiers     > dump.sql

# 2. Row counts from the source, so the load can verify itself
docker compose exec -T db psql -U nivisa -d nivisa -t -A -F',' -c "
  select table_name, (xpath('/row/c/text()', query_to_xml(
    format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE' order by table_name;" > counts.csv

# 3. Load and verify
python tools/load_dump.py dump.sql "postgresql://postgres:PW@db.REF.supabase.co:5432/postgres"     --verify counts.csv
```

`tools/load_dump.py` exists because psql may not be installed on the machine
that can reach the target — it loads a plain dump over asyncpg instead, in one
transaction, and refuses to run against a schema that already has tables.

### The files are a separate migration

Switching `STORAGE_PROVIDER` only changes where **new** uploads go. Rows
written while storage was `local` hold `/media/...` URLs, and nothing serves
those once the provider changes. There are **13 such files** in this database:
ten generated dimension drawings, the sofa's `.glb` and `.usdz`, and one AR
poster.

```bash
docker compose cp api:/data/media ./media
python tools/migrate_media_to_bunny.py --media-root ./media --dry-run
python tools/migrate_media_to_bunny.py --media-root ./media
```

It uploads each file, and only then repoints that row — interrupt it and every
row is either fully moved or untouched. Run it before flipping
`STORAGE_PROVIDER=bunny`, or those images disappear from the site silently.

---

## 5. Create the schema

Once, from the cPanel terminal with the virtualenv active:

```bash
cd /home/USER/nivisa-api
python -m scripts.seed --no-demo
```

Skip this if you migrated an existing database — the dump already carried the
schema, the staff accounts and the catalogue.

This creates every table and the one super-admin account from
`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. `--no-demo` keeps sample
furniture out.

> **This is the project's only schema management.** Tables come from
> `Base.metadata.create_all`, which creates what is missing and never alters
> what exists. The first model change after this deploy will not reach the
> database. Alembic before the second deploy, not after.

Then **change the super admin password** from the dashboard. The seeded one is
in a file in the repository.

---

## 6. Verify

```bash
curl https://api.yourdomain.com/api/v1/health
```

```json
{"status": "ok", "service": "Nivisa Commerce API", "environment": "staging"}
```

Then, in order:

1. `GET /api/v1/catalog/products` returns JSON, not an error — the database is
   reachable.
2. Sign in to the dashboard and upload a product photo. The stored URL should
   start with your **pull zone** hostname, and open in a browser.
3. Request an OTP on the storefront, then read the code out of the log (see
   above) and complete the sign-in.
4. `https://api.yourdomain.com/docs` renders the API reference.

---

## When it breaks

Passenger reports an import failure as a bare 500. The real message is in the
app's stderr log in the cPanel UI, or `~/logs`.

| Symptom | Cause |
|---|---|
| `ModuleNotFoundError: No module named 'app'` | Application root is not the folder containing `main.py` |
| `ModuleNotFoundError: No module named 'a2wsgi'` | `pip install -r requirements.txt` ran outside the app's virtualenv |
| `Refusing to start in production` | `APP_ENV=production` with stand-in providers — use `staging` |
| Every setting is at its Docker default | The `.env` is not in the application root |
| `connection refused` / IPv6 errors on connect | Using Supabase's direct host instead of the pooler |
| `401` on every upload | Account API key used instead of the storage zone password, or the wrong regional `BUNNY_STORAGE_HOST` |
| Restart does nothing | Touch `tmp/restart.txt` in the app root, or hit Restart in the cPanel UI |

### `/api/v1/health` is fine but every other endpoint is a 500

Health touches nothing. Everything else opens a database session, so this
split says the app booted and imported cleanly and the database is what it
cannot reach — not the code, and not `.env` being absent.

Before changing anything, establish which end is at fault. Run the same
`DATABASE_URL` from a machine that is known to work:

```bash
python -c "
import asyncio, asyncpg
async def m():
    c = await asyncpg.connect(host='HOST', port=5432, user='postgres.REF',
                              password='PASSWORD', database='postgres',
                              ssl='require', statement_cache_size=0)
    print(await c.fetchval('select count(*) from products')); await c.close()
asyncio.run(m())"
```

If that returns a row count, the Supabase project is up and the credentials
are current, and the box is the problem: outbound 5432 blocked by the host's
firewall, a stale `.env` uploaded with an older password or the direct
IPv6-only host, or stale code. `python preflight.py` in the application root,
with the virtualenv active, checks all of those and names the one that is
wrong. Then read the traceback:

```bash
grep -A30 "Unhandled error" ~/logs/*.log | tail -40
```

Every 500 carries an `error_id` in its body and logs the traceback under the
same id, so grep for the id the front end showed rather than reading the
whole log.

### The browser says "blocked by CORS policy" on a request that curl serves

Look at the status code before touching `CORS_ORIGINS`. Starlette runs the
unhandled-exception handler in `ServerErrorMiddleware`, which is outside every
middleware the app adds — `CORSMiddleware` included — so a 500 used to go back
with no `Access-Control-Allow-Origin` and the browser reported the missing
header instead of the error that caused it. The reference id never reached the
console, and the CORS configuration, which was never wrong, got the blame.

`ServerErrorsAreCorsErrors` in `main.py` now catches inside the stack, so a
500 arrives as a readable 500. A deployment predating that change still shows
the old symptom — redeploy before diagnosing it as CORS.

If the header really is missing on a **2xx**, then it is CORS: the calling
origin is not in `CORS_ORIGINS`. The port counts, so `http://localhost:3000`
does not cover `:3001`.

---

## What this arrangement is and is not

Passenger serves each request by running the ASGI app on an event loop in a
worker thread. It is correct, it was tested against this codebase, and repeat
database-backed requests reuse the connection pool as they should — the first
costs about 100ms, the rest about 13ms.

It is still a thread per in-flight request rather than one loop serving
thousands. Right for an internal deployment and a staff dashboard; wrong for a
launch with traffic behind it. The move off it is not a rewrite — a host that
runs `uvicorn main:app` directly serves the same application object, and
`passenger_wsgi.py` simply stops being imported.
