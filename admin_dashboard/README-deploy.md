# Deploying the dashboard

## Set one environment variable

In Vercel: **Project → Settings → Environment Variables**, for every
environment you build:

```
VITE_API_URL = https://staging.thirdeyegfx.in/nivisa
```

The API's root, no trailing slash and no `/api/v1` — `src/lib/api.ts` appends
that. Then redeploy; a Vite build inlines the value, so a variable added
without a redeploy changes nothing.

## Why not the proxy

`vercel.json` used to rewrite `/api` to the API, which would have kept every
request same-origin and left CORS out of it entirely. That is the better
arrangement and it is what the Vite dev server still does locally.

It cannot be used against this deployment. The API is behind the host's bot
protection, which serves a JavaScript challenge — *"Please wait while your
request is being verified..."* — to requests from datacenter addresses. A
Vercel rewrite is a server-to-server call from Vercel's edge, so it collects
the challenge page and the dashboard receives HTML with a `200` where it
expected JSON. That is the confusing part: nothing errors, the login request
simply succeeds with the wrong body.

Calling the API directly from the browser avoids it, because the request then
carries the user's own address and a real browser fingerprint. The cost is
that the calls are cross-origin, so the dashboard's URL has to be listed in
the API's `CORS_ORIGINS` — and it has to be updated there if the URL changes.

If the host will exempt `/nivisa/api/` from bot protection, restore the
rewrite and drop the CORS entry: same-origin is the arrangement this codebase
was written for.
