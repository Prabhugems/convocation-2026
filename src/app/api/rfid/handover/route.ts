import { NextRequest, NextResponse } from 'next/server';
import { processHandover, getBoxContents, isBoxEpc } from '@/lib/rfid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epcs, handoverTo, handoverBy, notes } = body;

    if (!epcs || !Array.isArray(epcs) || epcs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'epcs array is required' },
        { status: 400 }
      );
    }

    if (!handoverTo) {
      return NextResponse.json(
        { success: false, error: 'handoverTo is required' },
        { status: 400 }
      );
    }

    if (!handoverBy) {
      return NextResponse.json(
        { success: false, error: 'handoverBy is required' },
        { status: 400 }
      );
    }

    // Expand box EPCs to include their contents
    const expandedEpcs: string[] = [];

    for (const epc of epcs as string[]) {
      const normalizedEpc = epc.toUpperCase().trim();

      if (isBoxEpc(normalizedEpc)) {
        expandedEpcs.push(normalizedEpc);

        const contentsResult = await getBoxContents(normalizedEpc);
        if (contentsResult.success && contentsResult.data) {
          for (const item of contentsResult.data.items) {
            if (!expandedEpcs.includes(item.epc)) {
              expandedEpcs.push(item.epc);
            }
          }
          console.log(
            `[RFID Handover] Expanded box ${normalizedEpc}: ${contentsResult.data.items.length} items`
          );
        }
      } else {
        expandedEpcs.push(normalizedEpc);
      }
    }

    console.log(
      `[RFID Handover] Processing ${expandedEpcs.length} tags, handover to ${handoverTo} by ${handoverBy}`
    );

    const result = await processHandover(
      expandedEpcs,
      handoverBy as string,
      handoverTo as string,
      notes as string | undefined
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[RFID Handover] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
