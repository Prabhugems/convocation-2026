import { NextRequest, NextResponse } from 'next/server';
import { getReconciliationForStation } from '@/lib/rfid';
import { RfidStation } from '@/types/rfid';

const VALID_STATIONS: RfidStation[] = [
  'encoding',
  'packing',
  'dispatch-venue',
  'registration',
  'gown-issue',
  'gown-return',
  'certificate-collection',
  'return-ho',
  'address-label',
  'final-dispatch',
  'handover',
];

export async function GET(request: NextRequest) {
  try {
    const station = request.nextUrl.searchParams.get('station');

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: station' },
        { status: 400 }
      );
    }

    if (!VALID_STATIONS.includes(station as RfidStation)) {
      return NextResponse.json(
        { success: false, error: `Invalid station: ${station}` },
        { status: 400 }
      );
    }

    const result = await getReconciliationForStation(station as RfidStation);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[RFID Reconciliation] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
