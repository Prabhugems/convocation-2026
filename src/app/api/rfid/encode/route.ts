import { NextRequest, NextResponse } from 'next/server';
import { createRfidTag, getTagByEpc } from '@/lib/rfid';
import { searchTickets } from '@/lib/tito';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import {
  RfidTag,
  RfidTagType,
  EPC_GRADUATE_PATTERN,
  EPC_PREFIX_BOX,
} from '@/types/rfid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epc, type, convocationNumber, boxId, boxLabel, encodedBy } = body;

    if (!epc || !type || !encodedBy) {
      return NextResponse.json(
        { success: false, error: 'EPC, type, and encodedBy are required' },
        { status: 400 }
      );
    }

    const normalizedEpc = (epc as string).toUpperCase().trim();
    const tagType = type as RfidTagType;

    // Validate EPC format (graduate EPCs are convocation numbers like 118AEC1001)
    if (tagType === 'graduate' && !EPC_GRADUATE_PATTERN.test(normalizedEpc)) {
      return NextResponse.json(
        { success: false, error: 'Graduate EPCs must be a valid convocation number (e.g., 118AEC1001)' },
        { status: 400 }
      );
    }

    if (tagType === 'box' && !normalizedEpc.startsWith(EPC_PREFIX_BOX)) {
      return NextResponse.json(
        { success: false, error: `Box EPCs must start with ${EPC_PREFIX_BOX}` },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await getTagByEpc(normalizedEpc);
    if (existing.success && existing.data) {
      return NextResponse.json(
        { success: false, error: `EPC ${normalizedEpc} is already encoded`, data: existing.data },
        { status: 409 }
      );
    }

    let graduateName: string | undefined;
    let titoTicketId: number | undefined;
    let titoTicketSlug: string | undefined;

    // For graduate tags, look up Tito + Airtable data
    if (tagType === 'graduate') {
      if (!convocationNumber) {
        return NextResponse.json(
          { success: false, error: 'Convocation number is required for graduate tags' },
          { status: 400 }
        );
      }

      const convNum = (convocationNumber as string).toUpperCase().trim();

      // Look up name from Airtable
      const airtableResult = await getAirtableDataByConvocationNumber(convNum);
      if (airtableResult.success && airtableResult.data) {
        graduateName = airtableResult.data.name;
      }

      // Look up Tito ticket by convocation number (stored as tag)
      const titoResult = await searchTickets(convNum);
      if (titoResult.success && titoResult.data && titoResult.data.length > 0) {
        // Find ticket with matching convocation number in tags
        const matchingTicket = titoResult.data.find(
          t => t.tag_names?.some(tag => tag.toUpperCase() === convNum)
        );
        if (matchingTicket) {
          titoTicketId = matchingTicket.id;
          titoTicketSlug = matchingTicket.slug;
          if (!graduateName) {
            graduateName = matchingTicket.name;
          }
        }
      }

      console.log(
        `[RFID Encode] Graduate: ${convNum}, Name: ${graduateName || 'Unknown'}, TicketID: ${titoTicketId || 'None'}`
      );
    }

    // Create the tag record
    const now = new Date().toISOString();
    const newTag: Omit<RfidTag, 'id'> = {
      epc: normalizedEpc,
      type: tagType,
      convocationNumber: tagType === 'graduate' ? (convocationNumber as string).toUpperCase().trim() : undefined,
      boxId: tagType === 'box' ? (boxId as string || normalizedEpc.slice(EPC_PREFIX_BOX.length)) : undefined,
      graduateName,
      titoTicketId,
      titoTicketSlug,
      status: 'encoded',
      currentStation: 'encoding',
      encodedAt: now,
      encodedBy: encodedBy as string,
      scanHistory: [
        {
          station: 'encoding',
          timestamp: now,
          scannedBy: encodedBy as string,
          action: `Encoded as ${tagType} tag`,
        },
      ],
      boxContents: tagType === 'box' ? [] : undefined,
      boxLabel: tagType === 'box' ? (boxLabel as string) || `Box ${boxId || normalizedEpc.slice(EPC_PREFIX_BOX.length)}` : undefined,
    };

    const createResult = await createRfidTag(newTag);

    if (!createResult.success) {
      return NextResponse.json(
        { success: false, error: createResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: createResult.data,
    });
  } catch (error) {
    console.error('[RFID Encode] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Verify if an EPC is already encoded
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const epc = searchParams.get('epc');

    if (!epc) {
      return NextResponse.json(
        { success: false, error: 'EPC parameter is required' },
        { status: 400 }
      );
    }

    const result = await getTagByEpc(epc);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      encoded: result.data !== null,
    });
  } catch (error) {
    console.error('[RFID Encode GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
