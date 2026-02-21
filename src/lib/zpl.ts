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
const ZPL_PACKING_INIT = `
^PW440
^LL520
^MNY
^POI
^LH10,10
^MD10
`.trim();  // 55mm×65mm, gap sensing, inverted, with offset and darkness

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
 * - Left side: CON. No- label, convocation number (bold), Dr. Name
 * - Right side: QR code with ticket URL
 *
 * FIXED: Includes label dimensions to prevent over-feeding
 */
export function generatePackingLabel(data: ZPLLabelData): string {
  // Sanitize inputs to prevent ZPL injection
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  // Truncate long names to fit on label (max 18 chars for 55mm packing label)
  const name = truncateForLabel(sanitizeZPL(data.name || 'Unknown'), 18);
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  // ZPL commands:
  // ^XA - Start label format
  // ^PW440 - Print Width 440 dots (55mm at 203 DPI)
  // ^LL520 - Label Length 520 dots (65mm at 203 DPI)
  // ^MNY - Media type: Gap/notch sensing
  // ^POI - Print Orientation Inverted (fixes upside down)
  // ^CF0,size - Change font (font 0, height in dots)
  // ^FO x,y - Field origin (position from top-left)
  // ^FD text ^FS - Field data and separator
  // ^BQN,2,magnification - QR code (Normal, model 2, size)
  // ^XZ - End label format

  return `^XA
^CI28
${ZPL_PACKING_INIT}
^CF0,22
^FO25,25^FDCON. No-^FS
^CF0,40
^FO25,55^FD${convNum}^FS
^CF0,26
^FO25,110^FDDr. ${name}^FS
^FO260,15^BQN,2,4^FDQA,${ticketUrl}^FS
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
  return `~JC^XA^JUS^XZ`;
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
 * Send ZPL to printer via TCP
 * Returns success/error status
 */
export async function sendToPrinter(
  zplCode: string,
  printerIP: string,
  printerPort: number = 9100
): Promise<{ success: boolean; error?: string }> {
  // This function will be called from the API route
  // Using Node.js net module for TCP connection

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
  ip: '10.0.1.12',
  port: 9100,
  labelWidth: 3, // inches
  labelHeight: 2, // inches
};
