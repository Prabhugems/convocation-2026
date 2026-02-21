import { NextRequest, NextResponse } from 'next/server';
import { createRfidTag, getTagByEpc } from '@/lib/rfid';
import { getTicketByConvocationNumber } from '@/lib/tito';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import {
  RfidTag,
  RfidTagType,
  EPC_PREFIX_BOX,
  isWd01Format,
  convertWd01ToUhfEpc,
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

    let normalizedEpc = (epc as string).toUpperCase().trim();
    const tagType = type as RfidTagType;

    // Convert WD01 desktop reader format (32-char TID) to standard UHF EPC (24-char)
    // WD01 reads TID bank; UHF scanner reads EPC bank — they must match for lookup
    if (isWd01Format(normalizedEpc)) {
      const uhfEpc = convertWd01ToUhfEpc(normalizedEpc);
      console.log(`[RFID Encode] Converted WD01 TID ${normalizedEpc} → UHF EPC ${uhfEpc}`);
      normalizedEpc = uhfEpc;
    }

    // Validate EPC — must be non-empty string
    if (normalizedEpc.length < 4) {
      return NextResponse.json(
        { success: false, error: 'EPC is too short. Place a tag on the reader to scan it.' },
        { status: 400 }
      );
    }

    // For graduate tags, convocation number is required (separate from EPC)
    if (tagType === 'graduate' && !convocationNumber) {
      return NextResponse.json(
        { success: false, error: 'Convocation number is required for graduate tags' },
        { status: 400 }
      );
    }

    if (tagType === 'box' && !normalizedEpc.startsWith(EPC_PREFIX_BOX) && !boxId) {
      return NextResponse.json(
        { success: false, error: 'Box ID is required for box tags' },
        { status: 400 }
      );
    }

    // Check for duplicate EPC
    const existing = await getTagByEpc(normalizedEpc);
    if (existing.success && existing.data) {
      return NextResponse.json(
        { success: false, error: `This tag is already linked to ${existing.data.convocationNumber || existing.data.boxId || 'another record'}`, data: existing.data },
        { status: 409 }
      );
    }

    let graduateName: string | undefined;
    let titoTicketId: number | undefined;
    let titoTicketSlug: string | undefined;

    // For graduate tags, look up Tito + Airtable data using convocation number
    if (tagType === 'graduate') {
      const convNum = (convocationNumber as string).toUpperCase().trim();

      // Look up name from Airtable
      const airtableResult = await getAirtableDataByConvocationNumber(convNum);
      if (airtableResult.success && airtableResult.data) {
        graduateName = airtableResult.data.name;
      }

      // Look up Tito ticket by convocation number (tag_names match via cached ticket map)
      const titoResult = await getTicketByConvocationNumber(convNum);
      if (titoResult.success && titoResult.data) {
        titoTicketId = titoResult.data.id;
        titoTicketSlug = titoResult.data.slug;
        if (!graduateName) {
          graduateName = titoResult.data.name;
        }
      }

      console.log(
        `[RFID Encode] EPC: ${normalizedEpc.slice(0, 12)}..., Graduate: ${convNum}, Name: ${graduateName || 'Unknown'}, TicketID: ${titoTicketId || 'None'}`
      );
    }

    // Create the tag record
    const now = new Date().toISOString();
    const effectiveBoxId = tagType === 'box'
      ? (boxId as string || (normalizedEpc.startsWith(EPC_PREFIX_BOX) ? normalizedEpc.slice(EPC_PREFIX_BOX.length) : undefined))
      : undefined;

    const newTag: Omit<RfidTag, 'id'> = {
      epc: normalizedEpc,
      type: tagType,
      convocationNumber: tagType === 'graduate' ? (convocationNumber as string).toUpperCase().trim() : undefined,
      boxId: effectiveBoxId,
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
      boxLabel: tagType === 'box' ? (boxLabel as string) || `Box ${effectiveBoxId || '?'}` : undefined,
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
