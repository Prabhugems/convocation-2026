import { NextRequest, NextResponse } from 'next/server';
import { getTagByEpc, getTagByConvocationNumber, getBoxContents } from '@/lib/rfid';
import { isWd01Format, convertWd01ToUhfEpc } from '@/types/rfid';

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
    console.log(`[RFID Verify] Looking up: ${normalizedEpc} (length: ${normalizedEpc.length})`);

    // Try exact match first
    let result = await getTagByEpc(normalizedEpc);
    let lookupEpc = normalizedEpc;

    // If not found and input is longer than 24 chars (e.g. EPC + TID suffix like 80E20030),
    // try truncating to 24-char UHF EPC
    if (result.success && !result.data && normalizedEpc.length > 24 && /^[0-9A-F]+$/.test(normalizedEpc)) {
      const truncatedEpc = normalizedEpc.slice(0, 24);
      console.log(`[RFID Verify] Exact match failed, trying truncated EPC: ${truncatedEpc}`);
      const truncResult = await getTagByEpc(truncatedEpc);
      if (truncResult.success && truncResult.data) {
        result = truncResult;
        lookupEpc = truncatedEpc;
      }
    }

    // If still not found and looks like WD01 format, try byte-reversal conversion
    if (result.success && !result.data && isWd01Format(normalizedEpc)) {
      const uhfEpc = convertWd01ToUhfEpc(normalizedEpc);
      console.log(`[RFID Verify] Trying WD01 conversion: ${normalizedEpc} → ${uhfEpc}`);
      const wd01Result = await getTagByEpc(uhfEpc);
      if (wd01Result.success && wd01Result.data) {
        result = wd01Result;
        lookupEpc = uhfEpc;
      }
    }

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
      let lookupEpc = normalizedEpc;

      // Try exact match first
      let result = await getTagByEpc(normalizedEpc);

      // If not found, try truncated 24-char EPC (strip TID suffix)
      if (result.success && !result.data && normalizedEpc.length > 24 && /^[0-9A-F]+$/.test(normalizedEpc)) {
        const truncated = normalizedEpc.slice(0, 24);
        const truncResult = await getTagByEpc(truncated);
        if (truncResult.success && truncResult.data) { result = truncResult; lookupEpc = truncated; }
      }

      // If still not found, try WD01 byte-reversal
      if (result.success && !result.data && isWd01Format(normalizedEpc)) {
        const wd01Result = await getTagByEpc(convertWd01ToUhfEpc(normalizedEpc));
        if (wd01Result.success && wd01Result.data) { result = wd01Result; lookupEpc = convertWd01ToUhfEpc(normalizedEpc); }
      }

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
