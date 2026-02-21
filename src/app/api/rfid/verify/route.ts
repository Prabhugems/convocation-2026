import { NextRequest, NextResponse } from 'next/server';
import { getTagByEpc, getTagByConvocationNumber, getBoxContents } from '@/lib/rfid';

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

    const normalizedEpc = epc.toUpperCase().trim();
    console.log(`[RFID Verify] Looking up: ${normalizedEpc}`);

    const result = await getTagByEpc(normalizedEpc);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // If not found by EPC, try convocation number lookup
    let tag = result.data;
    if (!tag) {
      const convResult = await getTagByConvocationNumber(normalizedEpc);
      if (convResult.success && convResult.data) {
        tag = convResult.data;
      }
    }

    if (!tag) {
      return NextResponse.json({
        success: true,
        data: null,
        found: false,
        message: `Tag ${normalizedEpc} is not registered in the system`,
      });
    }

    // If it's a box tag, also fetch contents
    let boxItems = undefined;
    if (tag.type === 'box' && tag.boxContents && tag.boxContents.length > 0) {
      const contentsResult = await getBoxContents(normalizedEpc);
      if (contentsResult.success && contentsResult.data) {
        boxItems = contentsResult.data.items;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tag,
        boxItems,
      },
      found: true,
    });
  } catch (error) {
    console.error('[RFID Verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Verify multiple EPCs at once
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epcs } = body;

    if (!epcs || !Array.isArray(epcs) || epcs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'epcs array is required' },
        { status: 400 }
      );
    }

    const results: Array<{
      epc: string;
      found: boolean;
      tag?: unknown;
      error?: string;
    }> = [];

    for (const epc of epcs) {
      const normalizedEpc = (epc as string).toUpperCase().trim();
      const result = await getTagByEpc(normalizedEpc);

      if (result.success) {
        results.push({
          epc: normalizedEpc,
          found: result.data !== null,
          tag: result.data || undefined,
        });
      } else {
        results.push({
          epc: normalizedEpc,
          found: false,
          error: result.error,
        });
      }
    }

    const found = results.filter(r => r.found).length;
    const notFound = results.filter(r => !r.found).length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: { total: epcs.length, found, notFound },
      },
    });
  } catch (error) {
    console.error('[RFID Verify POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
