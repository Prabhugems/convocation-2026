import { NextRequest, NextResponse } from 'next/server';
import { getCheckins, searchCheckins, checkInGuest } from '@/lib/tito';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (query) {
      const result = await searchCheckins(query);
      return NextResponse.json(result);
    }

    const result = await getCheckins();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Tito API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch check-ins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { checkinId } = body;

    if (!checkinId) {
      return NextResponse.json(
        { success: false, error: 'Check-in ID is required' },
        { status: 400 }
      );
    }

    const result = await checkInGuest(checkinId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Tito API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check in guest' },
      { status: 500 }
    );
  }
}
