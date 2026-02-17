import { NextResponse } from 'next/server';
import { getRfidDashboardStats, clearRfidCache } from '@/lib/rfid';

export async function GET() {
  try {
    const result = await getRfidDashboardStats();

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
    console.error('[RFID Dashboard] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Force refresh cache
export async function POST() {
  try {
    clearRfidCache();
    const result = await getRfidDashboardStats();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Cache refreshed',
    });
  } catch (error) {
    console.error('[RFID Dashboard Refresh] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
