import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { universalSearch } from '@/lib/tito';

// Badge dimensions: 4×6 inch at 300 DPI = 1200×1800 pixels
const BADGE_WIDTH = 1200;
const BADGE_HEIGHT = 1800;

// EXACT SAME positions as digital badge - DO NOT CHANGE
// These positions align with the pre-printed orange paper
const POSITIONS = {
  // "CONVOCATION 2026" - well below header in WHITE area
  convocationTitle: { y: 400, fontSize: 64 },
  // Course name - just black text, NO black bar (saves ink on ribbon printer)
  course: { y: 530, fontSize: 48 },
  // Graduate name - prominent, larger
  name: { y: 680, fontSize: 58 },
  // QR Code - centered
  qrCode: { y: 780, size: 320 },
  // Convocation number - below QR
  convNumber: { y: 1180, fontSize: 52 },
  // Collection info - below conv number
  collectionInfo: { y: 1290, fontSize: 26 },
  collectionInfo2: { y: 1330, fontSize: 26 },
  // Separator line
  separator: { y: 1410 },
  // Note at bottom (before footer)
  note: { y: 1460, fontSize: 18 },
  note2: { y: 1495, fontSize: 18 },
  // Orange footer starts at ~1680px
};

interface GraduateData {
  name: string;
  course: string;
  convocationNumber: string;
  ticketSlug?: string;
}

async function getGraduateData(convNumber: string): Promise<GraduateData | null> {
  // First try to get name from Airtable (has full name with middle names)
  const airtableResult = await getAirtableDataByConvocationNumber(convNumber);
  const airtableName = airtableResult.success && airtableResult.data ? airtableResult.data.name : null;

  // Then try Tito search for ticket info
  const searchResult = await universalSearch(convNumber);

  if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
    const graduate = searchResult.data.find(
      g => g.convocationNumber?.toUpperCase() === convNumber.toUpperCase()
    ) || searchResult.data[0];

    return {
      // ALWAYS prefer Airtable name (has full name with middle name)
      name: airtableName || graduate.name,
      course: graduate.course,
      convocationNumber: graduate.convocationNumber || convNumber,
      ticketSlug: graduate.ticketSlug,
    };
  }

  // Fallback to Airtable only
  if (airtableResult.success && airtableResult.data) {
    return {
      name: airtableResult.data.name,
      course: airtableResult.data.courseDetails || 'FMAS',
      convocationNumber: airtableResult.data.convocationNumber,
    };
  }

  return null;
}

// Print version - EXACT same layout as digital, but no background
// Prints on pre-printed orange paper
function createPrintBadgeSvg(graduate: GraduateData): string {
  const escapeXml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const name = `Dr. ${escapeXml(graduate.name)}`;
  const course = escapeXml(graduate.course);
  const convNum = escapeXml(graduate.convocationNumber);

  // EXACT SAME layout as digital badge - only difference is no background
  // Using DejaVu Sans which is available on Vercel/Linux servers
  return `
    <svg width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .title { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .course { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .name { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .conv { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .info { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; }
          .note { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; }
        </style>
      </defs>

      <!-- Transparent/White background - prints on pre-printed paper -->
      <rect width="100%" height="100%" fill="#FFFFFF"/>

      <!-- CONVOCATION 2026 Title - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convocationTitle.y}"
        text-anchor="middle"
        class="title"
        font-size="${POSITIONS.convocationTitle.fontSize}"
        fill="#000000"
      >CONVOCATION 2026</text>

      <!-- Course Name - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.course.y}"
        text-anchor="middle"
        class="course"
        font-size="${POSITIONS.course.fontSize}"
        fill="#000000"
      >${course}</text>

      <!-- Graduate Name - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.name.y}"
        text-anchor="middle"
        class="name"
        font-size="${POSITIONS.name.fontSize}"
        fill="#000000"
      >${name}</text>

      <!-- Convocation Number - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convNumber.y}"
        text-anchor="middle"
        class="conv"
        font-size="${POSITIONS.convNumber.fontSize}"
        fill="#000000"
      >${convNum}</text>

      <!-- Collection Info - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.collectionInfo.y}"
        text-anchor="middle"
        class="info"
        font-size="${POSITIONS.collectionInfo.fontSize}"
        fill="#333333"
      >Collect your certificate on 28th August 2026</text>
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.collectionInfo2.y}"
        text-anchor="middle"
        class="info"
        font-size="${POSITIONS.collectionInfo2.fontSize}"
        fill="#333333"
      >at AMASI Office (Venue)</text>

      <!-- Separator line - EXACT SAME position as digital -->
      <line
        x1="100"
        y1="${POSITIONS.separator.y}"
        x2="${BADGE_WIDTH - 100}"
        y2="${POSITIONS.separator.y}"
        stroke="#CCCCCC"
        stroke-width="1"
      />

      <!-- Note - EXACT SAME position as digital -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.note.y}"
        text-anchor="middle"
        class="note"
        font-size="${POSITIONS.note.fontSize}"
        fill="#666666"
      >This badge is valid for Convocation Ceremony only,</text>
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.note2.y}"
        text-anchor="middle"
        class="note"
        font-size="${POSITIONS.note2.fontSize}"
        fill="#666666"
      >not for AMASICON 2026 conference registration.</text>
    </svg>
  `;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ convNumber: string }> }
) {
  try {
    const { convNumber } = await params;

    if (!convNumber) {
      return NextResponse.json(
        { success: false, error: 'Convocation number is required' },
        { status: 400 }
      );
    }

    console.log(`[Badge Print API] Generating print badge for: ${convNumber}`);

    // Get graduate data
    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate not found' },
        { status: 404 }
      );
    }

    console.log(`[Badge Print API] Found graduate: ${graduate.name}`);

    // Generate QR code - EXACT SAME size as digital badge
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;

    const qrBuffer = await QRCode.toBuffer(titoUrl, {
      width: POSITIONS.qrCode.size,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      type: 'png',
    });

    // Generate print badge - EXACT SAME layout, no background
    const printBadgeSvg = createPrintBadgeSvg(graduate);

    const badge = await sharp(Buffer.from(printBadgeSvg))
      .composite([
        {
          input: qrBuffer,
          top: POSITIONS.qrCode.y,
          left: Math.floor((BADGE_WIDTH - POSITIONS.qrCode.size) / 2),
        },
      ])
      .png()
      .toBuffer();

    console.log(`[Badge Print API] Print badge generated, size: ${badge.length} bytes`);

    // Return PNG image
    return new NextResponse(new Uint8Array(badge), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="Badge_Print_${convNumber}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Badge Print API] Error generating print badge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate print badge' },
      { status: 500 }
    );
  }
}
