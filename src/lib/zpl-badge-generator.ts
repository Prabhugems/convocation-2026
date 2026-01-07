/**
 * ZPL Badge Generator for Convocation 2026
 *
 * Generates ZPL code for 4x6 inch badges (812 x 1218 dots at 203 DPI)
 * Designed for Zebra ZD230 and compatible thermal printers.
 */

export interface ConvocationBadgeData {
  name: string;
  course: string; // e.g., "FMAS", "DiPMAS", "MMAS", "120 FMAS Kolkata"
  institution?: string;
  convocationNumber: string;
  registrationId: string; // Tito ticket slug or reference
  eventName?: string;
}

// Label dimensions for 4x6 inch (203 DPI)
const LABEL_WIDTH = 812; // 4 inches * 203 DPI
const LABEL_HEIGHT = 1218; // 6 inches * 203 DPI

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
 * Extract course abbreviation from full course name
 * e.g., "120 FMAS Kolkata" -> "FMAS"
 */
function extractCourseAbbrev(course: string): string {
  if (!course) return '';

  // Look for common course abbreviations
  const abbrevs = ['FMAS', 'DiPMAS', 'MMAS', 'DipMAS'];
  for (const abbrev of abbrevs) {
    if (course.toUpperCase().includes(abbrev.toUpperCase())) {
      return abbrev;
    }
  }

  // Return original if no match
  return course;
}

/**
 * Split name into multiple lines if too long
 * Returns array of name lines (max 2)
 */
function splitNameForBadge(name: string, maxCharsPerLine: number = 20): string[] {
  const sanitized = sanitizeZPL(name);

  if (sanitized.length <= maxCharsPerLine) {
    return [sanitized];
  }

  // Try to split at space
  const words = sanitized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }

    // Max 2 lines
    if (lines.length >= 2) break;
  }

  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generate ZPL for 4x6 Convocation Badge
 *
 * Layout (top to bottom):
 * - Event name (centered, top)
 * - Name (large, centered, 1-2 lines)
 * - Course/Degree (centered)
 * - Institution (if provided)
 * - "Graduate" badge box (centered)
 * - Convocation Number
 * - QR Code (center)
 * - Registration ID (below QR)
 */
export function generateConvocationBadgeZPL(data: ConvocationBadgeData): string {
  const {
    name,
    course,
    institution = '',
    convocationNumber,
    registrationId,
    eventName = 'AMASICON 2026 Convocation',
  } = data;

  const sanitizedName = sanitizeZPL(name);
  const courseAbbrev = extractCourseAbbrev(course);
  const sanitizedInst = sanitizeZPL(institution);
  const sanitizedConvNum = sanitizeZPL(convocationNumber);
  const sanitizedRegId = sanitizeZPL(registrationId);
  const sanitizedEvent = sanitizeZPL(eventName);

  // Split name if needed
  const nameLines = splitNameForBadge(sanitizedName, 22);

  // Center X position
  const centerX = Math.floor(LABEL_WIDTH / 2);

  // Build ZPL
  let zpl = `^XA
^CI28
^PON
^LH0,0
^LL${LABEL_HEIGHT}
^PW${LABEL_WIDTH}
^MNY
^MD15
`;

  // Event name at top (centered)
  zpl += `^FO0,60^FB${LABEL_WIDTH},1,0,C,0^A0N,40,40^FD${sanitizedEvent}^FS
`;

  // Horizontal line under event
  zpl += `^FO50,120^GB${LABEL_WIDTH - 100},2,2^FS
`;

  // Name (large, centered) - handle 1 or 2 lines
  const nameStartY = 180;
  const nameFontSize = nameLines.length > 1 ? 55 : 65;

  if (nameLines.length === 1) {
    zpl += `^FO0,${nameStartY}^FB${LABEL_WIDTH},1,0,C,0^A0N,${nameFontSize},${nameFontSize}^FDDr. ${nameLines[0]}^FS
`;
  } else {
    zpl += `^FO0,${nameStartY}^FB${LABEL_WIDTH},1,0,C,0^A0N,${nameFontSize},${nameFontSize}^FDDr. ${nameLines[0]}^FS
`;
    zpl += `^FO0,${nameStartY + nameFontSize + 10}^FB${LABEL_WIDTH},1,0,C,0^A0N,${nameFontSize},${nameFontSize}^FD${nameLines[1]}^FS
`;
  }

  // Course/Degree (below name)
  const courseY = nameLines.length > 1 ? nameStartY + (nameFontSize * 2) + 30 : nameStartY + nameFontSize + 40;
  zpl += `^FO0,${courseY}^FB${LABEL_WIDTH},1,0,C,0^A0N,50,50^FD${courseAbbrev}^FS
`;

  // Institution (if provided)
  let currentY = courseY + 60;
  if (sanitizedInst) {
    zpl += `^FO0,${currentY}^FB${LABEL_WIDTH},1,0,C,0^A0N,30,30^FD${sanitizedInst}^FS
`;
    currentY += 45;
  }

  // "Graduate" badge box
  currentY += 20;
  const badgeBoxWidth = 200;
  const badgeBoxHeight = 50;
  const badgeBoxX = centerX - Math.floor(badgeBoxWidth / 2);
  zpl += `^FO${badgeBoxX},${currentY}^GB${badgeBoxWidth},${badgeBoxHeight},3,B^FS
`;
  zpl += `^FO0,${currentY + 12}^FB${LABEL_WIDTH},1,0,C,0^A0N,30,30^FDGraduate^FS
`;

  // Convocation Number
  currentY += badgeBoxHeight + 40;
  zpl += `^FO0,${currentY}^FB${LABEL_WIDTH},1,0,C,0^A0N,32,32^FDConv. No: ${sanitizedConvNum}^FS
`;

  // QR Code (centered)
  // QR at magnification 6 is approximately 150x150 dots
  currentY += 60;
  const qrSize = 6; // Magnification
  const qrWidth = 25 * qrSize; // Approximate width
  const qrX = centerX - Math.floor(qrWidth / 2);

  // QR code with registration ID as data
  const qrData = registrationId.startsWith('http')
    ? sanitizedRegId
    : `https://ti.to/tickets/${sanitizedRegId}`;
  zpl += `^FO${qrX},${currentY}^BQN,2,${qrSize}^FDQA,${qrData}^FS
`;

  // Registration ID text below QR
  currentY += qrWidth + 30;
  zpl += `^FO0,${currentY}^FB${LABEL_WIDTH},1,0,C,0^A0N,28,28^FD${sanitizedRegId}^FS
`;

  // Footer line
  zpl += `^FO50,${LABEL_HEIGHT - 80}^GB${LABEL_WIDTH - 100},2,2^FS
`;

  // Footer text
  zpl += `^FO0,${LABEL_HEIGHT - 60}^FB${LABEL_WIDTH},1,0,C,0^A0N,22,22^FDCollect your certificate on 28th August 2026^FS
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
^PON
^LH0,0
^LL${LABEL_HEIGHT}
^PW${LABEL_WIDTH}
^MNY
^MD15

^FO0,100^FB${LABEL_WIDTH},1,0,C,0^A0N,50,50^FD*** TEST PRINT ***^FS
^FO0,180^FB${LABEL_WIDTH},1,0,C,0^A0N,35,35^FDZebra Browser Print^FS
^FO0,240^FB${LABEL_WIDTH},1,0,C,0^A0N,30,30^FDConnection Successful!^FS
^FO0,310^FB${LABEL_WIDTH},1,0,C,0^A0N,28,28^FD${now}^FS

^FO${Math.floor(LABEL_WIDTH / 2) - 75},400^BQN,2,6^FDQA,TEST-PRINT-OK^FS

^FO0,600^FB${LABEL_WIDTH},1,0,C,0^A0N,25,25^FDConvocation 2026 System^FS
^FO0,640^FB${LABEL_WIDTH},1,0,C,0^A0N,22,22^FDLabel: 4" x 6" (${LABEL_WIDTH} x ${LABEL_HEIGHT} dots)^FS

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

/**
 * Generate a simple name badge (smaller, for testing)
 */
export function generateSimpleBadgeZPL(name: string, title: string = 'Graduate'): string {
  const sanitizedName = sanitizeZPL(name);
  const sanitizedTitle = sanitizeZPL(title);

  return `^XA
^CI28
^PON
^LH0,0
^LL${LABEL_HEIGHT}
^PW${LABEL_WIDTH}
^MNY
^MD15

^FO0,200^FB${LABEL_WIDTH},1,0,C,0^A0N,80,80^FD${sanitizedName}^FS
^FO0,320^FB${LABEL_WIDTH},1,0,C,0^A0N,45,45^FD${sanitizedTitle}^FS

^XZ`;
}
