import { NextRequest, NextResponse } from 'next/server';
import { sendToPrinter, DEFAULT_PRINTER_SETTINGS } from '@/lib/zpl';

interface RawPrintRequest {
  zpl: string;
  printerIP?: string;
  printerPort?: number;
}

/**
 * POST /api/print/zpl/raw
 *
 * Send raw ZPL code directly to a Zebra printer via TCP.
 * Used for mobile printing where Browser Print is not available.
 */
export async function POST(request: NextRequest) {
  try {
    const body: RawPrintRequest = await request.json();

    const {
      zpl,
      printerIP = DEFAULT_PRINTER_SETTINGS.ip,
      printerPort = DEFAULT_PRINTER_SETTINGS.port,
    } = body;

    // Validate ZPL code
    if (!zpl || typeof zpl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid ZPL code' },
        { status: 400 }
      );
    }

    // Basic ZPL validation - should start with ^XA and end with ^XZ
    if (!zpl.includes('^XA') || !zpl.includes('^XZ')) {
      return NextResponse.json(
        { success: false, error: 'Invalid ZPL format: must contain ^XA and ^XZ' },
        { status: 400 }
      );
    }

    console.log(`[Print API Raw] Sending ZPL to ${printerIP}:${printerPort}`);
    console.log(`[Print API Raw] ZPL length: ${zpl.length} bytes`);

    // Send to printer
    const result = await sendToPrinter(zpl, printerIP, printerPort);

    if (result.success) {
      console.log(`[Print API Raw] Print successful`);
      return NextResponse.json({
        success: true,
        message: 'Label printed successfully',
        printer: { ip: printerIP, port: printerPort },
      });
    } else {
      console.error(`[Print API Raw] Print failed: ${result.error}`);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          printer: { ip: printerIP, port: printerPort },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Print API Raw] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to print label' },
      { status: 500 }
    );
  }
}
