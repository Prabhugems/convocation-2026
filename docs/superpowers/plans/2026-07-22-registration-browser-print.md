# Registration Station Browser Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser's native print dialog the primary way badges are printed at the Registration station, with the existing Zebra Browser Print SDK and Mobile/Network print demoted to fallbacks, and fix a latent iOS paper-size bug in the code path this newly relies on.

**Architecture:** `handlePrintBadge4x6` in the station page tries three print methods in order (native browser print → Zebra Browser Print SDK → Mobile/Network print), stopping at the first one that runs without throwing/failing. Native browser print reuses the existing `printBadge4x6()` helper in `PrintTemplates.tsx`, which renders the badge into a hidden iframe (desktop) or toggles a hidden div + calls `window.print()` (iOS/iPadOS). That function's iOS branch is fixed to override the printed page size, since it currently inherits a page size meant for a different label type.

**Tech Stack:** Next.js App Router, React 19, TypeScript. No test framework is present in this repo (`package.json` has no test script, no `*.test.*`/`*.spec.*` files exist) — verification is via `npm run lint`, `npm run build` (which type-checks), and manual browser testing, per the design spec.

## Global Constraints

- No new npm dependencies — both tasks only touch existing functions/files.
- Preserve existing console.log/console.warn conventions in `handlePrintBadge4x6` (each print method logs its attempt/outcome with a `[Registration]` prefix) — new logging must follow the same style.
- Do not change behavior for any station other than `registration`, and do not change `printSticker3x2()` or any other exported function in `PrintTemplates.tsx` besides `printBadge4x6()`.
- Reference design spec: `docs/superpowers/specs/2026-07-22-registration-browser-print-design.md`.

---

### Task 1: Fix iOS/iPadOS `@page` size bug in `printBadge4x6()`

**Files:**
- Modify: `src/components/PrintTemplates.tsx:688-702`

**Interfaces:**
- Consumes: nothing new — no changes to this file's imports.
- Produces: `printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void` — same exported signature, unchanged, consumed by Task 2.

**Context:** `globals.css` has one global `@media print { @page { size: 75mm 50mm; ... } } }` rule (written for the packing-sticker station). `printBadge4x6()`'s iOS branch calls the main document's `window.print()` directly (it can't use the isolated-iframe approach the desktop branch uses, because iOS Safari's print support inside iframes is unreliable), so it inherits that 75mm×50mm page size instead of the 100mm×153mm the badge actually needs. This task overrides the page size for the duration of the print call, then removes the override.

- [ ] **Step 1: Read the current function to confirm line numbers match**

Run: `grep -n "export function printBadge4x6" -A 20 src/components/PrintTemplates.tsx`

Expected output starts with:
```
688:export function printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void {
689:  // On iOS/iPadOS, use window.print() directly
690:  if (isIOS()) {
691:    const printBadge = document.querySelector('.print-badge-4x6') as HTMLElement;
692:    if (printBadge) {
693:      printBadge.style.display = 'block';
694:    }
695:    window.print();
696:    setTimeout(() => {
697:      if (printBadge) {
698:        printBadge.style.display = 'none';
699:      }
700:    }, 1000);
701:    return;
702:  }
```

If line numbers have drifted, locate the block by content instead — the edit in Step 2 matches on exact code, not line numbers.

- [ ] **Step 2: Apply the fix**

Replace:
```typescript
export function printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void {
  // On iOS/iPadOS, use window.print() directly
  if (isIOS()) {
    const printBadge = document.querySelector('.print-badge-4x6') as HTMLElement;
    if (printBadge) {
      printBadge.style.display = 'block';
    }
    window.print();
    setTimeout(() => {
      if (printBadge) {
        printBadge.style.display = 'none';
      }
    }, 1000);
    return;
  }
```

With:
```typescript
export function printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void {
  // On iOS/iPadOS, use window.print() directly
  if (isIOS()) {
    const printBadge = document.querySelector('.print-badge-4x6') as HTMLElement;
    if (printBadge) {
      printBadge.style.display = 'block';
    }

    // globals.css hardcodes @page to the 75mm x 50mm packing-sticker size for
    // the whole document. Override it to the 100mm x 153mm badge size for the
    // duration of this print call, then remove the override below.
    const pageSizeOverride = document.createElement('style');
    pageSizeOverride.textContent = '@media print { @page { size: 100mm 153mm; margin: 0 !important; } }';
    document.head.appendChild(pageSizeOverride);

    window.print();
    setTimeout(() => {
      if (printBadge) {
        printBadge.style.display = 'none';
      }
      document.head.removeChild(pageSizeOverride);
    }, 1000);
    return;
  }
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run lint`
Expected: no new errors reported for `src/components/PrintTemplates.tsx`.

Run: `npm run build`
Expected: build succeeds (this also runs the TypeScript compiler across the project).

- [ ] **Step 4: Manual verification on iOS Safari (or iPadOS Safari / Simulator)**

1. Start the dev server: `npm run dev`
2. On an iPhone/iPad (or Safari's iOS simulator), open the deployed/dev URL's `/stations/registration` page.
3. Scan or search for any graduate so a badge is loaded (`lastScanned` is set).
4. Tap the "Print" button.
5. In the print preview sheet, confirm the page size shown is 100mm × 153mm (roughly 4in × 6in portrait), not 75mm × 50mm, and that the badge content isn't clipped or scaled down to a tiny corner.
6. Cancel the print (no need to actually print paper for this check).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintTemplates.tsx
git commit -m "$(cat <<'EOF'
Fix iOS badge print using wrong page size

printBadge4x6()'s iOS branch called window.print() against the main
document, which only has a single global @page rule sized for the
packing sticker (75mm x 50mm). The 4x6 badge printed at the wrong
paper size as a result. Override @page for the duration of the print
call instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire native browser print as the primary Registration print method

**Files:**
- Modify: `src/app/stations/[stationId]/page.tsx:8` (import)
- Modify: `src/app/stations/[stationId]/page.tsx:100-107` (state declarations)
- Modify: `src/app/stations/[stationId]/page.tsx:185-244` (`handlePrintBadge4x6`)
- Modify: `src/app/stations/[stationId]/page.tsx:905-916` (`currentPrintState` computation)

**Interfaces:**
- Consumes: `printBadge4x6(graduate: Graduate, elementRef?: HTMLElement | null): void` from Task 1 (`@/components/PrintTemplates`) — same signature already used elsewhere in this codebase via `usePrinter.ts`.
- Produces: no new exports — this task only changes behavior inside the page component.

**Context:** Today `handlePrintBadge4x6` for the `registration` station tries the Zebra Browser Print SDK, then Mobile/Network print, then gives up silently. This task inserts native browser print as the first attempt, and adds a `nativePrintState` variable so the Print button's spinner/checkmark/error UI reflects whichever method actually ran (the existing UI already combines `browserPrint.state` and `mobilePrint.state` the same way).

- [ ] **Step 1: Confirm current import line**

Run: `grep -n "from '@/components/PrintTemplates'" src/app/stations/\[stationId\]/page.tsx`

Expected output:
```
8:import { Sticker3x2, Badge4x6, AddressLabel4x6, AddressLabelData, printElement, printSticker3x2, printAddressLabel4x6 } from '@/components/PrintTemplates';
```

- [ ] **Step 2: Add `printBadge4x6` to the import**

Replace:
```typescript
import { Sticker3x2, Badge4x6, AddressLabel4x6, AddressLabelData, printElement, printSticker3x2, printAddressLabel4x6 } from '@/components/PrintTemplates';
```

With:
```typescript
import { Sticker3x2, Badge4x6, AddressLabel4x6, AddressLabelData, printElement, printSticker3x2, printAddressLabel4x6, printBadge4x6 } from '@/components/PrintTemplates';
```

- [ ] **Step 3: Add `nativePrintState` next to the other print-method state**

Find this block (currently around line 100-107):
```typescript
  // Zebra printer direct print (legacy)
  const { printLabel, status: printStatus } = usePrinter();

  // Zebra Browser Print (for registration station 4x6 badges)
  const browserPrint = useBrowserPrint();
  // Mobile/Network print (works from phone - no software needed)
  const mobilePrint = useMobilePrint();
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
```

Replace it with:
```typescript
  // Zebra printer direct print (legacy)
  const { printLabel, status: printStatus } = usePrinter();

  // Zebra Browser Print (for registration station 4x6 badges)
  const browserPrint = useBrowserPrint();
  // Mobile/Network print (works from phone - no software needed)
  const mobilePrint = useMobilePrint();
  // Native browser print (primary method for registration station 4x6 badges)
  const [nativePrintState, setNativePrintState] = useState<'idle' | 'printing' | 'success' | 'error'>('idle');
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);
```

- [ ] **Step 4: Reorder `handlePrintBadge4x6` to try native browser print first**

Find this block (currently around line 185-244):
```typescript
  // Helper function to print 4x6 badge
  // Uses Browser Print, Mobile Print, or falls back to jsPDF
  const handlePrintBadge4x6 = async (graduate: Graduate) => {
    // For registration station, try different print methods
    if (stationId === 'registration') {
      // 1. Try Browser Print first (desktop with Zebra Browser Print software)
      if (browserPrint.isRunning) {
        const success = await browserPrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Browser Print');
          return;
        }
        console.warn('[Registration] Browser Print failed, trying other methods');
      }

      // 2. Try Mobile/Network Print - check localStorage directly
      let mobileSettings = null;
      try {
        const saved = localStorage.getItem('mobile-printer-settings');
        console.log('[Registration] Mobile settings from localStorage:', saved);
        if (saved) {
          mobileSettings = JSON.parse(saved);
          console.log('[Registration] Parsed mobile settings:', mobileSettings);
        }
      } catch (e) {
        console.error('[Registration] Failed to read mobile settings:', e);
      }

      // If we have an IP address, try to print
      if (mobileSettings?.ip) {
        console.log('[Registration] Attempting mobile/network print to', mobileSettings.ip);
        const success = await mobilePrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Mobile/Network Print');
          return;
        }
        console.warn('[Registration] Mobile Print failed');
        // Don't show modal or fall through - user can use Zebra App button
        return;
      }

      // No print method available - just return, user can use Zebra App button
      console.log('[Registration] No auto-print available. User can use Zebra App button.');
      return;
    }
```

Replace it with:
```typescript
  // Helper function to print 4x6 badge
  // Registration tries native browser print, then Browser Print (Zebra SDK), then Mobile Print; other stations use jsPDF
  const handlePrintBadge4x6 = async (graduate: Graduate) => {
    // For registration station, try different print methods
    if (stationId === 'registration') {
      // 1. Try native browser print first - works with any installed printer/driver,
      // no vendor software required. A native print dialog gives no JS success
      // callback, so "did not throw" is treated as success (same convention
      // usePrinter.ts already uses for this same function at other stations).
      setNativePrintState('printing');
      try {
        printBadge4x6(graduate, printRef.current);
        setNativePrintState('success');
        setTimeout(() => setNativePrintState('idle'), 2000);
        console.log('[Registration] Badge printed via native browser print');
        return;
      } catch (e) {
        console.warn('[Registration] Native browser print failed, trying other methods', e);
        setNativePrintState('error');
      }

      // 2. Try Browser Print (desktop with Zebra Browser Print software)
      if (browserPrint.isRunning) {
        const success = await browserPrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Browser Print');
          return;
        }
        console.warn('[Registration] Browser Print failed, trying other methods');
      }

      // 3. Try Mobile/Network Print - check localStorage directly
      let mobileSettings = null;
      try {
        const saved = localStorage.getItem('mobile-printer-settings');
        console.log('[Registration] Mobile settings from localStorage:', saved);
        if (saved) {
          mobileSettings = JSON.parse(saved);
          console.log('[Registration] Parsed mobile settings:', mobileSettings);
        }
      } catch (e) {
        console.error('[Registration] Failed to read mobile settings:', e);
      }

      // If we have an IP address, try to print
      if (mobileSettings?.ip) {
        console.log('[Registration] Attempting mobile/network print to', mobileSettings.ip);
        const success = await mobilePrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Mobile/Network Print');
          return;
        }
        console.warn('[Registration] Mobile Print failed');
        // Don't show modal or fall through - user can use Zebra App button
        return;
      }

      // No print method available - just return, user can use Zebra App button
      console.log('[Registration] No auto-print available. User can use Zebra App button.');
      return;
    }
```

Note: the rest of the function (the non-registration jsPDF branch, after this block) is unchanged — do not modify it.

- [ ] **Step 5: Fold `nativePrintState` into the Print button's state computation**

Find this block (currently around line 905-916):
```typescript
                  {station.printType && lastScanned && (() => {
                    // Determine current print state based on print method
                    const currentPrintState = stationId === 'registration'
                      ? (browserPrint.state === 'printing' || mobilePrint.state === 'printing'
                        ? 'printing'
                        : browserPrint.state === 'success' || mobilePrint.state === 'success'
                        ? 'success'
                        : browserPrint.state === 'error' || mobilePrint.state === 'error'
                        ? 'error'
                        : 'idle')
                      : printStatus;
```

Replace it with:
```typescript
                  {station.printType && lastScanned && (() => {
                    // Determine current print state based on print method
                    const currentPrintState = stationId === 'registration'
                      ? (nativePrintState === 'printing' || browserPrint.state === 'printing' || mobilePrint.state === 'printing'
                        ? 'printing'
                        : nativePrintState === 'success' || browserPrint.state === 'success' || mobilePrint.state === 'success'
                        ? 'success'
                        : nativePrintState === 'error' || browserPrint.state === 'error' || mobilePrint.state === 'error'
                        ? 'error'
                        : 'idle')
                      : printStatus;
```

- [ ] **Step 6: Type-check and lint**

Run: `npm run lint`
Expected: no new errors. In particular, confirm no "unused variable" warning for `printBadge4x6` (it's now used in Step 4) and no "unused variable" warning for `nativePrintState`/`setNativePrintState` (used in Steps 4 and 5).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Manual verification — desktop, no vendor printer software running**

1. Run `npm run dev`, open `/stations/registration` in desktop Chrome or Safari.
2. Ensure Zebra Browser Print app is NOT running and no mobile printer IP is configured (clear `localStorage` key `mobile-printer-settings` if present, e.g. via DevTools console: `localStorage.removeItem('mobile-printer-settings')`).
3. Scan or search for a graduate, then click "Print".
4. Confirm the browser's native print dialog opens (not a silent no-op), showing the 4×6 badge content correctly sized and rotated 180°, matching the existing Zebra/mobile-print output.
5. Confirm the Print button shows the "printing" then "Printed!" state (green check) rather than staying stuck on the printer icon.

- [ ] **Step 8: Manual verification — iOS/iPadOS**

Repeat Step 7 on an iPhone/iPad Safari. Confirm the print preview shows the 100mm × 153mm size (verified already in Task 1, Step 4) and that the flow is triggered by the same "Print" button tap.

- [ ] **Step 9: Manual verification — other stations unaffected**

1. Open `/stations/packing` (a non-registration, non-4x6-badge station).
2. Scan or search for a graduate, click "Print".
3. Confirm the 3×2 sticker print flow works exactly as before (native browser print changes only apply inside the `stationId === 'registration'` branch).

- [ ] **Step 10: Commit**

```bash
git add src/app/stations/\[stationId\]/page.tsx
git commit -m "$(cat <<'EOF'
Make native browser print the primary Registration badge method

Registration's print handler only tried the Zebra Browser Print SDK
and Mobile/Network print, giving up silently if neither was
configured. Add native browser print (window's own print dialog,
already implemented in PrintTemplates.tsx but never called for this
station) as the first method tried, falling back to the existing two
if it fails.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
