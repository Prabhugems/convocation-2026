# Certificate Dispatch — Duplicate-Send Safeguards

**Date:** 2026-08-13
**Status:** Approved
**Scope:** `src/app/stations/[stationId]/page.tsx` (address-label + final-dispatch stations), `src/app/api/scan/route.ts`, `src/lib/tito.ts`, `src/lib/airtable.ts`, `src/app/admin/page.tsx`

## Problem

Certificate collection happens in person at the ceremony (`certificate-collection` station). Anyone who didn't collect in person gets their certificate mailed roughly 90 days later, in a separate dispatch batch that runs through the `address-label` and `final-dispatch` stations. `finalDispatched`/`certificateCollected`/etc. are already tracked per graduate (one Tito check-in list per station, aggregated into `Graduate.status`), but the Address Label station's print action (`handlePrintAddressLabel4x6`) fires with no check against that status at all. Two concrete mistakes can happen as a result:

1. A graduate who already collected their certificate in person gets a shipping label printed and a duplicate certificate mailed to them.
2. A graduate who was already dispatched (a DTDC/India Post tracking number already assigned and printed on a label) gets a second label printed reusing the same tracking number — DTDC/India Post treat that number as already consumed by the first package.

Mistake #2 has one legitimate exception: a package that bounces back (bad address, refused, etc.) legitimately needs to be resent — but with a **new** tracking number, never the original one.

## Behavior

### 1. Address Label station — warn on already-collected

When a graduate is scanned/searched at the `address-label` station and `status.certificateCollected` is `true`:

- Show a warning banner above the Print button: "Dr. {name} already collected their certificate in person on {collection date}." (date from the `certificate-collection` entry in `graduate.scans`).
- The Print button remains enabled but requires one explicit confirmation step (e.g. a confirm dialog: "Print a mailing label anyway?") before `handlePrintAddressLabel4x6` runs.
- This is a soft warning, not a block — staff can override.

### 2. Address Label + Final Dispatch stations — hard block on already-dispatched

When a graduate's `status.finalDispatched` is `true` (and they have not been unlocked by the "Mark as Returned" action in §3):

- At `address-label`: the Print button is disabled. Message shown: "Already dispatched via {dispatchMethod} on {date} — Tracking {trackingNumber}. Cannot print a duplicate label."
- At `final-dispatch`: the tracking-number entry form is disabled/hidden, replaced by the same message.
- No override exists at the station level. `POST /api/scan` also rejects a `final-dispatch` or `address-label` check-in for a ticket whose status already shows `finalDispatched: true`, returning a 409 with the same message — this is defense in depth so the block can't be bypassed by a stale page/client, independent of the client-side disabling above.

### 3. Admin panel — "Mark as Returned, Allow Resend"

A new action on the graduate detail view in `src/app/admin/page.tsx`, visible only when `status.finalDispatched` is `true`. Shown alongside the existing tracking number/courier display (`admin/page.tsx:1759-1762`).

Clicking it opens a confirm dialog (with an optional free-text note) and, on confirm:

1. **Locate and delete the Tito check-ins.** For both the `final-dispatch` and `address-label` check-in lists, find this ticket's non-deleted check-in (same full-list-pagination approach already used by `getTicketCheckins`/`getAllCheckinsMap`, since Tito's API ignores a `ticket_id` filter) and call `DELETE https://checkin.tito.io/checkin_lists/:slug/checkins/:uuid` on each. This is what actually unlocks the graduate — Tito refuses a second check-in on a list that already has one for that ticket, regardless of any app-level flag.
2. **Archive the old attempt.** Before clearing anything, append a line to a new Airtable long-text field, **"Return History"**, on that graduate's record: `{old trackingNumber} via {dispatchMethod}, dispatched {date}, returned {today}{, note if provided}`. Each return appends a new line rather than overwriting, so multiple returns for the same person stay in the trail.
3. **Clear the tracking number.** Blank the Airtable "Tracking Number" field for that record, so the Final Dispatch form has nothing to prefill — staff must type in a genuinely new number next time, never the archived one.
4. **Invalidate caches.** Call `clearGraduatesCache()` (`src/lib/tito.ts:698`) so the unlocked status is reflected immediately, not after the next cache expiry.

After this, the graduate reads as `finalDispatched: false` / `addressLabeled: false` again and can be scanned through Address Label and Final Dispatch as a fresh cycle, entering a new tracking number.

## Data model changes

- **New Airtable field:** `Return History` (long text, append-only from the app) on the same table `parseAirtableRecord` reads from (`src/lib/airtable.ts`). Read by `parseAirtableRecord`/`AirtableGraduateData` alongside the existing `trackingNumber` field so it can be shown in Admin.
- **New Tito API function** in `src/lib/tito.ts`: `deleteCheckin(checkinListSlug, checkinUuid)` — wraps the DELETE endpoint.
- `RawCheckin` (`src/lib/tito.ts:398`) currently only captures `ticket_id`, `created_at`, `deleted_at`. Add `uuid` to this interface (Tito's list response already includes it; it's just not read today) so the "find this ticket's checkin" lookups used by §3 can get the UUID needed for deletion without an extra request shape.

## Non-goals

- No guard is added to the `certificate-collection` station in the reverse direction (blocking/warning in-person handover because a certificate was already mailed). Confirmed out of scope: collection only happens on ceremony day, dispatch only happens in a later batch — the two stations are never in concurrent use for the same cohort, so this scenario doesn't occur in practice.
- No change to the one-check-in-per-list model for any other station — this pattern (delete-and-recreate to represent a second cycle) is scoped to `address-label` and `final-dispatch` only, invoked solely through the admin "Mark as Returned" action.
- No self-service / station-level return handling — returns are only processed by a supervisor in Admin, not by station operators in the field (confirmed).
- No automated detection of returns (e.g. via a DTDC delivery-status webhook triggering this automatically) — this is a manual admin action for now.

## Open parameters

- Exact wording of the two warning/block messages can be refined during implementation; the spec above gives the required information content (name/date for §1, courier/date/tracking number for §2) rather than final copy.
