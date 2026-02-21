import { NextRequest, NextResponse } from 'next/server';
import { getTagByEpc } from '@/lib/rfid';
import { generatePackingLabel, sendToPrinter, DEFAULT_PRINTER_SETTINGS } from '@/lib/zpl';

/**
 * POST /api/rfid/auto-print
 *
 * One-call endpoint: EPC → tag lookup → ZPL generation → print
 * Used by the scan page auto-print feature when a tag is detected on the UHF reader.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { epc, printerIP, printerPort } = body;

    if (!epc) {
      return NextResponse.json(
        { success: false, error: 'EPC is required' },
        { status: 400 }
      );
    }

    const normalizedEpc = (epc as string).toUpperCase().trim();
    const ip = printerIP || DEFAULT_PRINTER_SETTINGS.ip;
    const port = printerPort || DEFAULT_PRINTER_SETTINGS.port;

    // 1. Look up the tag (includes WD01 fallback)
    const tagResult = await getTagByEpc(normalizedEpc);

    if (!tagResult.success) {
      return NextResponse.json(
        { success: false, printed: false, reason: 'lookup_error', error: tagResult.error },
        { status: 500 }
      );
    }

    if (!tagResult.data) {
      // Unregistered tag — not an error, just skip
      return NextResponse.json({
        success: true,
        printed: false,
        reason: 'unregistered',
      });
    }

    const tag = tagResult.data;

    // 2. Build ticket URL for QR code
    const ticketUrl = tag.titoTicketSlug
      ? `https://ti.to/tickets/${tag.titoTicketSlug}`
      : '';

    // 3. Generate ZPL packing label
    const zplCode = generatePackingLabel({
      convocationNumber: tag.convocationNumber || 'N/A',
      name: tag.graduateName || 'Unknown',
      ticketUrl,
    });

    console.log(`[Auto-Print] Printing label for ${tag.graduateName} (${tag.convocationNumber}) → ${ip}:${port}`);

    // 4. Send to printer via TCP
    const printResult = await sendToPrinter(zplCode, ip, port);

    if (!printResult.success) {
      console.error(`[Auto-Print] Print failed: ${printResult.error}`);
      return NextResponse.json({
        success: false,
        printed: false,
        reason: 'print_error',
        error: printResult.error,
        graduateName: tag.graduateName,
        convocationNumber: tag.convocationNumber,
      });
    }

    console.log(`[Auto-Print] Label printed for ${tag.convocationNumber}`);

    return NextResponse.json({
      success: true,
      printed: true,
      graduateName: tag.graduateName,
      convocationNumber: tag.convocationNumber,
    });
  } catch (error) {
    console.error('[Auto-Print] Error:', error);
    return NextResponse.json(
      { success: false, printed: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
