import { NextRequest, NextResponse } from 'next/server';
import { processRfidBulkScan } from '@/lib/rfid';
import { RfidStation } from '@/types/rfid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epcs, station, scannedBy, action, notes } = body;

    if (!epcs || !Array.isArray(epcs) || epcs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'epcs array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'station is required' },
        { status: 400 }
      );
    }

    if (!scannedBy) {
      return NextResponse.json(
        { success: false, error: 'scannedBy is required' },
        { status: 400 }
      );
    }

    // Limit bulk scan to 100 items to avoid timeouts
    if (epcs.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 EPCs per bulk scan' },
        { status: 400 }
      );
    }

    console.log(
      `[RFID Bulk Scan] Processing ${epcs.length} tags at station ${station} by ${scannedBy}`
    );

    const result = await processRfidBulkScan(
      epcs as string[],
      station as RfidStation,
      scannedBy as string,
      action as string | undefined,
      notes as string | undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    console.log(
      `[RFID Bulk Scan] Complete: ${result.data!.summary.successful}/${result.data!.summary.total} successful, ${result.data!.summary.titoCheckins} Tito check-ins`
    );

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[RFID Bulk Scan] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
