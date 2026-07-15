# Daily AMASICON Registration Check Cron — Design

## Problem

The team dispatches convocation certificates to delegates in the Master-FMAS and
Master-MMAS Airtable tables, but only to those who actually registered and paid for
AMASICON 2026 (a separate registration system at `app.amasicon2026.com`). Today this
check is manual: someone exports a delegate report and cross-references it by hand.

We need an automated daily job that checks Master-FMAS/Master-MMAS records against the
live AMASICON registration system and flags matches, so the dispatch team can rely on
the "Registered for AMASICON" checkbox instead of a manual export.

## Background / prior manual pass

A one-off manual cross-reference was already done using a `delegate_report.xlsx` export
(596 paid delegates) against both tables, matching by email:

- **Master-FMAS** (`tbl9CuIgSFdoNVk9x`): added checkbox field **"Registered for AMASICON"**
  (`fldNIR3Rp7D7rsyw3`), checked for 138/1456 records.
- **Master-MMAS** (`tblBXE3iZGd9zHbKo`): added checkbox field **"Registered for AMASICON"**
  (`fldhd2XY96K4Ca6cS`), checked for 10/76 records.

The remaining unmatched records are expected — they're general AMASICON event delegates
or skill-course-only attendees, not necessarily people who registered for the main
AMASICON conference.

## The API

Verified directly against production:

- **Base URL:** `https://app.amasicon2026.com`
- **Endpoint:** `GET/POST /api/delegate-by-email`
- **Auth:** none — fully public, no API key or session required
- **Rate limit:** 60 requests/minute (confirmed via `X-RateLimit-*` response headers)
- **Request:** `{"email": "someone@example.com"}` (body for POST, or `?email=` for GET)
- **Response:**
  ```json
  {"status": true, "user_exists": true, "is_payment_completed": true}
  ```
  `user_exists` = email is a registered delegate. `is_payment_completed` = payment
  done. Both are `false` if the email isn't found at all.

Note: since this endpoint requires no auth and allows email-existence/payment-status
lookups by anyone who knows an email, that's a minor enumeration risk on
AMASICON's side — worth flagging to whoever runs that system, but out of scope here.

## Architecture

New pieces in this repo (`convocation-2026`, Next.js on Vercel):

- **`src/lib/amasiconRegistration.ts`** — client for the delegate-by-email API.
  Exposes `checkDelegateByEmail(email): Promise<{ userExists: boolean; isPaymentCompleted: boolean } | null>`
  (`null` on request failure). Paces requests (~1.1s apart) to stay under 60/min.
- **`src/app/api/cron/check-amasicon-registration/route.ts`** — new Vercel Cron
  endpoint, following the existing pattern in
  `src/app/api/cron/check-deliveries/route.ts` (optional `CRON_SECRET` bearer auth,
  `GET` handler, JSON summary response). Supports an optional `?limit=` query param
  to override batch size for manual testing.
- **Two new Airtable fields**, one per table: **"AMASICON Last Checked"** (dateTime).
  Added the same way the checkbox fields were added (Airtable field-creation call).
  This is what lets a bounded daily batch make steady progress across the whole
  unconfirmed pool instead of only ever looking at the same front slice.
- **`vercel.json`** (new file — doesn't exist yet) — registers the cron schedule.
- **New env var:** `AMASICON_API_BASE_URL=https://app.amasicon2026.com` (no auth
  needed) in `.env.local` and Vercel project env.

## Data flow / algorithm

Each run, for **each** of Master-FMAS and Master-MMAS independently:

1. Query Airtable for records where `Registered for AMASICON` ≠ true, **sorted by
   `AMASICON Last Checked` ascending** — blank (never checked) sorts first, so new
   registrations always jump the queue.
2. Take a bounded batch (~250 records/table/run — sized to finish comfortably inside
   the Vercel function timeout while pacing calls under 60/min; overridable via
   `?limit=` for manual test runs).
3. For each record:
   - No email on the record → skip, but still stamp `AMASICON Last Checked = now`
     (cycles it to the back of the queue rather than wasting batch capacity on it
     every run).
   - Call `checkDelegateByEmail(email)`.
     - Request failed → skip, **do not** stamp `AMASICON Last Checked` (retried next
       run, since we never got a real answer).
     - Success, `userExists && isPaymentCompleted` → set `Registered for AMASICON =
       true`, stamp `AMASICON Last Checked = now`.
     - Success, not matched → stamp `AMASICON Last Checked = now` only.
4. Return a JSON summary: `{ checked, newlyMatched, errors }` per table, matching the
   response shape convention of `check-deliveries`.

Because unmatched records still get their timestamp updated, the "last checked" cursor
rotates through the whole unconfirmed pool over multiple days rather than getting stuck,
while brand-new records always get checked first.

## Error handling

- Per-delegate API failure: logged, skipped, **not** stamped — retried automatically
  next run.
- If the API signals we're being rate-limited, the batch stops early and returns
  whatever it completed — no crash, progress made so far is saved (via the stamps
  already written).
- Airtable read failure (bad credentials, network): the run aborts early and returns
  an error in the JSON response, same as `check-deliveries` does today.
- No notifications beyond the JSON response and Airtable state — per user decision,
  the checkbox update itself is sufficient; the team already works off the Airtable
  view.

## Testing

This repo has no test framework configured (`check-deliveries` also has none — no
tests exist to match conventions against). Verification is manual:

1. Deploy the route.
2. Invoke it directly with `?limit=3` (small batch) and confirm known cases behave
   correctly — e.g. `drsujaypal@gmail.com` (known paid delegate) should get checked
   and matched; an unregistered email should get checked and left unmatched.
3. Once confirmed, let the cron schedule take over.

## Rollout

- `vercel.json` cron schedule: **02:00 IST (20:30 UTC) daily** — `"30 20 * * *"`.
  Adjustable later if a different time is preferred.
- First run(s) will process the largest backlog (~1384 records currently
  unconfirmed across both tables: 1318 in FMAS, 66 in MMAS at spec time), so expect
  the initial sweep to take several days of daily runs before the unconfirmed pool
  stabilizes to just the genuinely-never-registering delegates plus new arrivals.

## Out of scope (for this iteration)

- Notifications (email/Slack) on new matches — can be added later if the team wants
  it; not built now (YAGNI).
- Automated tests — no framework exists in this repo; not introducing one for this
  feature alone.
- Un-checking a previously-matched record if AMASICON payment status ever reverses —
  not a real-world scenario worth handling.
