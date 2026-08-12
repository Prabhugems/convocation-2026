# Track Your Certificate — Auto-Submit & Auto-Reset

**Date:** 2026-08-12
**Status:** Approved
**Scope:** `src/app/track/page.tsx` only

## Problem

The public "Track Your Certificate" page (`/track`) requires a visitor to type or scan a value into the search box and then explicitly click "Track" (or press Enter) to search, and explicitly clear the box to search again. This is friction for two real usage patterns:

1. Someone scanning a printed QR/barcode into the field with an external scanner that doesn't send a trailing Enter keystroke.
2. A walk-up-and-scan flow at the venue where one person's result should clear itself to make way for the next person, without anyone touching a "clear" button.

## Behavior

### 1. Auto-submit on idle

- The search input already updates `query` state on every keystroke/scanned character.
- Track the timestamp of the last change to `query`.
- If 5000ms pass with no further change AND the trimmed value is at least 3 characters, trigger the same search logic the "Track" button runs.
- Every new keystroke (or scanned character) resets the 5s timer — someone actively typing is never interrupted mid-type.
- The existing manual "Track" button and Enter-to-submit continue to work unchanged and fire immediately, bypassing the timer.
- If a search already ran for the current exact trimmed query (whether via button, Enter, or a prior auto-submit), the idle timer does not re-fire a duplicate search for the same value.

### 2. Auto-reset after showing a result

- "Showing a result" means the page is in any post-search state: a matched graduate, a multiple-matches list, a no-results message, or an error message (i.e. `searched === true` and not currently loading).
- Once that state is reached, start a 12-second countdown.
- On specific user interaction — `click`, `keydown`, `scroll`, or `touchstart` anywhere on the page — cancel and restart the 12-second countdown. Raw `mousemove` is intentionally excluded (fires continuously and would effectively disable the timer for anyone with a mouse near the screen).
- If the countdown reaches 0 with no qualifying interaction, call the same logic as the existing "clear" (X) button: reset `query`, `graduate`, `searchResults`, `showResults`, `error`, `suggestions`, `addressData`, `searched` — and refocus the search input so the next scan/keystroke is captured immediately.
- Manually clearing the search (clicking the X button) or starting a new manual search cancels the pending countdown.

## Non-goals

- No camera/QR scanning UI is added to this page (that's a separate component, `UniversalScanner`, used elsewhere — out of scope here).
- No "kiosk mode" flag or route variant — this behavior applies uniformly to every visitor of `/track`.
- No visible countdown indicator or toast — the reset is silent, matching the existing silent auto-clear precedent at `src/app/stations/[stationId]/page.tsx:182`.

## Implementation notes

- Both behaviors are implemented as `useEffect`/`useRef` timer logic inside `TrackPage`, colocated with the existing state — no new files or shared hooks, since this behavior isn't (yet) needed anywhere else in the app.
- Timers must be cleared on unmount and whenever their triggering condition changes, to avoid stale closures firing after the component/state has moved on.

## Open parameters

- Idle-submit delay: **5000ms** (per request)
- Minimum auto-submit length: **3 characters** (new, to avoid firing on stray input)
- Result auto-reset delay: **12000ms** (midpoint of the requested "10 to 15 seconds" range)
