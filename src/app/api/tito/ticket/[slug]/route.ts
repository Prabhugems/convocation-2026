import { NextRequest, NextResponse } from 'next/server';
import { getTicketBySlug, ticketToGraduate } from '@/lib/tito';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';

// Server-side Tito ticket lookup - avoids CORS issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Ticket slug is required' },
        { status: 400 }
      );
    }

    console.log(`[Tito Ticket API] Looking up: ${slug}`);

    // Call Tito API from server
    const result = await getTicketBySlug(slug);

    if (!result.success || !result.data) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Ticket not found',
      });
    }

    // Convert to graduate format
    const graduate = ticketToGraduate(result.data);

    // Merge with Airtable data if available
    if (graduate.convocationNumber) {
      const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
      if (airtableResult.success && airtableResult.data) {
        return NextResponse.json({
          success: true,
          data: {
            ...graduate,
            phone: graduate.phone || airtableResult.data.mobile,
            address: airtableResult.data.address.line1
              ? airtableResult.data.address
              : graduate.address,
          },
        });
      }
    }

    console.log(`[Tito Ticket API] Found: ${graduate.name}`);

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('[Tito Ticket API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}
