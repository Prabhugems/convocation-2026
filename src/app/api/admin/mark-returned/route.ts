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
