/**
 * ZPL (Zebra Programming Language) Template Generator
 * For Zebra ZD230 Thermal Printer
 *
 * Packing Label: 75mm × 50mm (609 x 406 dots at 203 DPI)
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
 */
const ZPL_PACKING_INIT = `
^PW609
^LL406
^MNY
^POI
`.trim();  // 75mm×50mm, gap sensing, inverted orientation

const ZPL_BADGE_INIT = `
^PW803
^LL1229
^MNY
`.trim();  // 100mm×153mm, gap sensing

/**
 * Generate ZPL code for 75mm × 50mm packing label
 *
 * Layout:
 * - Left side: CON. No- label, convocation number (bold), Dr. Name
 * - Right side: QR code with ticket URL
 *
 * FIXED: Includes label dimensions to prevent over-feeding
 */
export function generatePackingLabel(data: ZPLLabelData): string {
  // Sanitize inputs to prevent ZPL injection
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  const name = sanitizeZPL(data.name || 'Unknown');
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  // ZPL commands:
  // ^XA - Start label format
  // ^PW609 - Print Width 609 dots (75mm at 203 DPI)
  // ^LL406 - Label Length 406 dots (50mm at 203 DPI)
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
^CF0,25
^FO30,25^FDCON. No-^FS
^CF0,45
^FO30,55^FD${convNum}^FS
^CF0,30
^FO30,115^FDDr. ${name}^FS
^FO320,15^BQN,2,5^FDQA,${ticketUrl}^FS
^XZ`;
}

/**
 * Generate ZPL for 100mm × 153mm badge
 *
 * FIXED: Includes label dimensions to prevent over-feeding
 */
export function generateBadgeLabel(data: ZPLLabelData & { course?: string }): string {
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  const name = sanitizeZPL(data.name || 'Unknown');
  const course = sanitizeZPL(data.course || 'FMAS Course');
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  return `^XA
^CI28
${ZPL_BADGE_INIT}
^CF0,50
^FO50,80^FDCONVOCATION 2026^FS
^CF0,30
^FO50,150^FD${course}^FS
^CF0,40
^FO50,200^FDDr. ${name}^FS
^FO130,270^BQN,2,8^FDQA,${ticketUrl}^FS
^CF0,35
^FO50,550^FD${convNum}^FS
^CF0,18
^FO50,610^FDCollect your certificate on 28th August 2026^FS
^FO50,640^FDat AMASI Office (Venue)^FS
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
