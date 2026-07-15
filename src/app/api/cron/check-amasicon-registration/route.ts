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

// Sized to comfortably finish both tables inside `maxDuration` (300s).
// Two tables run sequentially in one invocation, so budget ~280s of
// usable time (20s margin for cold start / Airtable list latency etc.),
// or ~140s per table. Each record costs ~1.1s for the rate-limited
// AMASICON API call plus ~0.2-0.3s for the awaited Airtable PATCH,
// i.e. ~1.3-1.4s/record. 140s / 1.4s ≈ 100 records/table/run.
// This is a bounded, resumable batch job (oldest-unchecked records are
// processed first via `AMASICON Last Checked` sorting), so a smaller
// batch just means more daily runs to clear a backlog — no lost progress.
const DEFAULT_BATCH_LIMIT = 100;

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
