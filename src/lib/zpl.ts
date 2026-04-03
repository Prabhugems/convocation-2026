/**
 * ZPL (Zebra Programming Language) Template Generator
 * For Zebra ZD230 Thermal Printer
 *
 * Packing Label: 55mm × 65mm (440 x 520 dots at 203 DPI)
 * Badge Label: 100mm × 153mm (803 x 1229 dots at 203 DPI)
 *
 * FIXED: Added label dimensions and media type to prevent over-feeding
 */

export interface ZPLLabelData {
  convocationNumber: string;
  name: string;
  ticketUrl: string;
}

/**
 * ZPL initialization commands for label dimensions
 * Prevents printer from feeding extra labels
 *
 * Commands:
 * ^PW - Print Width in dots
 * ^LL - Label Length in dots
 * ^MNY - Media type: Gap/notch sensing
 * ^POI - Print Orientation Inverted (180° rotation)
 * ^LH - Label Home (X,Y offset from top-left)
 * ^MD - Media Darkness (-30 to 30, higher = darker)
 */
const ZPL_PACKING_INIT = ''; // printer permanently configured via ^JUS (PW440, LL520)

const ZPL_BADGE_INIT = `
^PW803
^LL1229
^MNY
^LH10,10
^MD10
`.trim();  // 100mm×153mm, gap sensing, with offset and darkness

/**
 * Generate ZPL code for 55mm × 65mm packing label
 *
 * Layout (440 × 520 dots at 203 DPI):
 * - Top: Dr. Name (large, bold)
 * - Bottom-left: QR code (large, scannable)
 * - Bottom-right: Convocation number rotated 90°
 */
export function generatePackingLabel(data: ZPLLabelData): string {
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  const name = truncateForLabel(sanitizeZPL(data.name || 'Unknown'), 20);
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  return `^XA
^CI28
${ZPL_PACKING_INIT}
^MD15
^CF0,28
^FO0,60^FB440,1,0,C,0^FDDr. ${name}^FS
^FO130,130^BQN,2,5^FDQA,${ticketUrl}^FS
^CF0,40
^FO0,410^FB440,1,0,C,0^FD${convNum}^FS
^XZ`;
}

/**
 * Generate ZPL for 100mm × 153mm badge
 *
 * FIXED: Content shrunk to 75% to fit properly
 * FIXED: Includes label dimensions to prevent over-feeding
 */
export function generateBadgeLabel(data: ZPLLabelData & { course?: string }): string {
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  // Truncate long names to fit on badge (max 28 chars)
  const name = truncateForLabel(sanitizeZPL(data.name || 'Unknown'), 28);
  const course = sanitizeZPL(data.course || 'FMAS Course');
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  // Shrunk content sizes (75% of original)
  return `^XA
^CI28
${ZPL_BADGE_INIT}
^CF0,38
^FO50,60^FDCONVOCATION 2026^FS
^CF0,24
^FO50,110^FD${course}^FS
^CF0,32
^FO50,150^FDDr. ${name}^FS
^FO180,200^BQN,2,6^FDQA,${ticketUrl}^FS
^CF0,28
^FO50,420^FD${convNum}^FS
^CF0,14
^FO50,470^FDCollect your certificate on 28th August 2026^FS
^FO50,495^FDat AMASI Office (Venue)^FS
^XZ`;
}

/**
 * Generate ZPL calibration command
 * Call this once when loading new label stock
 */
export function generateCalibrationCommand(): string {
  return `^XA^MNM^XZ~JC^XA^JUS^XZ`;
  // ^MNM = Set media type to mark sensing
  // ~JC = Calibrate label length sensor
  // ^JUS = Save settings to printer
}

/**
 * Generate ZPL command to clear print queue
 * Use when print queue is stuck
 */
export function generateClearQueueCommand(): string {
  return `~JA^XA^XZ`;
  // ~JA = Cancel all queued jobs
  // ^XA^XZ = Empty format to clear buffer
}

/**
 * Truncate long text for label display
 * Prevents text overflow on small labels
 */
export function truncateForLabel(text: string, maxLength: number = 25): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 2) + '..';
}

/**
 * Sanitize text for ZPL to prevent injection
 */
function sanitizeZPL(text: string): string {
  // Remove ZPL control characters and limit length
  return text
    .replace(/[\^~]/g, '') // Remove ZPL special chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .slice(0, 100); // Limit length
}

/**
 * Send ZPL to USB-connected printer via CUPS (lp command)
 * Uses raw mode to send ZPL directly without driver processing
 */
async function sendToPrinterUSB(
  zplCode: string
): Promise<{ success: boolean; error?: string }> {
  const { exec } = await import('child_process');

  return new Promise((resolve) => {
    // First, find available CUPS printers
    exec('lpstat -p -d', (lpErr, lpOut) => {
      if (lpErr) {
        resolve({ success: false, error: 'No CUPS printers found. Is the printer connected via USB?' });
        return;
      }

      // Find the printer name from lpstat output (first enabled printer that isn't a generic one)
      const lines = lpOut.split('\n');
      let printerName = '';

      // Check for system default first
      const defaultLine = lines.find(l => l.includes('system default destination:'));
      if (defaultLine) {
        printerName = defaultLine.split('system default destination:')[1].trim();
      }

      // If no default, use first available printer
      if (!printerName) {
        const printerLine = lines.find(l => l.startsWith('printer ') && l.includes('enabled'));
        if (printerLine) {
          printerName = printerLine.split(' ')[1];
        }
      }

      if (!printerName) {
        resolve({ success: false, error: 'No enabled USB printer found in CUPS' });
        return;
      }

      console.log(`[Print USB] Sending ZPL to CUPS printer: ${printerName}`);

      // Use lp with raw option to send ZPL directly
      const child = exec(
        `lp -d ${printerName} -o raw`,
        (err, stdout, stderr) => {
          if (err) {
            console.error(`[Print USB] Error: ${err.message}`);
            resolve({ success: false, error: `USB print error: ${err.message}` });
          } else {
            console.log(`[Print USB] Success: ${stdout.trim()}`);
            resolve({ success: true });
          }
        }
      );

      // Write ZPL to stdin
      if (child.stdin) {
        child.stdin.write(zplCode);
        child.stdin.end();
      }
    });
  });
}

/**
 * Send ZPL to printer via TCP or USB
 * Set printerIP to "USB" to print via USB-connected printer (CUPS)
 * Returns success/error status
 */
export async function sendToPrinter(
  zplCode: string,
  printerIP: string,
  printerPort: number = 9100
): Promise<{ success: boolean; error?: string }> {
  // USB mode: send via CUPS lp command
  if (printerIP.toUpperCase() === 'USB') {
    return sendToPrinterUSB(zplCode);
  }

  // Network mode: send via TCP
  const net = await import('net');

  return new Promise((resolve) => {
    const client = new net.Socket();

    // Set timeout
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
      resolve({ success: false, error: 'Connection timeout' });
    });
  });
}

/**
 * Default printer settings
 */
export const DEFAULT_PRINTER_SETTINGS = {
  ip: '10.0.1.13',
  port: 9100,
  labelWidth: 3, // inches
  labelHeight: 2, // inches
};
