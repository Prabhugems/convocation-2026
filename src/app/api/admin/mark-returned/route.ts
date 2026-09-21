import { NextRequest, NextResponse } from 'next/server';
import { unlockStationForResend, clearGraduatesCache } from '@/lib/tito';
import { getAirtableDataByConvocationNumber, markCertificateReturned, clearAirtableCache } from '@/lib/airtable';
import { ADMIN_ACTION_PASSCODE } from '@/lib/adminPasscode';

export async function POST(request: NextRequest) {
  try {
    const passcode = request.headers.get('x-admin-passcode');
    if (passcode !== ADMIN_ACTION_PASSCODE) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { convocationNumber, ticketId, note } = body;

    if (!convocationNumber || typeof ticketId !== 'number' || !ticketId) {
      return NextResponse.json(
        { success: false, error: 'convocationNumber and a numeric ticketId are required' },
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

    const { airtableRecordId, airtableTableId, trackingNumber, rto } = airtableResult.data;

    if (!trackingNumber && !rto) {
      return NextResponse.json(
        { success: false, error: 'This graduate has no tracking number on file — nothing to mark as returned' },
        { status: 400 }
      );
    }

    // A fresh request has a tracking number to archive; a retry of a stuck
    // prior attempt (Airtable already updated, Tito unlock never completed)
    // has rto=true and an already-blank tracking number instead. Only the
    // fresh case writes to Airtable — retrying must not re-run this, or it
    // would overwrite the already-archived old number with an empty string.
    const isFreshAttempt = !!trackingNumber;

    if (isFreshAttempt) {
      // Write to Airtable BEFORE unlocking Tito. This closes a race where a
      // graduate could be re-scanned and a label reprinted with the still-
      // live old tracking number in the moment between a Tito unlock and
      // this write.
      const markResult = await markCertificateReturned(airtableTableId, airtableRecordId, trackingNumber, note);
      if (!markResult.success) {
        return NextResponse.json({ success: false, error: markResult.error }, { status: 500 });
      }

      // Clear the Airtable cache the moment the write succeeds, not only at
      // the very end — every return path below this point (including the
      // error ones) must see the just-written data on a retry, or a retry
      // would re-read the stale pre-write record and incorrectly treat
      // itself as a fresh attempt again (re-running this write, then
      // re-arming the anomaly check below against a station that was
      // already unlocked).
      clearAirtableCache();
    }

    // A dispatched graduate's check-in lives in exactly one of these two
    // stations depending on courier — DTDC via 'final-dispatch', India Post
    // via 'dispatch-india-post' — never both. Unlock both unconditionally;
    // whichever one the graduate never used simply has nothing to delete.
    const [finalDispatchResult, indiaPostResult, addressLabelResult] = await Promise.all([
      unlockStationForResend(ticketId, 'final-dispatch'),
      unlockStationForResend(ticketId, 'dispatch-india-post'),
      unlockStationForResend(ticketId, 'address-label'),
    ]);

    if (!finalDispatchResult.success || !indiaPostResult.success || !addressLabelResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: `final-dispatch: ${finalDispatchResult.error || 'ok'}; dispatch-india-post: ${indiaPostResult.error || 'ok'}; address-label: ${addressLabelResult.error || 'ok'}`,
        },
        { status: 500 }
      );
    }

    // Clear the Tito-derived status cache the moment the unlocks succeed,
    // for the same reason as above — the admin list and any retry should
    // see the newly-unlocked station(s) immediately, not after the
    // anomaly check below (which can still return an error response).
    clearGraduatesCache();

    // On a fresh attempt, address-label should have had a check-in to
    // delete, and exactly one of final-dispatch/dispatch-india-post should
    // have too (whichever courier this graduate actually used) — if
    // address-label found nothing, or NEITHER dispatch station found
    // anything, that's an anomaly (Tito may be lagging or erroring), not
    // silent success. Airtable has already been updated at this point, so
    // this is now a retryable stuck state, not a lost cause: calling this
    // route again will skip the Airtable write above (isFreshAttempt will
    // be false) and just retry these unlocks. On a retry, a deleted:false
    // result is expected for whichever station(s) already got unlocked on
    // the prior attempt, so it's not flagged here.
    const dispatchStationHadCheckin =
      finalDispatchResult.data?.deleted === true || indiaPostResult.data?.deleted === true;
    if (isFreshAttempt && (!dispatchStationHadCheckin || addressLabelResult.data?.deleted === false)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expected an existing check-in to unlock but found none for at least one station. Airtable has already been updated — try again in a moment to retry unlocking Tito.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Mark Returned] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
