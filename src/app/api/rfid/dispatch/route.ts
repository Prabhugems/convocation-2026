import { NextRequest, NextResponse } from 'next/server';
import { processDispatch, getBoxContents, isBoxEpc } from '@/lib/rfid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epcs, trackingNumber, dispatchMethod, dispatchedBy, notes } = body;

    if (!epcs || !Array.isArray(epcs) || epcs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'epcs array is required' },
        { status: 400 }
      );
    }

    if (!dispatchedBy) {
      return NextResponse.json(
        { success: false, error: 'dispatchedBy is required' },
        { status: 400 }
      );
    }

    // Expand box EPCs to include their contents
    const expandedEpcs: string[] = [];

    for (const epc of epcs as string[]) {
      const normalizedEpc = epc.toUpperCase().trim();

      if (isBoxEpc(normalizedEpc)) {
        // Add the box tag itself
        expandedEpcs.push(normalizedEpc);

        // Also dispatch all items inside the box
        const contentsResult = await getBoxContents(normalizedEpc);
        if (contentsResult.success && contentsResult.data) {
          for (const item of contentsResult.data.items) {
            if (!expandedEpcs.includes(item.epc)) {
              expandedEpcs.push(item.epc);
            }
          }
          console.log(
            `[RFID Dispatch] Expanded box ${normalizedEpc}: ${contentsResult.data.items.length} items`
          );
        }
      } else {
        expandedEpcs.push(normalizedEpc);
      }
    }

    console.log(
      `[RFID Dispatch] Processing ${expandedEpcs.length} tags (from ${(epcs as string[]).length} input EPCs) by ${dispatchedBy}`
    );

    const result = await processDispatch(
      expandedEpcs,
      dispatchedBy as string,
      trackingNumber as string | undefined,
      dispatchMethod as string | undefined,
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
    console.error('[RFID Dispatch] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
