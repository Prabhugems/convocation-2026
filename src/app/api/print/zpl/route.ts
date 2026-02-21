import { NextRequest, NextResponse } from 'next/server';
import { generatePackingLabel, generateBadgeLabel, generateCalibrationCommand, generateClearQueueCommand, sendToPrinter, DEFAULT_PRINTER_SETTINGS } from '@/lib/zpl';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

// CORS preflight — needed when live site calls localhost:3001
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

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
      return jsonResponse(
        { success: false, error: 'Missing required fields: convocationNumber, name' },
        400
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
      return jsonResponse({
        success: true,
        message: `Label printed for ${convocationNumber}`,
      });
    } else {
      console.error(`[Print API] Print failed: ${result.error}`);
      return jsonResponse(
        { success: false, error: result.error },
        500
      );
    }
  } catch (error) {
    console.error('[Print API] Error:', error);
    return jsonResponse(
      { success: false, error: 'Failed to print label' },
      500
    );
  }
}

/**
 * GET /api/print/zpl
 *
 * Test printer connection, print test label, calibrate, or clear queue
 *
 * Query params:
 * - ip: Printer IP address
 * - port: Printer port
 * - action: 'test' (default), 'calibrate', or 'clear-queue'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const printerIP = searchParams.get('ip') || DEFAULT_PRINTER_SETTINGS.ip;
  const printerPort = parseInt(searchParams.get('port') || String(DEFAULT_PRINTER_SETTINGS.port));
  const action = searchParams.get('action') || 'test';

  // Handle calibration
  if (action === 'calibrate') {
    console.log(`[Print API] Sending calibration command to ${printerIP}:${printerPort}`);

    const calibrationZpl = generateCalibrationCommand();
    const result = await sendToPrinter(calibrationZpl, printerIP, printerPort);

    if (result.success) {
      return jsonResponse({
        success: true,
        message: 'Printer calibration command sent successfully. The printer will now calibrate its sensors.',
        printer: { ip: printerIP, port: printerPort },
      });
    } else {
      return jsonResponse(
        {
          success: false,
          error: result.error,
          printer: { ip: printerIP, port: printerPort },
        },
        500
      );
    }
  }

  // Handle clear queue
  if (action === 'clear-queue') {
    console.log(`[Print API] Clearing print queue on ${printerIP}:${printerPort}`);

    const clearZpl = generateClearQueueCommand();
    const result = await sendToPrinter(clearZpl, printerIP, printerPort);

    if (result.success) {
      return jsonResponse({
        success: true,
        message: 'Print queue cleared successfully.',
        printer: { ip: printerIP, port: printerPort },
      });
    } else {
      return jsonResponse(
        {
          success: false,
          error: result.error,
          printer: { ip: printerIP, port: printerPort },
        },
        500
      );
    }
  }

  // Default: Test print with label dimensions
  const testZpl = `^XA
^CI28
^PW609
^LL406
^MNY
^LH10,10
^MD10
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
    return jsonResponse({
      success: true,
      message: 'Test label printed successfully',
      printer: { ip: printerIP, port: printerPort },
    });
  } else {
    return jsonResponse(
      {
        success: false,
        error: result.error,
        printer: { ip: printerIP, port: printerPort },
      },
      500
    );
  }
}
