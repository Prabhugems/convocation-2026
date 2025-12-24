import { NextRequest, NextResponse } from 'next/server';
import {
  getRegistrationByReference,
  registrationToGraduate,
  checkinAtStation,
  getTicketBySlug,
  ticketToGraduate
} from '@/lib/tito';
import { getAddressByConvocationNumber, getAirtableDataByConvocationNumber } from '@/lib/airtable';
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
    }

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Could not find graduate' },
        { status: 404 }
      );
    }

    // Run Airtable fetch and check-in in PARALLEL for speed
    const [airtableResult, checkinResult] = await Promise.all([
      graduate.convocationNumber
        ? getAirtableDataByConvocationNumber(graduate.convocationNumber)
        : Promise.resolve({ success: false, data: null }),
      checkinAtStation(graduate.ticketId, stationId as StationId)
    ]);

    // Merge Airtable data
    if (airtableResult.success && airtableResult.data) {
      // ALWAYS use Airtable name if available (has full name with middle name)
      if (airtableResult.data.name && airtableResult.data.name !== graduate.name) {
        console.log(`[Scan API] Using Airtable name "${airtableResult.data.name}" instead of Tito name "${graduate.name}"`);
        graduate.name = airtableResult.data.name;
      }
      graduate.phone = graduate.phone || airtableResult.data.mobile;
      if (airtableResult.data.address?.line1) {
        graduate.address = airtableResult.data.address;
      }
    }

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

    // Update tracking info for final dispatch
    if (stationId === 'final-dispatch' && metadata?.trackingNumber) {
      graduate.trackingNumber = metadata.trackingNumber as string;
      graduate.dispatchMethod = metadata.dispatchMethod as 'DTDC' | 'India Post';
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
