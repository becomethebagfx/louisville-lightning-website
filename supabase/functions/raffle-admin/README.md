# raffle-admin

The privileged half of the glove raffle. This is the only thing in the
whole system that holds the Supabase service role key, and every decision
that changes who can win passes through it: verify a payment, reject an
entry, freeze the list, run the draw, publish the video.

Everything here mirrors three files. Read them before changing anything:

* `supabase/migrations/20260825_create_raffle.sql` is the schema, the row
  level security and the three privileged functions as first written.
* `supabase/migrations/20260825b_raffle_hardening.sql` is applied on top of
  it and is what the database actually runs today. It added
  `raffle_draws.seed_available_at`, the freeze-before-seed guard, the three
  draw guards and the draw status guard inside `raffle_verify_entry`. It
  replaced all three functions, so the bodies in the first migration are
  history, not behaviour.
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

## Timing, and the one deadline that cannot slip

The order matters more than any single time. Entries close, the list is
frozen, the seed number becomes public, the draw runs. If the list were
sealed after the winning number already existed, whoever holds the admin
key could have chosen which entries were inside it, and no fingerprint
published afterwards would prove otherwise. That is the whole reason the
hardening migration exists.

`raffle_draws.seed_available_at` records the instant the named seed drawing
publishes, and the database enforces the order around it:

* `raffle_freeze` refuses at or after `seed_available_at`.
* `raffle_execute_draw` refuses if `frozen_at >= seed_available_at`, refuses
  before `seed_available_at`, and refuses any seed source other than the one
  already published on the draw row.

For the glove draw:

| Moment | Column | Contract constant | Value |
|--------|--------|-------------------|-------|
| Entries close | `entries_close_at` | `ENTRIES_CLOSE_AT` | September 30 at 11:59pm ET |
| **Freeze deadline** | `seed_available_at` | `SEED_AVAILABLE_AT`, labelled `FREEZE_DEADLINE_LABEL` | **October 1 at 1:20pm ET** |
| Draw | `draw_at` | `DRAW_AT` | October 1 at 7:00pm ET |

Freeze the night entries close. The 1:20pm figure is a hard deadline, not a
plan: the freeze deadline and the draw are 5 hours 40 minutes apart, and
after the first of those the list can never be sealed at all. Nothing in
this function or in the console hard-codes any of it. Every deadline the
coach reads in an error message is rendered from the timestamp the database
is holding, so the three sources cannot drift apart silently, and if they
ever do the database wins, because the database is the one that refuses.

## Deploy

```bash
export SUPABASE_ACCESS_TOKEN=<the Supabase personal access token>
supabase functions deploy raffle-admin --project-ref ymdcudpeneraxiigjfpq \
  --no-verify-jwt
```

The CLI is at `~/.local/bin/supabase`. **`--no-verify-jwt` is not optional.**
It is how this function is deployed today, and the flag is not sticky: the
CLI defaults to JWT verification on, so a deploy that omits it silently
flips `verify_jwt` back to true and the Supabase gateway starts rejecting
the console at the door, before the function body and therefore before the
`x-raffle-key` check ever runs. The console detects that case and says so in
plain words, but the fix is always to redeploy with the flag.

Turning JWT verification off costs nothing here. The anon key it would
demand ships inside the public JavaScript bundle, so every visitor to the
raffle page already has it: requiring it would be requiring a public string.
The thing that is not public is `RAFFLE_ADMIN_KEY`, it never leaves the
function environment, and it is checked in constant time on every request.
The console does still send the anon key in `Authorization` and `apikey`
(see `postAdmin` in `src/pages/RaffleAdminPage.tsx`); the gateway ignores
both, and they are harmless.

To confirm the deployed posture:

```bash
curl -s https://api.supabase.com/v1/projects/ymdcudpeneraxiigjfpq/functions \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | grep verify_jwt
```

Expect `"verify_jwt": false`. A POST carrying no `Authorization` header at
all is the other half of the check: it should come back as this function's
own `{"ok":false,"error":"Not authorized."}` with a 401, not the gateway's
`{"code":401,"message":"Missing authorization header"}`.

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
`x-raffle-key` header. That header is the entire gate. Because the function
is deployed with JWT verification off, curl needs nothing else: no
`Authorization`, no `apikey`. Sending them anyway does no harm, which is why
the browser console does.

```bash
FN=https://ymdcudpeneraxiigjfpq.supabase.co/functions/v1/raffle-admin
KEY=<RAFFLE_ADMIN_KEY>
DRAW=glove-2026-10-01     # DRAW_ID in src/lib/raffleData.ts
```

### list

Every entry for the draw, ordered oldest first, with the private columns,
plus the draw row. This is the screen Coach works from.

```bash
curl -s -X POST "$FN" \
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
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"verify\",\"drawId\":\"$DRAW\",\"entryId\":\"<uuid>\",\"verifier\":\"aaron\"}"
```

`verifier` is optional and defaults to `admin`. Returns
`{ ok, entryId, ticketStart, ticketEnd, verifiedBy }`.

Refused with 409 if the entry is already verified, and refused with 409 if
the draw is no longer `open`. That second guard is now enforced in two
places, on purpose. `raffle_verify_entry` takes the draw row lock and
refuses a draw that is not open, and this function checks the same thing
before it ever calls the RPC so the coach gets the clearer message. Without
either, a payment confirmed after the freeze would be handed a ticket number
outside the published fingerprint that `raffle_execute_draw` could never
pick, since the draw divides by `frozen_ticket_count`. The entrant would see
themselves on the board with no chance of winning. Do not remove either one.

### reject

```bash
curl -s -X POST "$FN" \
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
and, without exception, before the seed drawing publishes.

```bash
curl -s -X POST "$FN" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"freeze\",\"drawId\":\"$DRAW\"}"
```

Returns `{ ok, drawId, listSha256, ticketCount }`. It refuses a draw with
zero verified entries, a draw that is not open, a list holding a display
name with a delimiter character in it, and, above all, any freeze attempted
at or after `seed_available_at`. That last refusal is terminal: once the
seed number is public there is no way to seal the list and still prove the
draw was fair, so the answer is not to retry, it is to stop and talk to
whoever runs the site before anything is announced. See the refusal table
below for the exact wording the coach gets.

### draw

```bash
curl -s -X POST "$FN" \
  -H "x-raffle-key: $KEY" -H 'Content-Type: application/json' \
  -d "{\"action\":\"draw\",\"drawId\":\"$DRAW\",\"seedValue\":\"481\"}"
```

`seedValue` is the public number read off the seed source, and it is
required. `seedSource` is optional: left out, the function uses the value
already published on the draw row, which is the point of publishing it
early, and which is also the only value the database will accept. The draw
refuses unless the list is frozen, refuses a list that was frozen after the
seed published, refuses to run before the seed publishes, and refuses a seed
source that is not the committed one. All four are 409. Returns
`{ ok, drawId, winningTicket, displayName, listSha256, seedSource, seedValue }`.

The winner is a pure function of the seed and the frozen ticket count, so
anyone can recompute it:
`1 + (first 12 hex chars of sha256(seedValue) as an integer, modulo ticketCount)`.

### video

```bash
curl -s -X POST "$FN" \
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
| 409 | The state says no. Every row in the refusal table below. |
| 500 | Something genuinely unexpected. Reserved for it: every `raise` in the three privileged functions is mapped below, so none of them arrives as a 500. The body is short and contentless on purpose, and the detail is in the function logs. |
| 503 | `RAFFLE_ADMIN_KEY` is unset or too short, or the runtime did not inject `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The body says only "not configured", so check the logs. The OPTIONS preflight is still answered, so the console shows this 503 instead of an opaque CORS error. |

## Refusals

Every `raise` in the three privileged functions is mapped to plain English
and an honest status code. The coach reads these on a phone, in a gym, with
people waiting, so a refusal that arrived as a bare 500 would tell him the
site was broken at the exact moment the database had in fact just stopped
him from destroying the fairness of the draw.

| Action | The database refused because | Code | What the coach sees |
|--------|------------------------------|------|---------------------|
| verify | the entry is already verified | 409 | already verified and already holds ticket numbers |
| verify | the draw is no longer open | 409 | the numbered list is already published, so no further tickets can be issued |
| verify | no entry with that id | 404 | no entry with that id |
| freeze | **the seed number is already public** | 409 | **the list can no longer be sealed at all, sealing it now would make the draw impossible to prove fair, do not draw, do not announce, contact whoever runs the site** |
| freeze | there are no verified entries | 409 | verify at least one paid entry first |
| freeze | the draw is not open | 409 | a list is sealed once and never resealed |
| freeze | a display name holds a delimiter character | 409 | that name has to be corrected in the database before the list can be sealed |
| freeze | no draw with that id | 404 | no draw with that id |
| draw | **the list was frozen after the seed published** | 409 | **this draw cannot be proved fair, do not announce a winner, contact whoever runs the site** |
| draw | the seed has not published yet | 409 | the exact instant it publishes, in ET, read off the draw row |
| draw | the seed source is not the committed one | 409 | the committed source, and to leave `seedSource` out so the published one is used |
| draw | the seed value was empty | 400 | a seed value is required |
| draw | the draw is not frozen | 409 | not frozen yet, already run, or no such draw, told apart by reading the draw row |

The two rows in bold are the ones this whole design exists to be able to
produce. Both mean the same thing: the commitment and the randomness got out
of order, no hash can fix it afterwards, and the only correct next step is a
conversation, not a retry.

Where a refusal quotes a value back (the draw status, the seed source, the
freeze deadline, the moment the list was sealed) it comes from a column this
function reads itself, never from the Postgres message, and every one of
those columns is already public on the raffle page. Timestamps are rendered
in Eastern time from the instant stored on the row, so no deadline is
written down anywhere in this function.

Errors never echo the admin key, the service role key, a private entrant
column, or a raw Postgres message. Postgres messages can carry row contents
with them, so they are logged and never returned.

## Logs

```bash
supabase functions logs raffle-admin --project-ref ymdcudpeneraxiigjfpq
```

Every failed database call logs as `[raffle-admin] <action> failed` with the
error code and message, including the ones that are then answered as a clean
409. The mapped message is what the caller sees; the raw one stays here.
Nothing logged contains a key.
