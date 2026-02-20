import { NextRequest, NextResponse } from 'next/server';
import { voidRfidTag } from '@/lib/rfid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epc, reason, voidedBy } = body;

    if (!epc || !reason || !voidedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: epc, reason, voidedBy' },
        { status: 400 }
      );
    }

    const result = await voidRfidTag(
      epc.toUpperCase().trim(),
      reason.trim(),
      voidedBy.trim()
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[RFID Void] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
