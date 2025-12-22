import { NextRequest, NextResponse } from 'next/server';
import { searchTickets, ticketToGraduate } from '@/lib/tito';
import { getAirtableDataMap } from '@/lib/airtable';

// Server-side Tito search - avoids CORS issues
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    console.log(`[Tito Search API] Searching for: ${query}`);

    // Call Tito API from server
    const result = await searchTickets(query);

    if (!result.success || !result.data) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Search failed',
      });
    }

    // Get Airtable data for merging
    const airtableResult = await getAirtableDataMap();
    const airtableMap = airtableResult.success && airtableResult.data
      ? airtableResult.data
      : new Map();

    // Convert tickets to graduates and merge with Airtable
    const graduates = result.data.map(ticket => {
      const graduate = ticketToGraduate(ticket);

      // Merge with Airtable data
      if (graduate.convocationNumber) {
        const airtableData = airtableMap.get(graduate.convocationNumber);
        if (airtableData) {
          return {
            ...graduate,
            phone: graduate.phone || airtableData.mobile,
            address: airtableData.address.line1 ? airtableData.address : graduate.address,
          };
        }
      }

      return graduate;
    });

    console.log(`[Tito Search API] Found ${graduates.length} results`);

    return NextResponse.json({
      success: true,
      data: graduates,
      count: graduates.length,
    });
  } catch (error) {
    console.error('[Tito Search API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
