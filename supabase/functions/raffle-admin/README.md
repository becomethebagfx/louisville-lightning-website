# raffle-admin

The privileged half of the glove raffle. This is the only thing in the
whole system that holds the Supabase service role key, and every decision
that changes who can win passes through it: verify a payment, reject an
entry, freeze the list, run the draw, publish the video.

Everything here mirrors two files. Read them before changing anything:

* `supabase/migrations/20260825_create_raffle.sql` is the schema, the row
  level security and the three privileged functions.
* `src/lib/raffleData.ts` is the contract the site reads from. `DRAW_ID`
  lives there, and the admin console sends it on every request.

## The security model, and why it is shaped this way

The public site is a static single page app, so its anon key ships inside
the JavaScript bundle. "Anon" therefore means "anyone on the internet with
devtools open", and the migration treats it that way: anon may insert a
pending entry and read a whitelist of columns on verified rows, and that is
all. `raffle_verify_entry`, `raffle_freeze` and `raffle_execute_draw` have
execute revoked from anon and granted only to `service_role`, which exists
nowhere in the browser. That makes this function the single door to all
three, and the `x-raffle-key` header the single lock on that door. The key
is compared in constant time against the `RAFFLE_ADMIN_KEY` secret, which
lives only in the Supabase function environment. If that secret is unset,
or shorter than 16 characters, the function refuses every request with 503
rather than falling back to anything. Do not add a client side PIN and call
it a gate, do not add a query parameter fallback for the key, do not widen
the anon grants in the migration to save a round trip through here, and do
not render `full_name`, `phone`, `email`, `venmo_handle` or `note` on any
public surface just because the `list` action returns them. The `list`
action is the one place private columns leave the database, it is
deliberate, and it is what Coach checks the Venmo ledger against.

## Deploy

```bash
export SUPABASE_ACCESS_TOKEN=<the Supabase personal access token>
supabase functions deploy raffle-admin --project-ref ymdcudpeneraxiigjfpq
```

The CLI is at `~/.local/bin/supabase`. Leave JWT verification on, which is
the default. It costs nothing and it means a caller needs the project anon
key as well as the admin key.

Deployed URL:

```
https://ymdcudpeneraxiigjfpq.supabase.co/functions/v1/raffle-admin
```

## Secrets

Required:

```bash
supabase secrets set RAFFLE_ADMIN_KEY=$(openssl rand -base64 32) \
  --project-ref ymdcudpeneraxiigjfpq
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the Supabase
edge runtime. Do not set them by hand and never paste a service role key
into a file in this repository.

Optional, both safe to leave unset:

| Secret | Effect when set | Effect when unset |
|--------|-----------------|-------------------|
| `RAFFLE_ALLOWED_ORIGINS` | Comma separated list of browser origins allowed to read a response. Recommended value: `https://loulightning.com,https://www.loulightning.com,http://localhost:5173` | The request origin is echoed back. Safe, because the admin key is not a cookie: no browser ever attaches it automatically, so a cross site page cannot forge an authenticated call, and anyone with a shell can bypass CORS entirely anyway. CORS is a courtesy here, the key is the lock. |
| `RAFFLE_DRAW_ID` | Used when a request omits `drawId` | `drawId` becomes required on every request |

To rotate the admin key, run `supabase secrets set RAFFLE_ADMIN_KEY=...`
again and update the value recorded in `~/.claude/INFRA.md` with today's
date. Secrets take effect on the next cold start.

## Calling it

Every call is `POST`, with a JSON object body carrying `action`, and the
`x-raffle-key` header. Because JWT verification is on, curl also needs the
project anon key in `Authorization` and `apikey`. The browser console does
not: `supabase.functions.invoke()` attaches those two itself.

```bash
FN=https://ymdcudpeneraxiigjfpq.supabase.co/functions/v1/raffle-admin
ANON=<VITE_SUPABASE_ANON_KEY from .env>
KEY=<RAFFLE_ADMIN_KEY>
DRAW=glove-2026-10-01     # DRAW_ID in src/lib/raffleData.ts
```

### list

Every entry for the draw, ordered oldest first, with the private columns,
plus the draw row. This is the screen Coach works from.

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"list\",\"drawId\":\"$DRAW\"}"
```

```jsonc
{ "ok": true, "drawId": "...", "draw": { /* raffle_draws row or null */ },
  "entries": [ /* full raffle_entries rows, created_at ascending */ ] }
```

### verify

Confirms the Venmo payment landed and mints the next contiguous ticket
block. Ticket numbers are assigned in the order payments are confirmed and
are never reused.

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"verify\",\"drawId\":\"$DRAW\",\"entryId\":\"<uuid>\",\"verifier\":\"aaron\"}"
```

`verifier` is optional and defaults to `admin`. Returns
`{ ok, entryId, ticketStart, ticketEnd, verifiedBy }`.

Refused with 409 if the entry is already verified, and refused with 409 if
the draw is no longer `open`. That second guard lives here and only here.
`raffle_verify_entry` in the migration does not look at draw status, so
without this check a payment confirmed after the freeze would be handed a
ticket number that is outside the published fingerprint and that
`raffle_execute_draw` could never pick, since the draw divides by
`frozen_ticket_count`. The entrant would see themselves on the board with
no chance of winning. Do not remove it.

### reject

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"reject\",\"drawId\":\"$DRAW\",\"entryId\":\"<uuid>\",\"reason\":\"no matching Venmo payment\"}"
```

`reason` is required, 280 characters maximum, and the entrant reads it back
through the `raffle_receipt` lookup, so write it for them and not for you.

A verified entry cannot be rejected. It already has ticket numbers on the
public board, and pulling it out would renumber every ticket issued after
it, which breaks the promise that numbers are assigned in payment order and
never reshuffled. That returns 409. Fix a mistaken verification in the
database with a deliberate migration, not through this endpoint.

### freeze

Publishes the fingerprint of the verified list. Run it after entries close
and before the drawing.

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"freeze\",\"drawId\":\"$DRAW\"}"
```

Returns `{ ok, drawId, listSha256, ticketCount }`. Refuses a draw with zero
verified entries, and refuses a draw that is not open, both with 409.

### draw

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"draw\",\"drawId\":\"$DRAW\",\"seedValue\":\"481\"}"
```

`seedValue` is the public number read off the seed source, and it is
required. `seedSource` is optional: left out, the function uses the value
already published on the draw row, which is the point of publishing it
early. Returns `{ ok, drawId, winningTicket, displayName, listSha256,
seedSource, seedValue }`. The draw must be frozen first, otherwise 409.

The winner is a pure function of the seed and the frozen ticket count, so
anyone can recompute it:
`1 + (first 12 hex chars of sha256(seedValue) as an integer, modulo ticketCount)`.

### video

```bash
curl -s -X POST "$FN" \
  -H "Authorization: Bearer $ANON" -H "apikey: $ANON" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"video\",\"drawId\":\"$DRAW\",\"videoUrl\":\"https://...\"}"
```

Must be an `http` or `https` URL. Returns `{ ok, drawId, videoUrl }`.

## Status codes

| Code | Meaning |
|------|---------|
| 200 | Done. Body carries `ok: true`. |
| 400 | Bad input: no action, unknown action, missing `drawId`, malformed body, `entryId` that is not a UUID, empty `seedValue`, missing or oversized reject reason, `videoUrl` that is not http or https. |
| 401 | Wrong or missing `x-raffle-key`. The body is identical for both, and the comparison is constant time, so neither the response nor a stopwatch says which it was. |
| 404 | No entry with that id in that draw, or no draw with that id. |
| 405 | Anything other than POST or the OPTIONS preflight. |
| 409 | The state says no: already verified, verified entries cannot be rejected, the draw is not open, nothing to freeze, or not frozen yet. |
| 500 | Something broke. The body is short and contentless on purpose. The detail is in the function logs. |
| 503 | `RAFFLE_ADMIN_KEY` is unset or too short, or the runtime did not inject `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The body says only "not configured", so check the logs. The OPTIONS preflight is still answered, so the console shows this 503 instead of an opaque CORS error. |

Errors never echo the admin key, the service role key, or a raw Postgres
message. Postgres messages can carry row contents with them, so they are
logged and never returned.

## Logs

```bash
supabase functions logs raffle-admin --project-ref ymdcudpeneraxiigjfpq
```

Every failed database call logs as `[raffle-admin] <action> failed` with the
error code and message. Nothing logged contains a key.
