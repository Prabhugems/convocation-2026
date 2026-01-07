/**
 * Zebra ZPL Direct Printing API Route for Next.js
 *
 * Copy this file to: src/app/api/zebra-print/route.ts
 *
 * Features:
 * - Direct TCP printing to Zebra printers (no drivers needed)
 * - Support for badges, labels, QR codes, barcodes
 * - Multiple label sizes (4x6, 4x3, 4x2, 3x2, 2x1)
 * - 180-degree rotation support
 */

import { NextRequest, NextResponse } from 'next/server';

// Label sizes in dots (203 DPI)
const LABEL_SIZES: Record<string, { width: number; height: number }> = {
  '4x6': { width: 812, height: 1218 },
  '4x3': { width: 812, height: 609 },
  '4x2': { width: 812, height: 406 },
  '3x2': { width: 609, height: 406 },
  '2x1': { width: 406, height: 203 },
};

interface BadgeData {
  name: string;
  title?: string;
  company?: string;
  badge_type?: string;
  badge_id?: string;
  event_name?: string;
  paper_size?: keyof typeof LABEL_SIZES;
  rotation?: 0 | 180;
}

interface PrintRequest {
  printer_ip: string;
  printer_port?: number;
  test_print?: boolean;
  data?: BadgeData;
  zpl?: string;
}

/**
 * Sanitize text for ZPL to prevent injection attacks
 */
function sanitizeZPL(text: string): string {
  return text
    .replace(/[\^~]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, 100);
}

/**
 * Generate ZPL for a badge/label
 */
function generateBadgeZPL(data: BadgeData): string {
  const size = LABEL_SIZES[data.paper_size || '4x6'];
  const rotation = data.rotation === 180 ? '^POI' : '^PON';

  const name = sanitizeZPL(data.name || '');
  const title = sanitizeZPL(data.title || '');
  const company = sanitizeZPL(data.company || '');
  const badgeType = sanitizeZPL(data.badge_type || '');
  const badgeId = sanitizeZPL(data.badge_id || '');
  const eventName = sanitizeZPL(data.event_name || '');

  // Calculate positions based on label size
  const centerX = Math.floor(size.width / 2);
  const startY = 50;
  const lineHeight = 60;

  let zpl = `^XA
^CI28
^PW${size.width}
^LL${size.height}
^MNY
${rotation}
^LH0,0
^MD10`;

  // Event name (top, centered)
  if (eventName) {
    zpl += `
^FO0,${startY}^FB${size.width},1,0,C,0^A0N,40,40^FD${eventName}^FS`;
  }

  // Badge type (below event)
  if (badgeType) {
    zpl += `
^FO0,${startY + lineHeight}^FB${size.width},1,0,C,0^A0N,35,35^FD${badgeType}^FS`;
  }

  // Name (large, centered)
  zpl += `
^FO0,${startY + lineHeight * 2.5}^FB${size.width},1,0,C,0^A0N,60,60^FD${name}^FS`;

  // Title
  if (title) {
    zpl += `
^FO0,${startY + lineHeight * 3.5}^FB${size.width},1,0,C,0^A0N,35,35^FD${title}^FS`;
  }

  // Company
  if (company) {
    zpl += `
^FO0,${startY + lineHeight * 4.5}^FB${size.width},1,0,C,0^A0N,35,35^FD${company}^FS`;
  }

  // Badge ID with QR code at bottom
  if (badgeId) {
    const qrY = size.height - 250;
    zpl += `
^FO${centerX - 75},${qrY}^BQN,2,5^FDQA,${badgeId}^FS
^FO0,${size.height - 60}^FB${size.width},1,0,C,0^A0N,30,30^FD${badgeId}^FS`;
  }

  zpl += `
^XZ`;

  return zpl;
}

/**
 * Generate test print ZPL
 */
function generateTestZPL(printerIP: string, printerPort: number): string {
  return `^XA
^CI28
^PW812
^LL406
^MNY
^LH10,10
^MD10
^CF0,40
^FO50,50^FD*** TEST PRINT ***^FS
^CF0,30
^FO50,110^FDZebra Direct Print^FS
^FO50,150^FDIP: ${printerIP}:${printerPort}^FS
^FO50,190^FDTime: ${new Date().toLocaleString()}^FS
^CF0,25
^FO50,250^FDConnection successful!^FS
^XZ`;
}

/**
 * Send ZPL to printer via TCP
 */
async function sendToPrinter(
  zplCode: string,
  printerIP: string,
  printerPort: number = 9100
): Promise<{ success: boolean; error?: string }> {
  const net = await import('net');

  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(5000);

    client.connect(printerPort, printerIP, () => {
      client.write(zplCode, 'utf8', (err) => {
        if (err) {
          client.destroy();
          resolve({ success: false, error: `Write error: ${err.message}` });
        } else {
          client.end();
          resolve({ success: true });
        }
      });
    });

    client.on('error', (err) => {
      resolve({ success: false, error: `Connection error: ${err.message}` });
    });

    client.on('timeout', () => {
      client.destroy();
      resolve({ success: false, error: 'Connection timeout - check printer IP and port 9100' });
    });
  });
}

/**
 * POST /api/zebra-print
 *
 * Print a badge, label, or raw ZPL to a Zebra printer
 */
export async function POST(request: NextRequest) {
  try {
    const body: PrintRequest = await request.json();
    const { printer_ip, printer_port = 9100, test_print, data, zpl } = body;

    if (!printer_ip) {
      return NextResponse.json(
        { success: false, error: 'printer_ip is required' },
        { status: 400 }
      );
    }

    let zplCode: string;

    if (test_print) {
      zplCode = generateTestZPL(printer_ip, printer_port);
    } else if (zpl) {
      zplCode = zpl;
    } else if (data) {
      if (!data.name) {
        return NextResponse.json(
          { success: false, error: 'data.name is required' },
          { status: 400 }
        );
      }
      zplCode = generateBadgeZPL(data);
    } else {
      return NextResponse.json(
        { success: false, error: 'Must provide test_print, data, or zpl' },
        { status: 400 }
      );
    }

    console.log(`[Zebra Print] Sending to ${printer_ip}:${printer_port}`);

    const result = await sendToPrinter(zplCode, printer_ip, printer_port);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Print job sent successfully',
        printer: { ip: printer_ip, port: printer_port },
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Zebra Print] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process print request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zebra-print
 *
 * Test printer connection or get printer info
 *
 * Query params:
 * - ip: Printer IP address (required)
 * - port: Printer port (default: 9100)
 * - action: 'test' (default), 'calibrate', 'clear-queue'
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const printerIP = searchParams.get('ip');
  const printerPort = parseInt(searchParams.get('port') || '9100');
  const action = searchParams.get('action') || 'test';

  if (!printerIP) {
    return NextResponse.json(
      { success: false, error: 'ip query parameter is required' },
      { status: 400 }
    );
  }

  let zplCode: string;

  switch (action) {
    case 'calibrate':
      zplCode = '~JC^XA^JUS^XZ'; // Calibrate + save
      break;
    case 'clear-queue':
      zplCode = '~JA^XA^XZ'; // Cancel jobs + clear buffer
      break;
    default:
      zplCode = generateTestZPL(printerIP, printerPort);
  }

  console.log(`[Zebra Print] Action '${action}' on ${printerIP}:${printerPort}`);

  const result = await sendToPrinter(zplCode, printerIP, printerPort);

  if (result.success) {
    const messages: Record<string, string> = {
      test: 'Test print sent successfully',
      calibrate: 'Calibration command sent - printer will calibrate sensors',
      'clear-queue': 'Print queue cleared',
    };

    return NextResponse.json({
      success: true,
      message: messages[action] || 'Command sent successfully',
      printer: { ip: printerIP, port: printerPort },
    });
  } else {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }
}
