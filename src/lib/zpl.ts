/**
 * ZPL (Zebra Programming Language) Template Generator
 * For Zebra ZD230 Thermal Printer
 *
 * Label size: 3 x 2 inches (609 x 406 dots at 203 DPI)
 */

export interface ZPLLabelData {
  convocationNumber: string;
  name: string;
  ticketUrl: string;
}

/**
 * Generate ZPL code for 3x2 inch packing label
 *
 * Layout:
 * - Left side: CON. No- label, convocation number (bold), Dr. Name
 * - Right side: QR code with ticket URL
 */
export function generatePackingLabel(data: ZPLLabelData): string {
  // Sanitize inputs to prevent ZPL injection
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  const name = sanitizeZPL(data.name || 'Unknown');
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  // ZPL commands:
  // ^XA - Start label format
  // ^CF0,size - Change font (font 0, height in dots)
  // ^FO x,y - Field origin (position from top-left)
  // ^FD text ^FS - Field data and separator
  // ^BQN,2,magnification - QR code (Normal, model 2, size)
  // ^XZ - End label format

  return `^XA
^CI28
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
 * Generate ZPL for 4x6 inch badge
 */
export function generateBadgeLabel(data: ZPLLabelData & { course?: string }): string {
  const convNum = sanitizeZPL(data.convocationNumber || 'N/A');
  const name = sanitizeZPL(data.name || 'Unknown');
  const course = sanitizeZPL(data.course || 'FMAS Course');
  const ticketUrl = sanitizeZPL(data.ticketUrl || '');

  return `^XA
^CI28
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
