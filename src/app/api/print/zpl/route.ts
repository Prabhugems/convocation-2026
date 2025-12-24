import { NextRequest, NextResponse } from 'next/server';
import { generatePackingLabel, generateBadgeLabel, sendToPrinter, DEFAULT_PRINTER_SETTINGS } from '@/lib/zpl';

interface PrintRequest {
  type: 'packing' | 'badge';
  convocationNumber: string;
  name: string;
  ticketUrl: string;
  course?: string;
  printerIP?: string;
  printerPort?: number;
}

/**
 * POST /api/print/zpl
 *
 * Send ZPL label directly to Zebra printer via TCP
 */
export async function POST(request: NextRequest) {
  try {
    const body: PrintRequest = await request.json();

    const {
      type = 'packing',
      convocationNumber,
      name,
      ticketUrl,
      course,
      printerIP = DEFAULT_PRINTER_SETTINGS.ip,
      printerPort = DEFAULT_PRINTER_SETTINGS.port,
    } = body;

    // Validate required fields
    if (!convocationNumber || !name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: convocationNumber, name' },
        { status: 400 }
      );
    }

    // Generate ZPL based on type
    let zplCode: string;

    if (type === 'badge') {
      zplCode = generateBadgeLabel({
        convocationNumber,
        name,
        ticketUrl: ticketUrl || '',
        course,
      });
    } else {
      zplCode = generatePackingLabel({
        convocationNumber,
        name,
        ticketUrl: ticketUrl || '',
      });
    }

    console.log(`[Print API] Sending ${type} label to ${printerIP}:${printerPort}`);
    console.log(`[Print API] ZPL:\n${zplCode}`);

    // Send to printer
    const result = await sendToPrinter(zplCode, printerIP, printerPort);

    if (result.success) {
      console.log(`[Print API] Label printed successfully for ${convocationNumber}`);
      return NextResponse.json({
        success: true,
        message: `Label printed for ${convocationNumber}`,
      });
    } else {
      console.error(`[Print API] Print failed: ${result.error}`);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Print API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to print label' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/print/zpl/test
 *
 * Test printer connection and print a test label
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const printerIP = searchParams.get('ip') || DEFAULT_PRINTER_SETTINGS.ip;
  const printerPort = parseInt(searchParams.get('port') || String(DEFAULT_PRINTER_SETTINGS.port));

  // Generate test label
  const testZpl = `^XA
^CI28
^CF0,40
^FO50,50^FD*** TEST PRINT ***^FS
^CF0,30
^FO50,110^FDPrinter: Zebra ZD230^FS
^FO50,150^FDIP: ${printerIP}:${printerPort}^FS
^FO50,190^FDTime: ${new Date().toLocaleString()}^FS
^CF0,25
^FO50,250^FDConvocation 2026 System^FS
^XZ`;

  console.log(`[Print API] Sending test print to ${printerIP}:${printerPort}`);

  const result = await sendToPrinter(testZpl, printerIP, printerPort);

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Test label printed successfully',
      printer: { ip: printerIP, port: printerPort },
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        printer: { ip: printerIP, port: printerPort },
      },
      { status: 500 }
    );
  }
}
