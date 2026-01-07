/**
 * ZPL Badge Generator for Convocation 2026
 *
 * Generates ZPL code for 4x6 inch badges (812 x 1218 dots at 203 DPI)
 * MATCHES the existing badge layout from pdfPrint.ts and PrintTemplates.tsx
 *
 * Designed for Zebra ZD230 and compatible thermal printers.
 */

export interface ConvocationBadgeData {
  name: string;
  course: string; // e.g., "120 FMAS Kolkata"
  convocationNumber: string;
  registrationId: string; // Tito ticket slug or reference (for QR code)
}

// Label dimensions for 4x6 inch (203 DPI)
const LABEL_WIDTH = 812; // 4 inches * 203 DPI
const LABEL_HEIGHT = 1218; // 6 inches * 203 DPI (approx 153mm)

// Pre-printed label zones (in dots at 203 DPI)
// Orange header: ~22mm = ~177 dots - DON'T PRINT HERE
// Orange footer: ~8mm = ~64 dots - DON'T PRINT HERE
const HEADER_ZONE = 177;
const FOOTER_ZONE = 64;

/**
 * Sanitize text for ZPL to prevent injection and encoding issues
 */
function sanitizeZPL(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\^~]/g, '') // Remove ZPL control characters
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .trim()
    .slice(0, 100); // Limit length
}

/**
 * Generate ZPL for 4x6 Convocation Badge
 *
 * MATCHES EXISTING LAYOUT from PrintTemplates.tsx Badge4x6:
 * - CONVOCATION 2026 (title)
 * - Course name
 * - Dr. [Name]
 * - QR Code (centered)
 * - Convocation Number
 * - Collection info
 * - Separator line
 * - Disclaimer
 *
 * Uses 180° rotation (^POI) to match existing design
 */
export function generateConvocationBadgeZPL(data: ConvocationBadgeData): string {
  const {
    name,
    course,
    convocationNumber,
    registrationId,
  } = data;

  const sanitizedName = sanitizeZPL(name);
  const sanitizedCourse = sanitizeZPL(course) || 'FMAS Course';
  const sanitizedConvNum = sanitizeZPL(convocationNumber);
  const sanitizedRegId = sanitizeZPL(registrationId);

  // Center X position
  const centerX = Math.floor(LABEL_WIDTH / 2);

  // QR code URL
  const qrUrl = registrationId.startsWith('http')
    ? sanitizedRegId
    : `https://ti.to/tickets/${sanitizedRegId}`;

  // Start after header zone (22mm = ~177 dots), add padding
  let y = HEADER_ZONE + 30;

  // Build ZPL - matches existing Badge4x6 layout
  let zpl = `^XA
^CI28
^POI
^LH0,0
^LL${LABEL_HEIGHT}
^PW${LABEL_WIDTH}
^MNY
^MD15
`;

  // CONVOCATION 2026 (16pt = ~32 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,32,32^FDCONVOCATION 2026^FS
`;
  y += 50;

  // Course name (12pt = ~24 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,24,24^FD${sanitizedCourse}^FS
`;
  y += 40;

  // Dr. Name (14pt = ~28 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,28,28^FDDr. ${sanitizedName}^FS
`;
  y += 45;

  // QR Code (28mm = ~224 dots, centered)
  // Using magnification 7 gives ~175 dots, magnification 8 gives ~200 dots
  const qrMag = 7;
  const qrSize = 25 * qrMag; // Approximate QR size
  const qrX = centerX - Math.floor(qrSize / 2);
  zpl += `^FO${qrX},${y}^BQN,2,${qrMag}^FDQA,${qrUrl}^FS
`;
  y += qrSize + 20;

  // Convocation Number (13pt = ~26 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,26,26^FD${sanitizedConvNum}^FS
`;
  y += 45;

  // Collection info line 1 (7pt = ~14 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,14,14^FDCollect your certificate on 28th August 2026^FS
`;
  y += 20;

  // Collection info line 2
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,14,14^FDat AMASI Office (Venue)^FS
`;
  y += 30;

  // Separator line (70% width = ~570 dots, centered)
  const lineWidth = 570;
  const lineX = centerX - Math.floor(lineWidth / 2);
  zpl += `^FO${lineX},${y}^GB${lineWidth},2,2^FS
`;
  y += 15;

  // Disclaimer (5pt = ~10 dots height)
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,10,10^FDThis badge is valid for Convocation Ceremony only,^FS
`;
  y += 14;
  zpl += `^FO0,${y}^FB${LABEL_WIDTH},1,0,C,0^A0N,10,10^FDnot for AMASICON 2026 conference registration.^FS
`;

  // End label
  zpl += `^XZ`;

  return zpl;
}

/**
 * Generate a test print ZPL for verifying printer connection
 */
export function generateTestZPL(): string {
  const now = new Date().toLocaleString();

  return `^XA
^CI28
^POI
^LH0,0
^LL${LABEL_HEIGHT}
^PW${LABEL_WIDTH}
^MNY
^MD15

^FO0,${HEADER_ZONE + 50}^FB${LABEL_WIDTH},1,0,C,0^A0N,40,40^FD*** TEST PRINT ***^FS
^FO0,${HEADER_ZONE + 110}^FB${LABEL_WIDTH},1,0,C,0^A0N,28,28^FDZebra Browser Print^FS
^FO0,${HEADER_ZONE + 150}^FB${LABEL_WIDTH},1,0,C,0^A0N,24,24^FDConnection Successful!^FS
^FO0,${HEADER_ZONE + 200}^FB${LABEL_WIDTH},1,0,C,0^A0N,20,20^FD${now}^FS

^FO${Math.floor(LABEL_WIDTH / 2) - 87},${HEADER_ZONE + 260}^BQN,2,7^FDQA,TEST-PRINT-OK^FS

^FO0,${HEADER_ZONE + 450}^FB${LABEL_WIDTH},1,0,C,0^A0N,18,18^FDConvocation 2026 System^FS
^FO0,${HEADER_ZONE + 480}^FB${LABEL_WIDTH},1,0,C,0^A0N,16,16^FDLabel: 4" x 6" (${LABEL_WIDTH} x ${LABEL_HEIGHT} dots)^FS

^XZ`;
}

/**
 * Generate ZPL calibration command
 * Run this when loading new label stock
 */
export function generateCalibrationZPL(): string {
  return `~JC^XA^JUS^XZ`;
}

/**
 * Generate ZPL to clear the print queue
 */
export function generateClearQueueZPL(): string {
  return `~JA^XA^XZ`;
}
