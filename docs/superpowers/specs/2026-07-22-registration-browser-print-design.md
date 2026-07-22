# Registration Station: Browser Print as Primary Badge Print Method

## Problem

The Registration station (`/stations/registration`) prints a 4×6 badge (`Badge4x6`,
100mm × 153mm) for each graduate. Today `handlePrintBadge4x6` in
`src/app/stations/[stationId]/page.tsx` only tries two methods, in order:

1. Zebra Browser Print SDK (`useBrowserPrint`) — requires the Zebra Browser Print
   desktop app to be installed and running.
2. Mobile/Network print (`useMobilePrint`) — requires a printer IP configured in
   `localStorage` and a reachable Zebra printer on the network.

If neither is available, the handler silently gives up (station page comment:
"No auto-print available. User can use Zebra App button."). There is no fallback
to the browser's own native print dialog, even though that capability already
exists in the codebase (`printBadge4x6()` in `src/components/PrintTemplates.tsx`)
and is already used by `usePrinter.ts` for other stations. It was never wired
into the Registration station's handler.

Reference: a sister project, `amasi-faculty-management`, uses the same layered
idea — try a local print proxy, then fall back to a hidden iframe +
`iframe.contentWindow.print()` (the native browser print dialog) — so any
installed printer/driver works without vendor software. This spec brings that
"browser print" fallback into Registration's flow, but makes it the **primary**
method (per stakeholder decision), with the existing Zebra SDK and mobile print
staying on as fallbacks.

## Goals

- Registration station badge printing tries, in order:
  1. **Native browser print** (new, primary) — no vendor software required.
  2. Zebra Browser Print SDK (existing, now first fallback).
  3. Mobile/Network print (existing, now second fallback).
- Fix a latent bug in the iOS/iPadOS branch of `printBadge4x6()` that would
  print the 4×6 badge at the wrong paper size, since this path is about to
  become load-bearing (iPads are a realistic device at this station).
- No change to any other station's print behavior.

## Non-goals

- No change to the Zebra Browser Print SDK or mobile/network print
  implementations themselves — they're reordered, not modified.
- No change to the Electron `print-station-app`, `local-print-server.js`, or
  the RFID auto-print route — none of them touch this code path.
- Not fixing the pre-existing, unrelated bug where the Address-Label station's
  generic print button falls through to `printBadge4x6()` (wrong template)
  instead of `printAddressLabel4x6()`. Flagged for a separate task.

## Design

### 1. Reorder `handlePrintBadge4x6` (registration branch)

File: `src/app/stations/[stationId]/page.tsx`

Current order: Zebra SDK → Mobile print → give up.
New order:

```
1. Native browser print (printBadge4x6 from PrintTemplates.tsx)
   - Call synchronously inside try/catch, using printRef.current as the
     element to pull the already-rendered QR SVG from.
   - A native print dialog gives no JS success callback, so treat "did not
     throw" as success — same convention usePrinter.ts already uses for this
     same function at other stations.
   - On success: return (don't fall through to other methods).
   - On thrown error: log and fall through to step 2.

2. Zebra Browser Print SDK (unchanged logic, now first fallback)

3. Mobile/Network print (unchanged logic, now second fallback)
```

`printBadge4x6` needs to be imported into this file from
`@/components/PrintTemplates` (currently unimported there).

### 2. Print button state tracking

Add a `nativePrintState` state var (`'idle' | 'printing' | 'success' | 'error'`)
alongside the existing `browserPrint.state` / `mobilePrint.state`. Fold it into
the existing `currentPrintState` computation (station page, ~line 907) that
drives the Print button's spinner/checkmark/retry UI, so the button reflects
whichever method actually ran:

```
currentPrintState = registration
  ? (nativePrintState === 'printing' || browserPrint.state === 'printing' || mobilePrint.state === 'printing'
      ? 'printing'
    : nativePrintState === 'success' || browserPrint.state === 'success' || mobilePrint.state === 'success'
      ? 'success'
    : nativePrintState === 'error' || browserPrint.state === 'error' || mobilePrint.state === 'error'
      ? 'error'
    : 'idle')
  : printStatus
```

### 3. Fix iOS/iPadOS `@page` size mismatch (Bug fix, in scope)

File: `src/components/PrintTemplates.tsx` (`printBadge4x6` function) and/or
`src/app/globals.css`.

Problem: on iOS, `printBadge4x6()` doesn't use the isolated iframe path (iOS
Safari's print support inside iframes is unreliable) — instead it toggles
`.print-badge-4x6` visible in the main document and calls `window.print()`
directly. That relies on `globals.css`'s single `@media print` block, which
hardcodes `@page { size: 75mm 50mm; margin: 0 !important; }` (the
packing-sticker size) — there is no separate `@page` rule for the 4×6 badge, so
the printed page would be sized 75mm×50mm instead of 100mm×153mm.

Fix: in the iOS branch of `printBadge4x6()`, before calling `window.print()`,
inject a temporary `<style>` element into the document `<head>` with an
`@media print { @page { size: 100mm 153mm; margin: 0 !important; } }` override,
and remove that `<style>` element in the same cleanup step that currently hides
`.print-badge-4x6` again (the existing `setTimeout(() => { ... }, 1000)`).
`printSticker3x2()`'s iOS branch is unaffected (75mm×50mm already matches the
global default) and is not touched.

## Testing / verification

- Manual test on desktop Chrome/Safari: scan a graduate at Registration with no
  Zebra Browser Print app running and no mobile printer configured — confirm
  the browser's native print dialog opens with the correctly sized (100mm ×
  153mm), correctly rotated (180°) badge content, matching what Zebra SDK /
  mobile print already produce.
- Manual test on iPad Safari: same scenario — confirm the print preview shows
  100mm × 153mm (not 75mm × 50mm), correct content, no clipping.
- Manual test with Zebra Browser Print app running: confirm native browser
  print still runs first (per this spec), and that the Zebra SDK fallback
  still works correctly if the native path is forced to throw (e.g. by
  temporarily removing `printRef.current`).
- Confirm no other station's print behavior changed (packing, address-label,
  gown stations unaffected — they don't go through `handlePrintBadge4x6`).
