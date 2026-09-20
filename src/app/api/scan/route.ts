import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationByReference,
  registrationToGraduate,
  checkinAtStation,
  getTicketBySlug,
  ticketToGraduate,
  getTicketCheckins
} from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { getStationStatus } from '@/lib/stations';
import { StationId, Graduate } from '@/types';

// Extract ticket slug from Tito URL or direct slug
function extractTicketSlug(input: string): string | null {
  const trimmed = input.trim();

  // Check if it's a Tito URL
  if (trimmed.includes('ti.to/tickets/') || trimmed.includes('ti.to/') || trimmed.includes('tito.io/')) {
    const match = trimmed.match(/ti_[a-zA-Z0-9]+/);
    if (match) {
      console.log(`[Scan API] Extracted ticket slug from URL: ${match[0]}`);
      return match[0];
    }
  }

  // Check if it's a direct ticket slug
  if (trimmed.startsWith('ti_')) {
    console.log(`[Scan API] Direct ticket slug: ${trimmed}`);
    return trimmed.split(/[\s\?#]/)[0]; // Remove any query params
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationNumber, stationId, metadata } = body;

    if (!registrationNumber || !stationId) {
      return NextResponse.json(
        { success: false, error: 'Registration number and station ID are required' },
        { status: 400 }
      );
    }

    console.log(`[Scan API] Processing: ${registrationNumber} at ${stationId}`);

    let graduate: Graduate | null = null;

    // Check if it's a Tito URL or ticket slug
    const ticketSlug = extractTicketSlug(registrationNumber);

    if (ticketSlug) {
      // Direct ticket lookup by slug
      console.log(`[Scan API] Looking up ticket by slug: ${ticketSlug}`);
      const ticketResult = await getTicketBySlug(ticketSlug);

      if (ticketResult.success && ticketResult.data) {
        graduate = ticketToGraduate(ticketResult.data);
        console.log(`[Scan API] Found graduate via ticket slug: ${graduate.name}`);

        // Merge with Airtable data (including name)
        if (graduate.convocationNumber) {
          const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
          if (airtableResult.success && airtableResult.data) {
            // ALWAYS use Airtable name if available (has full name with middle name)
            if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
              console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
              graduate.name = airtableResult.data.name;
            }
            graduate.phone = graduate.phone || airtableResult.data.mobile;
            if (airtableResult.data.address.line1) {
              graduate.address = airtableResult.data.address;
            }
            graduate.trackingNumber = airtableResult.data.trackingNumber;
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: `Ticket not found: ${ticketSlug}` },
          { status: 404 }
        );
      }
    } else {
      // Try registration reference lookup
      console.log(`[Scan API] Looking up by registration reference: ${registrationNumber}`);
      const regResult = await getRegistrationByReference(registrationNumber);

      if (!regResult.success) {
        return NextResponse.json(
          { success: false, error: regResult.error || 'Failed to look up registration' },
          { status: 500 }
        );
      }

      if (!regResult.data) {
        return NextResponse.json(
          { success: false, error: 'Registration not found. Please check the reference number.' },
          { status: 404 }
        );
      }

      graduate = registrationToGraduate(regResult.data);

      // Merge with Airtable data (including name)
      if (graduate.convocationNumber) {
        const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
        if (airtableResult.success && airtableResult.data) {
          // ALWAYS use Airtable name if available (has full name with middle name)
          if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
            console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
            graduate.name = airtableResult.data.name;
          }
          graduate.phone = graduate.phone || airtableResult.data.mobile;
          if (airtableResult.data.address.line1) {
            graduate.address = airtableResult.data.address;
          }
          graduate.trackingNumber = airtableResult.data.trackingNumber;
        }
      }
    }

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Could not find graduate' },
        { status: 404 }
      );
    }

    // Read real check-in status before acting, both so the response reflects
    // reality (previously this endpoint always returned an all-false status,
    // unlike /api/search) and so the duplicate-dispatch check below can see
    // whether this ticket was already fully dispatched.
    let checkinsVerified = false;
    if (graduate.ticketId) {
      const checkinsResult = await getTicketCheckins(graduate.ticketId);
      if (checkinsResult.success && checkinsResult.data) {
        graduate.status = checkinsResult.data.status;
        graduate.scans = checkinsResult.data.scans;
        checkinsVerified = true;
      }
    }

    // Hard block: a tracking number already assigned to this graduate must
    // not be reused by printing/checking in a second address label or a
    // second final-dispatch record. The only way past this is the admin
    // "Mark as Returned" action, which deletes the underlying check-ins.
    //
    // getTicketCheckins fails open internally (a failed per-list fetch is
    // reported back as a default-false status, not as an error), so a
    // transient Tito failure could otherwise make an already-dispatched
    // ticket look un-dispatched. For these two stations only, refuse to
    // proceed unless we actually managed to read real check-in status —
    // fail closed rather than risk a duplicate dispatch record. The other
    // seven stations don't guard anything irreversible, so they keep the
    // existing lenient behavior (proceed even if enrichment failed).
    if (stationId === 'address-label' || stationId === 'final-dispatch') {
      if (!checkinsVerified) {
        return NextResponse.json(
          {
            success: false,
            error: 'Could not verify dispatch status — please retry. Refusing to risk a duplicate dispatch record.',
          },
          { status: 503 }
        );
      }
      if (graduate.status.finalDispatched) {
        return NextResponse.json({
          success: false,
          error: graduate.trackingNumber
            ? `Already dispatched — Tracking ${graduate.trackingNumber}. Cannot create a duplicate dispatch record.`
            : 'Already dispatched. Cannot create a duplicate dispatch record.',
          data: graduate,
        });
      }
    }

    // Final dispatch fans out to two separate Tito check-in lists —
    // "Dispatched DTDC" vs "Dispatched India Post" — so courier-wise
    // reporting in Tito stays accurate. Route by explicit dispatchMethod
    // (the manual station UI always sends one), falling back to whether a
    // DTDC tracking number is known (from metadata or Airtable) for
    // programmatic/bulk callers that don't send metadata at all.
    let actualStationId = stationId as StationId;
    if (stationId === 'final-dispatch') {
      const method =
        (metadata?.dispatchMethod as string | undefined) ||
        (metadata?.trackingNumber || graduate.trackingNumber ? 'DTDC' : 'India Post');
      actualStationId = method === 'India Post' ? 'dispatch-india-post' : 'final-dispatch';
    }

    // Create check-in at the station
    const checkinResult = await checkinAtStation(graduate.ticketId, actualStationId);

    if (!checkinResult.success) {
      // If already checked in, still return the graduate info
      if (checkinResult.error?.includes('already')) {
        return NextResponse.json({
          success: false,
          error: `Already scanned at ${stationId} station`,
          data: graduate,
        });
      }
      return NextResponse.json(
        { success: false, error: checkinResult.error || 'Failed to record scan' },
        { status: 400 }
      );
    }

    // Reflect the check-in that just succeeded, without a second Tito round trip.
    graduate.status = { ...graduate.status, [getStationStatus(stationId as StationId)]: true };

    // For address-label station, try to fetch address from Airtable
    if (stationId === 'address-label' && graduate.convocationNumber) {
      const addressResult = await getAddressByConvocationNumber(graduate.convocationNumber);
      if (addressResult.success && addressResult.data) {
        graduate.address = addressResult.data;
      }
    }

    // Update tracking info for final dispatch, and always reflect which
    // list we actually routed to (even for bulk/programmatic callers that
    // send no metadata) so the response accurately shows DTDC vs India Post.
    if (stationId === 'final-dispatch') {
      if (metadata?.trackingNumber) {
        graduate.trackingNumber = metadata.trackingNumber as string;
      }
      graduate.dispatchMethod = actualStationId === 'dispatch-india-post' ? 'India Post' : 'DTDC';
    }

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const registrationNumber = searchParams.get('registrationNumber');

    if (!registrationNumber) {
      return NextResponse.json(
        { success: false, error: 'Registration number is required' },
        { status: 400 }
      );
    }

    console.log(`[Scan API GET] Looking up: ${registrationNumber}`);

    let graduate: Graduate | null = null;

    // Check if it's a Tito URL or ticket slug
    const ticketSlug = extractTicketSlug(registrationNumber);

    if (ticketSlug) {
      // Direct ticket lookup by slug
      console.log(`[Scan API GET] Looking up ticket by slug: ${ticketSlug}`);
      const ticketResult = await getTicketBySlug(ticketSlug);

      if (ticketResult.success && ticketResult.data) {
        graduate = ticketToGraduate(ticketResult.data);
        console.log(`[Scan API GET] Found graduate via ticket slug: ${graduate.name}`);
      } else {
        return NextResponse.json(
          { success: false, error: `Ticket not found: ${ticketSlug}` },
          { status: 404 }
        );
      }
    } else {
      // Try registration reference lookup
      const regResult = await getRegistrationByReference(registrationNumber);

      if (!regResult.success) {
        return NextResponse.json(
          { success: false, error: regResult.error || 'Failed to look up registration' },
          { status: 500 }
        );
      }

      if (!regResult.data) {
        return NextResponse.json(
          { success: false, error: 'Graduate not found' },
          { status: 404 }
        );
      }

      graduate = registrationToGraduate(regResult.data);
    }

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Could not find graduate' },
        { status: 404 }
      );
    }

    // Try to fetch address, phone and name from Airtable if we have convocation number
    if (graduate.convocationNumber) {
      const airtableResult = await getAirtableDataByConvocationNumber(graduate.convocationNumber);
      if (airtableResult.success && airtableResult.data) {
        // ALWAYS use Airtable name if available (has full name with middle name)
        if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
          console.log(`[Scan API GET] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
          graduate.name = airtableResult.data.name;
        }
        graduate.phone = graduate.phone || airtableResult.data.mobile;
        if (airtableResult.data.address.line1) {
          graduate.address = airtableResult.data.address;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
