# AMASICON Registration Check Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the daily check of Master-FMAS and Master-MMAS Airtable records against the live AMASICON registration API, so the "Registered for AMASICON" checkbox stays current without a manual export, and the certificate dispatch team can trust it.

**Architecture:** A new Vercel Cron route (`/api/cron/check-amasicon-registration`) runs daily. For each of the two Airtable tables it pulls a bounded, oldest-checked-first batch of unconfirmed records, calls the public `delegate-by-email` API (paced under its 60/min limit) for each, and writes back the match result plus a "last checked" timestamp so the next run picks up where this one left off.

**Tech Stack:** Next.js 16 (App Router) API routes, TypeScript, Airtable REST API (`https://api.airtable.com/v0`), the AMASICON delegate-by-email API (`https://app.amasicon2026.com/api/delegate-by-email`), Vercel Cron.

## Global Constraints

- No test framework is configured in this repo (`package.json` has no test runner, and the existing `check-deliveries` cron route also has no automated tests). Every "verify" step below is a manual, real-API check — not an automated test suite. Do not add a test framework as part of this plan.
- The AMASICON delegate-by-email API needs no auth, but must be called no faster than **60 requests/minute** — pace client calls at least 1100ms apart.
- Never set `Registered for AMASICON` back to `false` — only ever set it to `true` on a match. Leave it untouched otherwise.
- Reuse the existing `AIRTABLE_FMAS_TABLE` (`tbl9CuIgSFdoNVk9x`) and `AIRTABLE_MMAS_TABLE` (`tblBXE3iZGd9zHbKo`) env vars already in `.env.local` — do not introduce new table-ID env vars.
- Follow the existing `src/app/api/cron/check-deliveries/route.ts` pattern for auth (`CRON_SECRET` bearer header, optional) and response shape (JSON summary).
- Deploying to Vercel and adding production env vars are shared-system actions — confirm with the user before running `vercel deploy` / `vercel env add` in Task 5.

---

### Task 1: Add "AMASICON Last Checked" field to Master-FMAS and Master-MMAS

**Files:** None (Airtable schema change via the Airtable MCP tool, not repo code).

**Interfaces:**
- Produces: a `dateTime` field named exactly `AMASICON Last Checked` on both `tbl9CuIgSFdoNVk9x` (Master-FMAS) and `tblBXE3iZGd9zHbKo` (Master-MMAS) in base `app7TElm0QUruBlZr`. Later tasks read/write this field by name.

- [ ] **Step 1: Create the field on Master-FMAS**

Call the Airtable MCP tool (same tool used earlier in this project to add the "Registered for AMASICON" checkbox field):

```
mcp__claude_ai_Airtable__create_field
baseId: "app7TElm0QUruBlZr"
tableId: "tbl9CuIgSFdoNVk9x"
field: {
  "name": "AMASICON Last Checked",
  "type": "dateTime",
  "options": {
    "dateFormat": { "name": "iso" },
    "timeFormat": { "name": "24hour" },
    "timeZone": "Asia/Kolkata"
  }
}
```

- [ ] **Step 2: Create the same field on Master-MMAS**

```
mcp__claude_ai_Airtable__create_field
baseId: "app7TElm0QUruBlZr"
tableId: "tblBXE3iZGd9zHbKo"
field: {
  "name": "AMASICON Last Checked",
  "type": "dateTime",
  "options": {
    "dateFormat": { "name": "iso" },
    "timeFormat": { "name": "24hour" },
    "timeZone": "Asia/Kolkata"
  }
}
```

- [ ] **Step 3: Verify both fields exist**

Call `mcp__claude_ai_Airtable__list_tables_for_base` with `baseId: "app7TElm0QUruBlZr"` and confirm both `tbl9CuIgSFdoNVk9x` and `tblBXE3iZGd9zHbKo` now list a field named `AMASICON Last Checked` of type `dateTime`.

Expected: both fields present, both `dateTime`.

No commit needed — this step changes Airtable schema only, not repo files.

---

### Task 2: AMASICON delegate-by-email API client

**Files:**
- Create: `src/lib/amasiconRegistration.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (talks directly to `https://app.amasicon2026.com`).
- Produces: `checkDelegateByEmail(email: string): Promise<{ userExists: boolean; isPaymentCompleted: boolean } | null>` — `null` means an ordinary request failure (network error or non-2xx, non-429 response) and the caller should treat this delegate as "not checked, retry later." Throws `RateLimitedError` (also exported) specifically on HTTP 429, so the caller can stop the batch early. Task 4 imports both.

- [ ] **Step 1: Write the client**

```typescript
// src/lib/amasiconRegistration.ts

const AMASICON_API_BASE_URL =
  process.env.AMASICON_API_BASE_URL || 'https://app.amasicon2026.com';

// Stay comfortably under the API's documented 60 requests/minute limit.
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
    );
  }
  lastRequestAt = Date.now();
}

export interface DelegateRegistrationStatus {
  userExists: boolean;
  isPaymentCompleted: boolean;
}

// Thrown specifically when the API signals we've been rate-limited, so
// callers can stop the whole batch early instead of continuing to fail.
export class RateLimitedError extends Error {}

// Checks whether an email belongs to a registered, paid AMASICON 2026
// delegate. Returns null (not false) on an ordinary request failure, so
// callers can distinguish "confirmed not registered" from "couldn't
// check." Throws RateLimitedError on HTTP 429 specifically.
export async function checkDelegateByEmail(
  email: string
): Promise<DelegateRegistrationStatus | null> {
  await waitForRateLimit();

  const url = `${AMASICON_API_BASE_URL}/api/delegate-by-email?email=${encodeURIComponent(
    email
  )}`;

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET' });
  } catch (error) {
    console.error(`[AMASICON API] Network error for ${email}:`, error);
    return null;
  }

  if (response.status === 429) {
    throw new RateLimitedError(`Rate limited checking ${email}`);
  }

  if (!response.ok) {
    console.error(`[AMASICON API] ${response.status} for ${email}`);
    return null;
  }

  const data = await response.json();
  return {
    userExists: Boolean(data.user_exists),
    isPaymentCompleted: Boolean(data.is_payment_completed),
  };
}
```

- [ ] **Step 2: Confirm the response shape against the real API**

This mirrors the exact contract already confirmed live during design (see `docs/superpowers/specs/2026-07-15-amasicon-registration-cron-design.md`). Re-confirm it hasn't changed:

Run:
```bash
curl -s "https://app.amasicon2026.com/api/delegate-by-email?email=drsujaypal@gmail.com"
```

Expected: `{"status":true,"user_exists":true,"is_payment_completed":true}` — a known paid Master-FMAS delegate.

Run:
```bash
curl -s "https://app.amasicon2026.com/api/delegate-by-email?email=nonexistent-test-address@example.com"
```

Expected: `{"status":false,"user_exists":false,"is_payment_completed":false}`.

If either response shape differs from what Step 1's code expects (`user_exists`, `is_payment_completed` keys), update the client to match before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amasiconRegistration.ts
git commit -m "Add AMASICON delegate-by-email API client"
```

---

### Task 3: Airtable helpers for the registration check batch

**Files:**
- Modify: `src/types/index.ts` (extend `AirtableRecord['fields']`)
- Modify: `src/lib/airtable.ts` (add two exported functions)

**Interfaces:**
- Consumes: the private `airtableFetch<T>(tableId, endpoint, options)` function already defined in `src/lib/airtable.ts` (top of file).
- Produces:
  - `fetchUnconfirmedForRegistrationCheck(tableId: string, limit: number): Promise<ApiResponse<{ id: string; email: string }[]>>`
  - `updateRegistrationCheckResult(tableId: string, recordId: string, matched: boolean): Promise<ApiResponse<void>>`

  Task 4 imports both.

- [ ] **Step 1: Extend the shared Airtable field types**

In `src/types/index.ts`, find the `AirtableRecord` interface (around line 123) and add two optional fields at the end of its `fields` object, right after `'Form A'?: string;`:

```typescript
    'Form A'?: string; // Fillout form URL for address update
    'Registered for AMASICON'?: boolean;
    'AMASICON Last Checked'?: string;
  };
}
```

(This replaces the existing closing `};\n}` of the interface — the two new lines go directly before them.)

- [ ] **Step 2: Add the two helper functions to `src/lib/airtable.ts`**

Add this to the end of `src/lib/airtable.ts` (after the existing `getRecordByEmail` function):

```typescript
export interface UnconfirmedRegistrationRecord {
  id: string;
  email: string;
}

// Fetch a batch of records not yet confirmed as "Registered for AMASICON",
// oldest-checked (or never-checked) first, so a bounded daily batch makes
// steady progress through the whole unconfirmed pool over multiple runs.
export async function fetchUnconfirmedForRegistrationCheck(
  tableId: string,
  limit: number
): Promise<ApiResponse<UnconfirmedRegistrationRecord[]>> {
  const params = new URLSearchParams();
  params.set('maxRecords', String(limit));
  params.set('filterByFormula', 'NOT({Registered for AMASICON})');
  params.append('fields[]', 'Email');
  params.append('sort[0][field]', 'AMASICON Last Checked');
  params.append('sort[0][direction]', 'asc');

  const response = await airtableFetch<{ records: AirtableRecord[] }>(
    tableId,
    `?${params.toString()}`
  );

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error || 'Failed to fetch unconfirmed records',
    };
  }

  const records = response.data.records.map((record) => ({
    id: record.id,
    email: (record.fields['Email'] || '').trim(),
  }));

  return { success: true, data: records };
}

// Stamps a record's registration check result: always updates
// "AMASICON Last Checked" to now, and sets "Registered for AMASICON" to
// true only when matched. Never unsets an existing true value.
export async function updateRegistrationCheckResult(
  tableId: string,
  recordId: string,
  matched: boolean
): Promise<ApiResponse<void>> {
  const fields: Record<string, unknown> = {
    'AMASICON Last Checked': new Date().toISOString(),
  };

  if (matched) {
    fields['Registered for AMASICON'] = true;
  }

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

- [ ] **Step 3: Verify the query shape against real Airtable data**

Run (reads the API key from `.env.local` without printing it):

```bash
source <(grep -E '^AIRTABLE_API_KEY=|^AIRTABLE_MMAS_TABLE=' .env.local)
curl -s -G "https://api.airtable.com/v0/app7TElm0QUruBlZr/${AIRTABLE_MMAS_TABLE}" \
  -H "Authorization: Bearer ${AIRTABLE_API_KEY}" \
  --data-urlencode "maxRecords=3" \
  --data-urlencode "filterByFormula=NOT({Registered for AMASICON})" \
  --data-urlencode "fields[]=Email" \
  --data-urlencode "sort[0][field]=AMASICON Last Checked" \
  --data-urlencode "sort[0][direction]=asc"
```

Expected: a JSON object with a `records` array of up to 3 records, each with an `id` and `fields.Email`, and none of them already `true` for `Registered for AMASICON`.

- [ ] **Step 4: Verify the update shape against a known real, unmatched record**

Use `rec0COCysFHJTw7Gl` (Saikh Kasif Sahajada, Master-MMAS — confirmed earlier in this project as *not* a registration match, so this only exercises the "stamp, don't check" path and is safe to run against production data):

```bash
source <(grep -E '^AIRTABLE_API_KEY=|^AIRTABLE_MMAS_TABLE=' .env.local)
curl -s -X PATCH "https://api.airtable.com/v0/app7TElm0QUruBlZr/${AIRTABLE_MMAS_TABLE}/rec0COCysFHJTw7Gl" \
  -H "Authorization: Bearer ${AIRTABLE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"AMASICON Last Checked": "2026-07-15T00:00:00.000Z"}}'
```

Expected: `200 OK` with the record's `fields` showing `"AMASICON Last Checked": "2026-07-15T00:00:00.000Z"` and no `Registered for AMASICON` key added (since `matched` was not sent as `true`).

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/airtable.ts
git commit -m "Add Airtable helpers for AMASICON registration check batching"
```

---

### Task 4: Cron route wiring it all together

**Files:**
- Create: `src/app/api/cron/check-amasicon-registration/route.ts`

**Interfaces:**
- Consumes: `checkDelegateByEmail` and `RateLimitedError` from `src/lib/amasiconRegistration.ts` (Task 2); `fetchUnconfirmedForRegistrationCheck` and `updateRegistrationCheckResult` from `src/lib/airtable.ts` (Task 3).
- Produces: `GET /api/cron/check-amasicon-registration` — the deployable cron endpoint. Task 5's `vercel.json` schedules calls to this path.

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cron/check-amasicon-registration/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  checkDelegateByEmail,
  RateLimitedError,
} from '@/lib/amasiconRegistration';
import {
  fetchUnconfirmedForRegistrationCheck,
  updateRegistrationCheckResult,
} from '@/lib/airtable';

export const maxDuration = 300;

const DEFAULT_BATCH_LIMIT = 250;

interface TableCheckSummary {
  table: string;
  checked: number;
  newlyMatched: number;
  errors: number;
}

async function checkTable(
  label: string,
  tableId: string,
  limit: number
): Promise<TableCheckSummary> {
  const summary: TableCheckSummary = {
    table: label,
    checked: 0,
    newlyMatched: 0,
    errors: 0,
  };

  const batchResult = await fetchUnconfirmedForRegistrationCheck(
    tableId,
    limit
  );

  if (!batchResult.success || !batchResult.data) {
    console.error(
      `[Cron] Failed to fetch unconfirmed ${label} records:`,
      batchResult.error
    );
    summary.errors++;
    return summary;
  }

  for (const record of batchResult.data) {
    if (!record.email) {
      // No email to check against — stamp so it cycles to the back of
      // the queue instead of being retried every run.
      await updateRegistrationCheckResult(tableId, record.id, false);
      summary.checked++;
      continue;
    }

    let status: Awaited<ReturnType<typeof checkDelegateByEmail>>;
    try {
      status = await checkDelegateByEmail(record.email);
    } catch (error) {
      if (error instanceof RateLimitedError) {
        console.warn(
          `[Cron] Rate limited checking ${label}, stopping this table's batch early`
        );
        break;
      }
      summary.errors++;
      continue;
    }

    if (status === null) {
      // Request failed — leave unstamped so it's retried next run.
      summary.errors++;
      continue;
    }

    const matched = status.userExists && status.isPaymentCompleted;
    await updateRegistrationCheckResult(tableId, record.id, matched);

    summary.checked++;
    if (matched) {
      summary.newlyMatched++;
    }
  }

  return summary;
}

/**
 * GET /api/cron/check-amasicon-registration
 *
 * Cron job endpoint to check Master-FMAS and Master-MMAS delegates
 * against the AMASICON registration system and flag matches as
 * "Registered for AMASICON" for certificate dispatch.
 *
 * Set up with Vercel Cron — see vercel.json.
 *
 * Optional ?limit= query param overrides the per-table batch size
 * (useful for manual testing with a small batch).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : DEFAULT_BATCH_LIMIT;

  const fmasTableId = process.env.AIRTABLE_FMAS_TABLE;
  const mmasTableId = process.env.AIRTABLE_MMAS_TABLE;

  if (!fmasTableId) {
    return NextResponse.json(
      { success: false, error: 'AIRTABLE_FMAS_TABLE not configured' },
      { status: 500 }
    );
  }

  console.log(`[Cron] Starting AMASICON registration check (limit=${limit})...`);

  const results: TableCheckSummary[] = [];
  results.push(await checkTable('Master-FMAS', fmasTableId, limit));

  if (mmasTableId) {
    results.push(await checkTable('Master-MMAS', mmasTableId, limit));
  }

  console.log('[Cron] AMASICON registration check complete:', results);

  return NextResponse.json({ success: true, results });
}
```

- [ ] **Step 2: Verify locally against real data with a small batch**

Start the dev server:
```bash
npm run dev
```

In another terminal (no `CRON_SECRET` is set in `.env.local`, so no auth header is needed locally):
```bash
curl -s "http://localhost:3000/api/cron/check-amasicon-registration?limit=2"
```

Expected: HTTP 200 with JSON like:
```json
{
  "success": true,
  "results": [
    { "table": "Master-FMAS", "checked": 2, "newlyMatched": 0, "errors": 0 },
    { "table": "Master-MMAS", "checked": 2, "newlyMatched": 0, "errors": 0 }
  ]
}
```
(`newlyMatched` counts may vary — that's fine, it depends on which records were oldest-checked.)

- [ ] **Step 3: Confirm the 4 touched records were actually stamped in Airtable**

```bash
source <(grep -E '^AIRTABLE_API_KEY=|^AIRTABLE_FMAS_TABLE=' .env.local)
curl -s -G "https://api.airtable.com/v0/app7TElm0QUruBlZr/${AIRTABLE_FMAS_TABLE}" \
  -H "Authorization: Bearer ${AIRTABLE_API_KEY}" \
  --data-urlencode "maxRecords=2" \
  --data-urlencode "fields[]=AMASICON Last Checked" \
  --data-urlencode "sort[0][field]=AMASICON Last Checked" \
  --data-urlencode "sort[0][direction]=desc"
```

Expected: the 2 most-recently-stamped Master-FMAS records show an `AMASICON Last Checked` timestamp from just now (Step 2's run).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/check-amasicon-registration/route.ts
git commit -m "Add daily AMASICON registration check cron route"
```

---

### Task 5: Schedule the cron and wire up production config

**Files:**
- Create: `vercel.json`
- Modify: `.env.local` (add `AMASICON_API_BASE_URL`)

**Interfaces:**
- Consumes: the route from Task 4 (`/api/cron/check-amasicon-registration`).
- Produces: nothing further consumed by other tasks — this is the deployment/scheduling step.

- [ ] **Step 1: Add the env var locally**

Append to `.env.local`:
```
AMASICON_API_BASE_URL=https://app.amasicon2026.com
```

(This matches the default already hardcoded as a fallback in `src/lib/amasiconRegistration.ts`, so local dev works even without this line — but set it explicitly for clarity and so production config mirrors local.)

- [ ] **Step 2: Create `vercel.json`**

This repo has no `vercel.json` yet. Create one scoped to just this new cron (do not add unrelated cron entries for other routes without separately confirming with the user whether they're already scheduled elsewhere):

```json
{
  "crons": [
    {
      "path": "/api/cron/check-amasicon-registration",
      "schedule": "30 20 * * *"
    }
  ]
}
```

(`30 20 * * *` = 20:30 UTC = 02:00 IST daily.)

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.local
git commit -m "Schedule daily AMASICON registration check via Vercel Cron"
```

- [ ] **Step 4: Confirm with the user before deploying**

Adding a production env var and deploying are shared-system actions. Before running `vercel env add AMASICON_API_BASE_URL production` or deploying, stop and confirm with the user:
- That `AMASICON_API_BASE_URL=https://app.amasicon2026.com` should be added to the Vercel project's production environment.
- That the 02:00 IST daily schedule is acceptable (or get a preferred time).
- That they're ready to deploy (this will start the cron running against the ~1384-record backlog described in the design spec).

Do not run `vercel env add` or `vercel deploy` / `git push` until the user explicitly confirms.
