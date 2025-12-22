import { NextRequest, NextResponse } from 'next/server';
import { getCheckinLists, searchRegistrations, createCheckin } from '@/lib/tito';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (query) {
      const result = await searchRegistrations(query);
      return NextResponse.json(result);
    }

    const result = await getCheckinLists();
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
    const { checkinListSlug, ticketSlug } = body;

    if (!checkinListSlug || !ticketSlug) {
      return NextResponse.json(
        { success: false, error: 'Check-in list slug and ticket slug are required' },
        { status: 400 }
      );
    }

    const result = await createCheckin(checkinListSlug, ticketSlug);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Tito API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create check-in' },
      { status: 500 }
    );
  }
}
