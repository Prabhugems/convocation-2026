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

// Upper bound on how many records are ever attempted per table per run.
// This is *not* the safety mechanism against exceeding `maxDuration` —
// per-record latency (AMASICON API call + Airtable PATCH) is an estimate,
// not a guarantee, so batch size alone can't be trusted to keep a run
// under the time limit. The actual safety guarantee is the wall-clock
// cutoff (`PER_TABLE_TIME_BUDGET_MS`) enforced inside `checkTable`'s loop,
// which bails out of a table's batch once its time budget is spent,
// regardless of how far through `limit` it got. This is a bounded,
// resumable batch job (oldest-unchecked records are processed first via
// `AMASICON Last Checked` sorting), so stopping early just means more
// daily runs to clear a backlog — no lost progress.
const DEFAULT_BATCH_LIMIT = 100;

// Two tables run sequentially within `maxDuration` (300s). Give each
// table a wall-clock budget well under half of that, leaving real margin
// (~40s total) for the two `fetchUnconfirmedForRegistrationCheck` list
// calls, cold start, and Vercel's own overhead. This bounds total runtime
// deterministically — it doesn't depend on assumptions about per-record
// Airtable/AMASICON latency.
const PER_TABLE_TIME_BUDGET_MS = 130_000;

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

  const startTime = Date.now();

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
    if (Date.now() - startTime >= PER_TABLE_TIME_BUDGET_MS) {
      console.warn(
        `[Cron] Time budget exceeded checking ${label}, stopping this table's batch early`
      );
      break;
    }

    if (!record.email) {
      // No email to check against — stamp so it cycles to the back of
      // the queue instead of being retried every run.
      const updateResult = await updateRegistrationCheckResult(
        tableId,
        record.id,
        false
      );
      if (updateResult.success) {
        summary.checked++;
      } else {
        console.error(
          `[Cron] Failed to update ${label} record ${record.id}:`,
          updateResult.error
        );
        summary.errors++;
      }
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
    const updateResult = await updateRegistrationCheckResult(
      tableId,
      record.id,
      matched
    );

    if (updateResult.success) {
      summary.checked++;
      if (matched) {
        summary.newlyMatched++;
      }
    } else {
      console.error(
        `[Cron] Failed to update ${label} record ${record.id}:`,
        updateResult.error
      );
      summary.errors++;
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
