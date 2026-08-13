# Dispatch Duplicate-Send Safeguards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent two duplicate-certificate mistakes at the mailing stage of Convocation 2026: (1) mailing a certificate to someone who already collected it in person, and (2) reusing a tracking number to print a second address label for someone already dispatched — while providing a supervised way to resend a courier-returned (RTO) parcel with a genuinely new tracking number.

**Architecture:** Three layers change together. The data layer (`src/lib/tito.ts`, `src/lib/airtable.ts`, `src/types/index.ts`) gains the ability to read real per-ticket check-in status before acting, delete a Tito check-in (to "unlock" a station), and read/write the org's existing Airtable RTO fields. The API layer (`src/app/api/scan/route.ts`, new `src/app/api/admin/mark-returned/route.ts`) enforces the hard block server-side and implements the return/resend flow. The UI layer (station page, admin page) adds a soft-warn confirm, a hard-block message, and a supervisor-only "Mark as Returned" action.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tito Check-in API (`checkin.tito.io`), Airtable REST API. No test framework is present in this repo (`package.json` has no test script, no `*.test.*`/`*.spec.*` files) — verification is `npm run lint`, `npx tsc --noEmit` (type-check), and manual reasoning/dev-server testing, matching the convention already used in `docs/superpowers/plans/2026-08-12-track-page-auto-submit-reset.md`.

## Global Constraints

- Reference design spec: `docs/superpowers/specs/2026-08-13-dispatch-duplicate-safeguards-design.md` (read this first for the "why").
- **Do not run the new `deleteCheckin`/`unlockStationForResend` functions against real production tickets during development.** They permanently delete a real Tito check-in record. Verification for anything that calls them is type-check/build only, plus careful manual QA by a human against a real record only when the whole chain is done and reviewed (Task 7's manual QA step says this explicitly — don't skip ahead to "just try it" on a real graduate).
- Airtable field names to use, exactly as created (verified via the Airtable MCP schema, base `app7TElm0QUruBlZr`): `Master-FMAS` (`tbl9CuIgSFdoNVk9x`) has `RTO` (checkbox), `reason for RTO` (text), `old Tracking Number` (text), `Tracking Number` (text). `Master-MMAS` (`tblBXE3iZGd9zHbKo`) has `RTO` (checkbox, added 2026-08-13, `fld6xvwgiCjkt3LG4`), `old Tracking Number` (text, added 2026-08-13, `fld77kviVR64Whljx`), `RTO Remarks` (text, pre-existing — MMAS's equivalent of `reason for RTO`), `Tracking Number` (text). Do not invent new field names — reuse these.
- No new npm dependencies.
- The certificate-collection station is explicitly NOT touched (confirmed out of scope in the design spec — collection and dispatch never run concurrently for the same cohort).
- The Final Dispatch station's tracking-number entry form is NOT given a separate "disabled" UI state. The hard block surfaces through the server rejecting the check-in, which the station page already renders via its existing result-message banner (`src/app/stations/[stationId]/page.tsx:915-946`) — the same UI path "already checked in" errors use today. Building a second, parallel "pre-emptively disable this form" UI would duplicate that path for no behavioral gain, since (unlike Address Label) Final Dispatch has no separate lookup-then-decide step — scanning there immediately attempts the dispatch.

---

### Task 1: Add RTO/tracking fields to the shared types

**Files:**
- Modify: `src/types/index.ts:122-160` (`AirtableRecord` and `AirtableGraduateData`)

**Interfaces:**
- Produces: `AirtableRecord['fields']` gains `'RTO'`, `'reason for RTO'`, `'RTO Remarks'`, `'old Tracking Number'` (all optional).
- Produces: `AirtableGraduateData` gains `airtableRecordId: string`, `airtableTableId: string`, `rto?: boolean`, `oldTrackingNumber?: string`, `reasonForRto?: string` — consumed by Task 2 (`parseAirtableRecord`) and Task 6 (the new admin API route, which reads `airtableRecordId`/`airtableTableId`/`trackingNumber` off this type via `getAirtableDataByConvocationNumber`).

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "export interface AirtableRecord" -A 26 src/types/index.ts`

Expected to see the `'Tracking Number'?: string;` and `'AMASICON Last Checked'?: string;` lines inside the `fields` block, and further down `export interface AirtableGraduateData {`. If the content has drifted, locate the two interfaces by name instead of by line number — the edits below match on exact code, not line numbers.

- [ ] **Step 2: Add the new Airtable field names to `AirtableRecord['fields']`**

Replace:
```typescript
    'Tracking Number'?: string;
    'DTDC Service available'?: string; // YES or NO
    'Form A'?: string; // Fillout form URL for address update
    'Registered for AMASICON'?: boolean;
    'AMASICON Last Checked'?: string;
  };
}
```

With:
```typescript
    'Tracking Number'?: string;
    'DTDC Service available'?: string; // YES or NO
    'Form A'?: string; // Fillout form URL for address update
    'Registered for AMASICON'?: boolean;
    'AMASICON Last Checked'?: string;
    'RTO'?: boolean; // checked when a dispatched certificate was returned by the courier
    'reason for RTO'?: string; // Master-FMAS's RTO note field
    'RTO Remarks'?: string; // Master-MMAS's RTO note field (same purpose, different name)
    'old Tracking Number'?: string; // previous tracking number, preserved on resend
  };
}
```

- [ ] **Step 3: Add the new fields to `AirtableGraduateData`, plus the record/table identifiers**

Replace:
```typescript
// Parsed Airtable data for merging
export interface AirtableGraduateData {
  convocationNumber: string;
  name: string;
  email: string;
  mobile: string;
  address: Address;
  courseDetails?: string;
  trackingNumber?: string;
  dtdcAvailable?: boolean; // true if DTDC Service available = YES
  formAUrl?: string; // Fillout form URL for address update
}
```

With:
```typescript
// Parsed Airtable data for merging
export interface AirtableGraduateData {
  convocationNumber: string;
  name: string;
  email: string;
  mobile: string;
  address: Address;
  courseDetails?: string;
  trackingNumber?: string;
  dtdcAvailable?: boolean; // true if DTDC Service available = YES
  formAUrl?: string; // Fillout form URL for address update
  airtableRecordId: string; // Airtable record id, e.g. "recXXXXXXXXXXXXXX" — needed to PATCH this exact record
  airtableTableId: string; // which table (FMAS/MMAS table id) this record lives in — needed to PATCH the right table
  rto?: boolean; // true if this certificate was returned by the courier and is pending resend
  oldTrackingNumber?: string; // previous tracking number, preserved when a returned parcel is resent
  reasonForRto?: string; // free-text note about the return (from 'reason for RTO' on FMAS, 'RTO Remarks' on MMAS)
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: New errors at every call site that constructs an `AirtableGraduateData` without the two new required fields (`airtableRecordId`, `airtableTableId`) — this is expected and will be fixed by Task 2. Confirm the errors are only in `src/lib/airtable.ts` (the `parseAirtableRecord` function) — if errors appear anywhere else, stop and investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts
git commit -m "Add RTO/tracking fields to Airtable types"
```

---

### Task 2: Read and write the RTO fields in the Airtable layer

**Files:**
- Modify: `src/lib/airtable.ts:63-106` (`parseAirtableRecord`)
- Modify: `src/lib/airtable.ts:132-193` (`getAirtableDataMap`, the two call sites of `parseAirtableRecord`)
- Modify: `src/lib/airtable.ts` (add `markCertificateReturned` near `updateRegistrationCheckResult`, the existing PATCH example)

**Interfaces:**
- Consumes: `AirtableRecord`, `AirtableGraduateData` (Task 1).
- Produces: `parseAirtableRecord(record: AirtableRecord, tableId: string): AirtableGraduateData | null` — signature changes (adds `tableId` param). Consumed only within this file (both call sites updated in this task).
- Produces: `markCertificateReturned(airtableTableId: string, airtableRecordId: string, currentTrackingNumber: string, reason: string | undefined): Promise<ApiResponse<void>>` — consumed by Task 6 (`src/app/api/admin/mark-returned/route.ts`).

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "function parseAirtableRecord" -A 24 src/lib/airtable.ts`

Expected to see the function starting `function parseAirtableRecord(record: AirtableRecord): AirtableGraduateData | null {` and ending with the `return { ... };` block containing `formAUrl:`. If drifted, locate by content.

- [ ] **Step 2: Add `tableId` param and parse the new fields in `parseAirtableRecord`**

Replace:
```typescript
// Parse Airtable record to graduate data
function parseAirtableRecord(record: AirtableRecord): AirtableGraduateData | null {
  const fields = record.fields;
  const convocationNumber = fields['CONVOCATION NUMBER'];

  if (!convocationNumber) {
    return null;
  }

  // Parse DTDC service availability
  const dtdcField = fields['DTDC Service available'];
  const dtdcAvailable = dtdcField?.toUpperCase().trim() === 'YES';

  return {
    convocationNumber: convocationNumber.toUpperCase().trim(),
    name: (fields['Name'] || '').trim(),
    email: (fields['Email'] || '').toLowerCase().trim(),
    mobile: parseMobile(fields['MOBILE']),
    address: parseAddress(record),
    courseDetails: fields['Skill Course Details'],
    trackingNumber: (fields['Tracking Number'] || '').trim() || undefined,
    dtdcAvailable,
    formAUrl: (fields['Form A'] || '').trim() || undefined,
  };
}
```

With:
```typescript
// Parse Airtable record to graduate data
function parseAirtableRecord(record: AirtableRecord, tableId: string): AirtableGraduateData | null {
  const fields = record.fields;
  const convocationNumber = fields['CONVOCATION NUMBER'];

  if (!convocationNumber) {
    return null;
  }

  // Parse DTDC service availability
  const dtdcField = fields['DTDC Service available'];
  const dtdcAvailable = dtdcField?.toUpperCase().trim() === 'YES';

  return {
    convocationNumber: convocationNumber.toUpperCase().trim(),
    name: (fields['Name'] || '').trim(),
    email: (fields['Email'] || '').toLowerCase().trim(),
    mobile: parseMobile(fields['MOBILE']),
    address: parseAddress(record),
    courseDetails: fields['Skill Course Details'],
    trackingNumber: (fields['Tracking Number'] || '').trim() || undefined,
    dtdcAvailable,
    formAUrl: (fields['Form A'] || '').trim() || undefined,
    airtableRecordId: record.id,
    airtableTableId: tableId,
    rto: fields['RTO'] === true,
    oldTrackingNumber: (fields['old Tracking Number'] || '').trim() || undefined,
    // Master-FMAS calls this "reason for RTO"; Master-MMAS calls the same-purpose field "RTO Remarks".
    reasonForRto: (fields['reason for RTO'] || fields['RTO Remarks'] || '').trim() || undefined,
  };
}
```

- [ ] **Step 3: Pass `tableId` at both call sites in `getAirtableDataMap`**

Replace:
```typescript
    for (const record of fmasRecords) {
      const parsed = parseAirtableRecord(record);
      if (parsed) {
        dataMap.set(parsed.convocationNumber, parsed);
      }
    }
```

With:
```typescript
    for (const record of fmasRecords) {
      const parsed = parseAirtableRecord(record, fmasTableId);
      if (parsed) {
        dataMap.set(parsed.convocationNumber, parsed);
      }
    }
```

Replace:
```typescript
      for (const record of mmasRecords) {
        const parsed = parseAirtableRecord(record);
        if (parsed && !dataMap.has(parsed.convocationNumber)) {
          dataMap.set(parsed.convocationNumber, parsed);
        }
      }
```

With:
```typescript
      for (const record of mmasRecords) {
        const parsed = parseAirtableRecord(record, mmasTableId);
        if (parsed && !dataMap.has(parsed.convocationNumber)) {
          dataMap.set(parsed.convocationNumber, parsed);
        }
      }
```

- [ ] **Step 4: Type-check — the errors from Task 1 should now be gone**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If errors remain in `src/lib/airtable.ts`, re-check Step 2/3 match the file exactly.

- [ ] **Step 5: Add `markCertificateReturned`**

Find the existing `updateRegistrationCheckResult` function (search: `grep -n "export async function updateRegistrationCheckResult" -A 20 src/lib/airtable.ts`) — it ends with:
```typescript
  const response = await airtableFetch<unknown>(tableId, `/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  if (!response.success) {
    return { success: false, error: response.error };
  }

  return { success: true };
}
```

Immediately after that closing `}`, add:
```typescript

// Archives the current tracking number into "old Tracking Number", flags RTO,
// records an optional reason, and blanks "Tracking Number" so the next Final
// Dispatch entry can't accidentally prefill (and thus reuse) the returned number.
export async function markCertificateReturned(
  airtableTableId: string,
  airtableRecordId: string,
  currentTrackingNumber: string,
  reason: string | undefined
): Promise<ApiResponse<void>> {
  const fields: Record<string, unknown> = {
    'RTO': true,
    'old Tracking Number': currentTrackingNumber,
    'Tracking Number': '',
  };

  if (reason) {
    // Master-MMAS's RTO note field is named "RTO Remarks" instead of "reason for RTO".
    if (airtableTableId === process.env.AIRTABLE_MMAS_TABLE) {
      fields['RTO Remarks'] = reason;
    } else {
      fields['reason for RTO'] = reason;
    }
  }

  const response = await airtableFetch<unknown>(airtableTableId, `/${airtableRecordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });

  if (!response.success) {
    return { success: false, error: response.error };
  }

  return { success: true };
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/airtable.ts
git commit -m "Read/write RTO fields in the Airtable layer"
```

---

### Task 3: Tito layer — delete-checkin capability and the trackingNumber merge fix

**Files:**
- Modify: `src/lib/tito.ts:368-396` (`mergeWithAirtableData`)
- Modify: `src/lib/tito.ts:398-403` (`RawCheckin` interface)
- Modify: `src/lib/tito.ts` (add `deleteCheckin` and `unlockStationForResend` after `fetchAllCheckinsForList`)

**Interfaces:**
- Produces: `deleteCheckin(checkinListSlug: string, uuid: string): Promise<ApiResponse<{ success: boolean }>>`.
- Produces: `unlockStationForResend(ticketId: number, stationId: StationId): Promise<ApiResponse<{ deleted: boolean }>>` — consumed by Task 6.
- `mergeWithAirtableData` now also copies `trackingNumber` onto the returned `Graduate` — this is a pre-existing gap (the function already copies `name`/`phone`/`address` from Airtable but not `trackingNumber`), and without this fix the "Mark as Returned" flow has no tracking number to archive, and the admin page's existing tracking-number display (`src/app/admin/page.tsx:1759-1765`) never renders.

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "function mergeWithAirtableData" -A 30 src/lib/tito.ts`

Expected to see the function ending with the `return { ...graduate, name: ..., phone: ..., address: ... };` block.

- [ ] **Step 2: Add the `trackingNumber` copy to `mergeWithAirtableData`**

Replace:
```typescript
  // Merge data - Airtable has priority for display name
  return {
    ...graduate,
    // ALWAYS use Airtable name if available (has full name with middle name)
    name: airtableData.name || graduate.name,
    // Use Airtable mobile if Tito doesn't have one
    phone: graduate.phone || airtableData.mobile,
    // Always get address from Airtable if available
    address: airtableData.address.line1 ? airtableData.address : graduate.address,
  };
}
```

With:
```typescript
  // Merge data - Airtable has priority for display name
  return {
    ...graduate,
    // ALWAYS use Airtable name if available (has full name with middle name)
    name: airtableData.name || graduate.name,
    // Use Airtable mobile if Tito doesn't have one
    phone: graduate.phone || airtableData.mobile,
    // Always get address from Airtable if available
    address: airtableData.address.line1 ? airtableData.address : graduate.address,
    // Tracking number lives only in Airtable — without this, admin/station UI
    // that reads graduate.trackingNumber (e.g. the "already dispatched" checks)
    // always sees undefined.
    trackingNumber: airtableData.trackingNumber || graduate.trackingNumber,
  };
}
```

- [ ] **Step 3: Add `uuid` to `RawCheckin`**

Replace:
```typescript
// A raw check-in record as returned by the Tito Check-in API
interface RawCheckin {
  ticket_id: number;
  created_at: string;
  deleted_at: string | null;
}
```

With:
```typescript
// A raw check-in record as returned by the Tito Check-in API
interface RawCheckin {
  ticket_id: number;
  uuid: string;
  created_at: string;
  deleted_at: string | null;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (adding a field to an interface whose values already come straight from a JSON response doesn't break anything — `fetchAllCheckinsForList`'s `data as RawCheckin[]` cast now includes `uuid` at runtime too, since Tito's actual response already includes it; verified via Tito's API docs during design).

- [ ] **Step 5: Add `deleteCheckin` and `unlockStationForResend`**

Find `fetchAllCheckinsForList`'s closing brace (search: `grep -n "^async function fetchAllCheckinsForList" -A 40 src/lib/tito.ts` and look for the `return all;\n}` near the end), immediately followed by the comment `// Fetch all check-ins from all check-in lists and build a status map`. Insert the two new functions between that closing `}` and that comment:

Replace:
```typescript
  return all;
}

// Fetch all check-ins from all check-in lists and build a status map
```

With:
```typescript
  return all;
}

// Delete a specific check-in by UUID. Used to "unlock" a station for a
// legitimate second visit — e.g. a courier-returned parcel being resent —
// since Tito otherwise refuses a second check-in on a list that already has
// one for that ticket, regardless of any app-level status flag.
export async function deleteCheckin(
  checkinListSlug: string,
  uuid: string
): Promise<ApiResponse<{ success: boolean }>> {
  const url = `https://checkin.tito.io/checkin_lists/${checkinListSlug}/checkins/${uuid}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tito Check-in API] Delete failed: ${response.status} - ${errorText}`);
      return { success: false, error: `Delete check-in failed: ${response.status}` };
    }

    return { success: true, data: { success: true } };
  } catch (error) {
    console.error('[Tito Check-in API] Delete network error:', error);
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Find and delete a ticket's check-in at a given station, so it can be
// legitimately checked in there again. Returns { deleted: false } (not an
// error) if the ticket had no check-in at that station — nothing to unlock.
export async function unlockStationForResend(
  ticketId: number,
  stationId: StationId
): Promise<ApiResponse<{ deleted: boolean }>> {
  const checkinListSlug = STATION_CHECKIN_MAPPING[stationId];

  if (!checkinListSlug) {
    return { success: false, error: `No checkin list configured for station: ${stationId}` };
  }

  const checkins = await fetchAllCheckinsForList(checkinListSlug);
  const existing = checkins.find((c) => c.ticket_id === ticketId && !c.deleted_at);

  if (!existing) {
    return { success: true, data: { deleted: false } };
  }

  const result = await deleteCheckin(checkinListSlug, existing.uuid);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: { deleted: true } };
}

// Fetch all check-ins from all check-in lists and build a status map
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/tito.ts
git commit -m "Add Tito check-in deletion and fix trackingNumber merge gap"
```

---

### Task 4: Enforce the hard block and fix status enrichment in `POST /api/scan`

**Files:**
- Modify: `src/app/api/scan/route.ts` (imports, both graduate-resolution branches, and the check-in section)

**Interfaces:**
- Consumes: `getTicketCheckins` (already exported from `src/lib/tito.ts:711`), `getStationStatus` (already exported from `src/lib/stations.ts:89`).
- Produces: `POST /api/scan` now returns a `graduate.status`/`graduate.scans` that reflect real prior check-ins (previously always empty/false — a pre-existing gap), `graduate.trackingNumber` populated from Airtable in both lookup branches, and rejects (`success: false`, no Tito check-in attempted) a check-in at `address-label` or `final-dispatch` when `status.finalDispatched` is already true. Consumed by Task 5 (the station page reads `lastScanned.status`/`lastScanned.scans`/`lastScanned.trackingNumber` from this response).

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "^import" -A 8 src/app/api/scan/route.ts`

Expected:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationByReference,
  registrationToGraduate,
  checkinAtStation,
  getTicketBySlug,
  ticketToGraduate
} from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
```

- [ ] **Step 2: Add the two new imports**

Replace:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationByReference,
  registrationToGraduate,
  checkinAtStation,
  getTicketBySlug,
  ticketToGraduate
} from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { StationId, Graduate } from '@/types';
```

With:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationByReference,
  registrationToGraduate,
  checkinAtStation,
  getTicketBySlug,
  ticketToGraduate,
  getTicketCheckins
} from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { getStationStatus } from '@/lib/stations';
import { StationId, Graduate } from '@/types';
```

- [ ] **Step 3: Merge `trackingNumber` in the ticket-slug lookup branch**

Replace:
```typescript
        if (graduate.convocationNumber) {
          const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
          if (airtableResult.success && airtableResult.data) {
            // ALWAYS use Airtable name if available (has full name with middle name)
            if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
              console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
              graduate.name = airtableResult.data.name;
            }
            graduate.phone = graduate.phone || airtableResult.data.mobile;
            if (airtableResult.data.address.line1) {
              graduate.address = airtableResult.data.address;
            }
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Ticket not found: ${ticketSlug}` },
          { status: 404 }
        );
      }
    } else {
```

With:
```typescript
        if (graduate.convocationNumber) {
          const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
          if (airtableResult.success && airtableResult.data) {
            // ALWAYS use Airtable name if available (has full name with middle name)
            if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
              console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
              graduate.name = airtableResult.data.name;
            }
            graduate.phone = graduate.phone || airtableResult.data.mobile;
            if (airtableResult.data.address.line1) {
              graduate.address = airtableResult.data.address;
            }
            graduate.trackingNumber = airtableResult.data.trackingNumber;
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Ticket not found: ${ticketSlug}` },
          { status: 404 }
        );
      }
    } else {
```

- [ ] **Step 4: Merge `trackingNumber` in the registration-reference lookup branch**

Replace:
```typescript
      // Merge with Airtable data (including name)
      if (graduate.convocationNumber) {
        const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
        if (airtableResult.success && airtableResult.data) {
          // ALWAYS use Airtable name if available (has full name with middle name)
          if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
            console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
            graduate.name = airtableResult.data.name;
          }
          graduate.phone = graduate.phone || airtableResult.data.mobile;
          if (airtableResult.data.address.line1) {
            graduate.address = airtableResult.data.address;
          }
        }
      }
    }

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Could not find graduate' },
        { status: 404 }
      );
    }

    // Create check-in at the station
    const checkinResult = await checkinAtStation(graduate.ticketId, stationId as StationId);

    if (!checkinResult.success) {
      // If already checked in, still return the graduate info
      if (checkinResult.error?.includes('already')) {
        return NextResponse.json({
          success: false,
          error: `Already scanned at ${stationId} station`,
          data: graduate,
        });
      }
      return NextResponse.json(
        { success: false, error: checkinResult.error || 'Failed to record scan' },
        { status: 400 }
      );
    }
```

With:
```typescript
      // Merge with Airtable data (including name)
      if (graduate.convocationNumber) {
        const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
        if (airtableResult.success && airtableResult.data) {
          // ALWAYS use Airtable name if available (has full name with middle name)
          if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
            console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
            graduate.name = airtableResult.data.name;
          }
          graduate.phone = graduate.phone || airtableResult.data.mobile;
          if (airtableResult.data.address.line1) {
            graduate.address = airtableResult.data.address;
          }
          graduate.trackingNumber = airtableResult.data.trackingNumber;
        }
      }
    }

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Could not find graduate' },
        { status: 404 }
      );
    }

    // Read real check-in status before acting, both so the response reflects
    // reality (previously this endpoint always returned an all-false status,
    // unlike /api/search) and so the duplicate-dispatch check below can see
    // whether this ticket was already fully dispatched.
    if (graduate.ticketId) {
      const checkinsResult = await getTicketCheckins(graduate.ticketId);
      if (checkinsResult.success && checkinsResult.data) {
        graduate.status = checkinsResult.data.status;
        graduate.scans = checkinsResult.data.scans;
      }
    }

    // Hard block: a tracking number already assigned to this graduate must
    // not be reused by printing/checking in a second address label or a
    // second final-dispatch record. The only way past this is the admin
    // "Mark as Returned" action, which deletes the underlying check-ins.
    if (
      (stationId === 'address-label' || stationId === 'final-dispatch') &&
      graduate.status.finalDispatched
    ) {
      return NextResponse.json({
        success: false,
        error: graduate.trackingNumber
          ? `Already dispatched — Tracking ${graduate.trackingNumber}. Cannot create a duplicate dispatch record.`
          : 'Already dispatched. Cannot create a duplicate dispatch record.',
        data: graduate,
      });
    }

    // Create check-in at the station
    const checkinResult = await checkinAtStation(graduate.ticketId, stationId as StationId);

    if (!checkinResult.success) {
      // If already checked in, still return the graduate info
      if (checkinResult.error?.includes('already')) {
        return NextResponse.json({
          success: false,
          error: `Already scanned at ${stationId} station`,
          data: graduate,
        });
      }
      return NextResponse.json(
        { success: false, error: checkinResult.error || 'Failed to record scan' },
        { status: 400 }
      );
    }

    // Reflect the check-in that just succeeded, without a second Tito round trip.
    graduate.status = { ...graduate.status, [getStationStatus(stationId as StationId)]: true };
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS (no new warnings/errors in `src/app/api/scan/route.ts`)

- [ ] **Step 7: Manual verification with the dev server**

Run: `npm run dev` (in one terminal), then in another:
```bash
curl -s -X POST http://localhost:3000/api/scan \
  -H 'Content-Type: application/json' \
  -d '{"registrationNumber":"<a real reference or ti_ ticket slug from your Tito event>","stationId":"packing","metadata":{}}' | head -c 2000
```
Expected: A JSON response with `"success":true` and a `"status"` object — confirm it now shows `true` for stations this ticket has genuinely already been checked into (not all-false), which is the enrichment fix from Step 4 working. Use a real (non-final-dispatch) station and a ticket you're comfortable scanning in a test context — this does create a real "packing" check-in for that ticket, same as normal station use, so pick one you don't mind (e.g. re-run against a ticket already packed, which will correctly come back as `"already scanned"`).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/scan/route.ts
git commit -m "Enforce duplicate-dispatch hard block and fix status enrichment in scan API"
```

---

### Task 5: Station page — soft-warn on already-collected, hard-block on already-dispatched

**Files:**
- Modify: `src/app/stations/[stationId]/page.tsx:950-1127` (Last Scanned card, Print button, new warning card)

**Interfaces:**
- Consumes: `lastScanned.status.certificateCollected`, `lastScanned.status.finalDispatched`, `lastScanned.scans`, `lastScanned.trackingNumber`, `lastScanned.dispatchMethod` (all now reliably populated after Task 4).

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "onClick={async () => {" -A 10 "src/app/stations/[stationId]/page.tsx" | head -20`

Expected to find the Print button's `onClick` calling `handlePrintAddressLabel4x6(lastScanned)` in an `else if (station.printType === '4x6-label')` branch, followed by `disabled={currentPrintState === 'printing'}`.

- [ ] **Step 2: Add the confirm-before-print and hard-disable logic to the Print button**

Replace:
```typescript
                    return (
                      <button
                        onClick={async () => {
                          if (station.printType === '4x6-badge') {
                            await handlePrintBadge4x6(lastScanned);
                          } else if (station.printType === '4x6-label') {
                            handlePrintAddressLabel4x6(lastScanned);
                          } else {
                            printLabel(lastScanned, 'packing', printRef.current);
                          }
                        }}
                        disabled={currentPrintState === 'printing'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm transition-all ${
```

With:
```typescript
                    return (
                      <button
                        onClick={async () => {
                          if (station.printType === '4x6-badge') {
                            await handlePrintBadge4x6(lastScanned);
                          } else if (station.printType === '4x6-label') {
                            if (lastScanned.status.certificateCollected) {
                              const collectionScan = lastScanned.scans?.find(
                                (s) => s.station === 'certificate-collection'
                              );
                              const collectionDate = collectionScan
                                ? new Date(collectionScan.timestamp).toLocaleDateString()
                                : null;
                              const proceed = window.confirm(
                                `Dr. ${lastScanned.name} already collected their certificate in person` +
                                  `${collectionDate ? ` on ${collectionDate}` : ''}. Print a mailing label anyway?`
                              );
                              if (!proceed) return;
                            }
                            handlePrintAddressLabel4x6(lastScanned);
                          } else {
                            printLabel(lastScanned, 'packing', printRef.current);
                          }
                        }}
                        disabled={
                          currentPrintState === 'printing' ||
                          (station.printType === '4x6-label' && lastScanned.status.finalDispatched)
                        }
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm transition-all ${
```

- [ ] **Step 3: Confirm the insertion point for the new warning card**

Run: `grep -n "Address Display for Address Label Station" -B 3 "src/app/stations/[stationId]/page.tsx"`

Expected to see the "Last Scanned Graduate Card" `</GlassCard>` immediately above, and the `{/* Address Display for Address Label Station */}` comment below it.

- [ ] **Step 4: Add the persistent "Already Dispatched" warning card**

Replace:
```typescript
          {/* Address Display for Address Label Station */}
          {stationId === 'address-label' && address && lastScanned && (
```

With:
```typescript
          {/* Already Dispatched Warning - hard block, no override in the UI.
              Shown at both stations that touch dispatch: Address Label (where
              it disables the Print button above) and Final Dispatch (where the
              server has already rejected the check-in and this card explains
              why, since the result banner above auto-dismisses after 5s). */}
          {(stationId === 'address-label' || stationId === 'final-dispatch') &&
            lastScanned &&
            lastScanned.status.finalDispatched && (
              <GlassCard className="p-6 border-2 border-red-500/50 bg-red-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-400">Already Dispatched</p>
                    <p className="text-white/70 text-sm mt-1">
                      {lastScanned.trackingNumber
                        ? `Tracking ${lastScanned.trackingNumber}${
                            lastScanned.dispatchMethod ? ` (${lastScanned.dispatchMethod})` : ''
                          }. `
                        : ''}
                      Cannot create a duplicate dispatch record. If this parcel was returned by the
                      courier, use &quot;Mark as Returned&quot; in Admin to allow a resend with a new
                      tracking number.
                    </p>
                  </div>
                </div>
              </GlassCard>
            )}

          {/* Address Display for Address Label Station */}
          {stationId === 'address-label' && address && lastScanned && (
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 7: Manual browser verification**

Run: `npm run dev`, open `http://localhost:3000/stations/address-label`. Scan/search a graduate who has NOT collected their certificate and has NOT been dispatched — confirm the Print button behaves as before (no confirm dialog, no warning card, prints normally). This confirms the new conditionals don't affect the common case.

- [ ] **Step 8: Commit**

```bash
git add "src/app/stations/[stationId]/page.tsx"
git commit -m "Add already-collected warning and already-dispatched hard block to station UI"
```

---

### Task 6: New admin API route — Mark as Returned, Allow Resend

**Files:**
- Create: `src/app/api/admin/mark-returned/route.ts`

**Interfaces:**
- Consumes: `getAirtableDataByConvocationNumber` (`src/lib/airtable.ts`), `markCertificateReturned` (Task 2), `unlockStationForResend`, `clearGraduatesCache` (Task 3, `src/lib/tito.ts:698` for the latter — already exported), `clearAirtableCache` (already exported, `src/lib/airtable.ts:246`).
- Produces: `POST /api/admin/mark-returned` accepting `{ convocationNumber: string, ticketId: number, note?: string }`, returning `{ success: true }` or `{ success: false, error: string }`. Consumed by Task 7.

- [ ] **Step 1: Confirm the directory doesn't already exist**

Run: `ls src/app/api/admin/ 2>&1`
Expected: either "No such file or directory" or a listing that does NOT include `mark-returned` — if it already exists, stop and investigate before overwriting.

- [ ] **Step 2: Create the route**

Create `src/app/api/admin/mark-returned/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { unlockStationForResend, clearGraduatesCache } from '@/lib/tito';
import { getAirtableDataByConvocationNumber, markCertificateReturned, clearAirtableCache } from '@/lib/airtable';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { convocationNumber, ticketId, note } = body;

    if (!convocationNumber || !ticketId) {
      return NextResponse.json(
        { success: false, error: 'convocationNumber and ticketId are required' },
        { status: 400 }
      );
    }

    const airtableResult = await getAirtableDataByConvocationNumber(convocationNumber);
    if (!airtableResult.success || !airtableResult.data) {
      return NextResponse.json(
        { success: false, error: airtableResult.error || 'No Airtable record found for this convocation number' },
        { status: 404 }
      );
    }

    const { airtableRecordId, airtableTableId, trackingNumber } = airtableResult.data;

    if (!trackingNumber) {
      return NextResponse.json(
        { success: false, error: 'This graduate has no tracking number on file — nothing to mark as returned' },
        { status: 400 }
      );
    }

    const markResult = await markCertificateReturned(
      airtableTableId,
      airtableRecordId,
      trackingNumber,
      note
    );
    if (!markResult.success) {
      return NextResponse.json({ success: false, error: markResult.error }, { status: 500 });
    }

    const [finalDispatchResult, addressLabelResult] = await Promise.all([
      unlockStationForResend(ticketId, 'final-dispatch'),
      unlockStationForResend(ticketId, 'address-label'),
    ]);

    if (!finalDispatchResult.success || !addressLabelResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: finalDispatchResult.error || addressLabelResult.error || 'Failed to unlock stations for resend',
        },
        { status: 500 }
      );
    }

    clearGraduatesCache();
    clearAirtableCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Mark Returned] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS — this confirms the new route compiles into the app correctly (a type-check pass alone doesn't catch every Next.js route-shape issue).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/mark-returned/route.ts
git commit -m "Add admin API route to mark a certificate returned and unlock resend"
```

---

### Task 7: Admin UI — "Mark as Returned, Allow Resend" button

**Files:**
- Modify: `src/app/admin/page.tsx` (state declarations near line 82-84, `closeGraduateDetail`, and the Current Status card around line 1734-1769)

**Interfaces:**
- Consumes: `POST /api/admin/mark-returned` (Task 6).

- [ ] **Step 1: Confirm current code matches expected content**

Run: `grep -n "const \[emailResult, setEmailResult\]" -A 2 src/app/admin/page.tsx`

Expected: the line immediately after is the `sidebarCollapsed` state declaration.

- [ ] **Step 2: Add state for the Mark as Returned popover**

Replace:
```typescript
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
```

With:
```typescript
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showMarkReturnedPopover, setShowMarkReturnedPopover] = useState(false);
  const [markReturnedNote, setMarkReturnedNote] = useState('');
  const [markingReturned, setMarkingReturned] = useState(false);
  const [markReturnedResult, setMarkReturnedResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
```

- [ ] **Step 3: Reset the new state in `closeGraduateDetail`**

Replace:
```typescript
  function closeGraduateDetail() {
    setSelectedGraduate(null);
    setGraduateAddress(null);
    setShowEmailModal(false);
    setEmailResult(null);
  }
```

With:
```typescript
  function closeGraduateDetail() {
    setSelectedGraduate(null);
    setGraduateAddress(null);
    setShowEmailModal(false);
    setEmailResult(null);
    setShowMarkReturnedPopover(false);
    setMarkReturnedNote('');
    setMarkReturnedResult(null);
  }
```

- [ ] **Step 4: Add the `handleMarkReturned` handler**

Find the end of `sendEmailToGraduate` (search: `grep -n "setShowEmailModal(false);" -A 3 src/app/admin/page.tsx` — it's followed by the closing `}` of the function and a blank line before `// Get current status text and color for a graduate`).

Replace:
```typescript
    } finally {
      setEmailSending(false);
      setShowEmailModal(false);
    }
  }

  // Get current status text and color for a graduate
```

With:
```typescript
    } finally {
      setEmailSending(false);
      setShowEmailModal(false);
    }
  }

  // Mark a dispatched certificate as returned (RTO) and unlock Address Label
  // + Final Dispatch for a resend with a new tracking number.
  async function handleMarkReturned() {
    if (!selectedGraduate?.convocationNumber || !selectedGraduate.ticketId) return;

    setMarkingReturned(true);
    setMarkReturnedResult(null);

    try {
      const response = await fetch('/api/admin/mark-returned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convocationNumber: selectedGraduate.convocationNumber,
          ticketId: selectedGraduate.ticketId,
          note: markReturnedNote.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMarkReturnedResult({
          success: true,
          message: `Marked as returned. ${selectedGraduate.name} can now be scanned through Address Label and Final Dispatch again.`,
        });
        setShowMarkReturnedPopover(false);
        setMarkReturnedNote('');
        await fetchData();
        closeGraduateDetail();
      } else {
        setMarkReturnedResult({ success: false, message: result.error || 'Failed to mark as returned' });
      }
    } catch (err) {
      console.error('Failed to mark certificate returned:', err);
      setMarkReturnedResult({ success: false, message: 'Failed to mark as returned. Please try again.' });
    } finally {
      setMarkingReturned(false);
    }
  }

  // Get current status text and color for a graduate
```

- [ ] **Step 5: Confirm the button insertion point**

Run: `grep -n "selectedGraduate.status.finalDispatched && selectedGraduate.trackingNumber" -A 6 src/app/admin/page.tsx`

Expected to see the tracking number paragraph inside a `<div className="mt-3 pt-3 border-t border-slate-700/50">` block, closing with `)}` before the "Certificate Journey Timeline" comment further down.

- [ ] **Step 6: Add the "Mark as Returned" button + popover**

Replace:
```typescript
                      {selectedGraduate.status.finalDispatched && selectedGraduate.trackingNumber && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-slate-400 text-sm">
                            {selectedGraduate.dispatchMethod}: <span className="font-mono text-white">{selectedGraduate.trackingNumber}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
```

With:
```typescript
                      {selectedGraduate.status.finalDispatched && selectedGraduate.trackingNumber && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-slate-400 text-sm">
                            {selectedGraduate.dispatchMethod}: <span className="font-mono text-white">{selectedGraduate.trackingNumber}</span>
                          </p>
                          <div className="relative mt-3">
                            <button
                              onClick={() => setShowMarkReturnedPopover(!showMarkReturnedPopover)}
                              disabled={markingReturned}
                              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-400 rounded-lg transition-all text-sm font-medium"
                            >
                              {markingReturned ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                              {markingReturned ? 'Marking as Returned...' : 'Mark as Returned — Allow Resend'}
                            </button>
                            {showMarkReturnedPopover && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded-xl shadow-xl overflow-hidden z-20 p-3 space-y-3 animate-fade-in-up">
                                <p className="text-xs text-slate-300">
                                  This archives tracking <span className="font-mono">{selectedGraduate.trackingNumber}</span> as
                                  the returned attempt and clears it, so the next Final Dispatch entry requires a genuinely new
                                  tracking number. Confirm the parcel actually came back before doing this.
                                </p>
                                <textarea
                                  value={markReturnedNote}
                                  onChange={(e) => setMarkReturnedNote(e.target.value)}
                                  placeholder="Optional note (e.g. bad address, refused delivery)"
                                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-red-500"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setShowMarkReturnedPopover(false)}
                                    className="flex-1 py-2 px-3 bg-slate-600/50 hover:bg-slate-600 text-white rounded-lg text-sm"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleMarkReturned}
                                    className="flex-1 py-2 px-3 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                                  >
                                    Confirm Return
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {markReturnedResult && (
                        <div
                          className={`mt-3 pt-3 border-t border-slate-700/50 text-sm ${
                            markReturnedResult.success ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {markReturnedResult.message}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 10: Manual QA — read this before running**

This is the first point where the full chain (including the destructive `deleteCheckin`) can run end to end. Do this deliberately, not as a quick sanity check:

1. `npm run dev`, open `/admin`, pick ONE real graduate who is already fully dispatched (`status.finalDispatched: true`) and whom you're comfortable using for a real test (ideally a known test/dummy ticket in the Tito event, if one exists — ask before using a real graduate's record).
2. Open their detail panel, confirm the tracking number now actually displays (this alone confirms Task 3 Step 2's `mergeWithAirtableData` fix is working — it didn't before this plan).
3. Click "Mark as Returned — Allow Resend", add a note, confirm.
4. Verify in Airtable directly: `RTO` is checked, `old Tracking Number` holds the value that was in `Tracking Number`, `Tracking Number` is now blank, and the reason note landed in `reason for RTO` (FMAS) or `RTO Remarks` (MMAS).
5. Back in the app, go to `/stations/address-label`, scan/search that same graduate — confirm the Print button is enabled again and no "Already Dispatched" warning shows (proves the Tito check-in deletion worked).
6. Go to `/stations/final-dispatch`, enter a new tracking number, scan/search that graduate again — confirm it succeeds (not blocked).
7. Separately, confirm the two safeguards this plan set out to build: at `/stations/address-label`, scan someone with `certificateCollected: true` and click Print — confirm the browser `confirm()` dialog appears with their name and collection date. At `/stations/address-label` or `/stations/final-dispatch`, scan someone already `finalDispatched: true` (before doing anything about them) — confirm the block message and disabled Print button, and confirm `/api/scan` returns `success: false` without creating a new check-in (check the Tito checkin list in the Tito dashboard, or re-check via `/api/search`, to confirm the count didn't change).

- [ ] **Step 11: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "Add Mark as Returned admin UI"
```
