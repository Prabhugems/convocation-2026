import { NextRequest, NextResponse } from 'next/server';
import { universalSearch, getTicketBySlug, ticketToGraduate } from '@/lib/tito';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';

// Extract ticket slug from various URL formats
function extractTicketSlug(input: string): string | null {
  const trimmed = input.trim();

  // Direct slug: ti_xxxxx
  if (trimmed.startsWith('ti_')) {
    return trimmed.split(/[\s\?#]/)[0];
  }

  // URL formats: https://ti.to/tickets/ti_xxxxx
  const slugMatch = trimmed.match(/ti_[a-zA-Z0-9]+/);
  if (slugMatch) {
    return slugMatch[0];
  }

  return null;
}

/**
 * GET /api/print/lookup
 *
 * Look up a registration for badge printing
 * Query params:
 * - code: Ticket slug, QR code, convocation number, or registration ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'Code is required'
      }, { status: 400 });
    }

    console.log(`[Print Lookup] Looking up: ${code}`);

    // Try to extract ticket slug first
    const ticketSlug = extractTicketSlug(code);

    if (ticketSlug) {
      console.log(`[Print Lookup] Detected ticket slug: ${ticketSlug}`);

      const ticketResult = await getTicketBySlug(ticketSlug);

      if (ticketResult.success && ticketResult.data) {
        const graduate = ticketToGraduate(ticketResult.data);

        // Enrich with Airtable data
        let enrichedData = graduate;
        if (graduate.convocationNumber) {
          const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
          if (airtableResult.success && airtableResult.data) {
            enrichedData = {
              ...graduate,
              name: airtableResult.data.name || graduate.name,
            };
          }
        }

        return NextResponse.json({
          success: true,
          badge: {
            name: enrichedData.name,
            degree: enrichedData.course || '',
            institution: '', // Not stored in current schema
            convocationNumber: enrichedData.convocationNumber || '',
            registrationId: enrichedData.ticketSlug || enrichedData.registrationNumber || code,
            email: enrichedData.email || '',
            phone: enrichedData.phone || ''
          },
          registrationId: enrichedData.id,
          ticketSlug: enrichedData.ticketSlug
        });
      }
    }

    // Fall back to universal search
    console.log(`[Print Lookup] Using universal search for: ${code}`);
    const result = await universalSearch(code);

    if (!result.success || !result.data || result.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registration not found',
        code: code
      }, { status: 404 });
    }

    // Take the first match
    const graduate = result.data[0];

    // Enrich with Airtable data
    let enrichedData = graduate;
    if (graduate.convocationNumber) {
      const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
      if (airtableResult.success && airtableResult.data) {
        enrichedData = {
          ...graduate,
          name: airtableResult.data.name || graduate.name,
        };
      }
    }

    return NextResponse.json({
      success: true,
      badge: {
        name: enrichedData.name,
        degree: enrichedData.course || '',
        institution: '',
        convocationNumber: enrichedData.convocationNumber || '',
        registrationId: enrichedData.ticketSlug || enrichedData.registrationNumber || code,
        email: enrichedData.email || '',
        phone: enrichedData.phone || ''
      },
      registrationId: enrichedData.id,
      ticketSlug: enrichedData.ticketSlug
    });

  } catch (error) {
    console.error('[Print Lookup] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Lookup failed'
    }, { status: 500 });
  }
}

/**
 * POST /api/print/lookup
 *
 * Mark a registration as printed (optional - for tracking)
 * Body: { registrationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationId } = body;

    if (!registrationId) {
      return NextResponse.json({
        success: false,
        error: 'Registration ID required'
      }, { status: 400 });
    }

    // In the current implementation, print status isn't tracked in Tito
    // This endpoint is a placeholder for future tracking functionality
    // Could integrate with Airtable or a separate database

    console.log(`[Print Lookup] Marked as printed: ${registrationId}`);

    return NextResponse.json({
      success: true,
      message: 'Marked as printed'
    });

  } catch (error) {
    console.error('[Print Lookup] POST Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as printed'
    }, { status: 500 });
  }
}
