import { NextRequest, NextResponse } from 'next/server';
import { universalSearch, getTicketBySlug, ticketToGraduate, getTicketCheckins } from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { Graduate } from '@/types';

// Extract ticket slug from various URL formats
function extractTicketSlug(input: string): string | null {
  const trimmed = input.trim();

  // Direct slug: ti_xxxxx
  if (trimmed.startsWith('ti_')) {
    return trimmed.split(/[\s\?#]/)[0]; // Remove any query params or fragments
  }

  // URL formats: https://ti.to/tickets/ti_xxxxx or similar
  const slugMatch = trimmed.match(/ti_[a-zA-Z0-9]+/);
  if (slugMatch) {
    return slugMatch[0];
  }

  return null;
}

// Enrich graduate with real check-in data from Tito
async function enrichWithCheckinData(graduate: Graduate): Promise<Graduate> {
  if (!graduate.ticketId || graduate.ticketId === 0) {
    console.log(`[Search API] No ticket ID for ${graduate.name}, skipping check-in fetch`);
    return graduate;
  }

  console.log(`[Search API] Fetching check-ins for ticket ID: ${graduate.ticketId}`);
  const checkinsResult = await getTicketCheckins(graduate.ticketId);

  if (checkinsResult.success && checkinsResult.data) {
    console.log(`[Search API] Found ${checkinsResult.data.scans.length} check-ins for ${graduate.name}`);
    return {
      ...graduate,
      status: checkinsResult.data.status,
      scans: checkinsResult.data.scans,
    };
  }

  return graduate;
}

// Universal search API - searches across all fields
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const includeAddress = searchParams.get('includeAddress') === 'true';

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  🔎 SEARCH API CALLED                                  ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Query: "${query}"`);
    console.log(`║ Include Address: ${includeAddress}`);
    console.log('╚════════════════════════════════════════════════════════╝');

    // Check if it's a ticket URL or slug
    const ticketSlug = extractTicketSlug(query);
    if (ticketSlug) {
      console.log(`[Search API] ✓ Detected ticket slug: ${ticketSlug}`);

      // Direct ticket lookup via Tito API
      console.log(`[Search API] Calling getTicketBySlug("${ticketSlug}")`);
      const ticketResult = await getTicketBySlug(ticketSlug);

      if (ticketResult.success && ticketResult.data) {
        console.log(`[Search API] ✓ Ticket found! Name: ${ticketResult.data.name}, ID: ${ticketResult.data.id}`);
        const graduate = ticketToGraduate(ticketResult.data);
        console.log(`[Search API] Converted to graduate: ${graduate.name} (${graduate.convocationNumber})`);


        // Merge with Airtable data (including name)
        let mergedGraduate = graduate;
        if (graduate.convocationNumber) {
          const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
          if (airtableResult.success && airtableResult.data) {
            // Log name mismatch for debugging
            if (airtableResult.data.name && graduate.name !== airtableResult.data.name) {
              console.log(`[Search API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
            }
            mergedGraduate = {
              ...graduate,
              // ALWAYS use Airtable name if available (has full name with middle name)
              name: airtableResult.data.name || graduate.name,
              phone: graduate.phone || airtableResult.data.mobile,
              address: airtableResult.data.address.line1
                ? airtableResult.data.address
                : graduate.address,
            };
          }
        }

        // Enrich with real check-in data
        const enrichedGraduate = await enrichWithCheckinData(mergedGraduate);

        console.log(`[Search API] Found via ticket slug: ${enrichedGraduate.name}`);

        return NextResponse.json({
          success: true,
          data: [enrichedGraduate],
          count: 1,
          searchType: 'ticket_slug',
        });
      } else {
        console.log(`[Search API] Ticket not found for slug: ${ticketSlug}`);
      }
    }

    // Use universal search for other queries
    const result = await universalSearch(query);

    if (!result.success || !result.data || result.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: result.error || 'No graduates found. Try searching by name, convocation number, email, or mobile.',
        suggestions: [
          'Check if the convocation number is correct',
          'Try searching with partial name (e.g., "Sanjay" instead of full name)',
          'Search by mobile number without country code',
          'Verify the graduate is registered for this event'
        ]
      });
    }

    // Enrich all results with check-in data (for Track page)
    // Limit to first 5 results to avoid too many API calls
    const graduatesToEnrich = result.data.slice(0, 5);
    const enrichedGraduates = await Promise.all(
      graduatesToEnrich.map(async (graduate) => {
        let enriched = await enrichWithCheckinData(graduate);

        // Include address if requested
        if (includeAddress && enriched.convocationNumber) {
          const addressResult = await getAddressByConvocationNumber(enriched.convocationNumber);
          if (addressResult.success && addressResult.data) {
            enriched = { ...enriched, address: addressResult.data };
          }
        }

        return enriched;
      })
    );

    // Add remaining results without enrichment (for performance)
    const remainingGraduates = result.data.slice(5);

    return NextResponse.json({
      success: true,
      data: [...enrichedGraduates, ...remainingGraduates],
      count: result.data.length,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}
