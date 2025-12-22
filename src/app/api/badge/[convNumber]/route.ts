import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { universalSearch } from '@/lib/tito';

// Badge dimensions: 4×6 inch at 300 DPI = 1200×1800 pixels
const BADGE_WIDTH = 1200;
const BADGE_HEIGHT = 1800;

// Content positions for overlay image (Y coordinates in pixels)
// Overlay: orange header ~0-220px, white content area 220-1680px, orange footer ~1680-1800px
// White area height = 1460px, content evenly distributed
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
  note3: { y: 1530, fontSize: 18 },
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

    // Log name preference
    if (airtableName && airtableName !== graduate.name) {
      console.log(`[Badge API] Using Airtable name "${airtableName}" instead of Tito name "${graduate.name}"`);
    }

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

function createTextOverlaySvg(graduate: GraduateData): string {
  // Escape special characters for XML
  const escapeXml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const name = `Dr. ${escapeXml(graduate.name)}`;
  const course = escapeXml(graduate.course);
  const convNum = escapeXml(graduate.convocationNumber);

  // All text is BLACK on WHITE background - no filled rectangles (saves ink on ribbon printer)
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

      <!-- CONVOCATION 2026 Title - in WHITE area -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convocationTitle.y}"
        text-anchor="middle"
        class="title"
        font-size="${POSITIONS.convocationTitle.fontSize}"
        fill="#000000"
      >CONVOCATION 2026</text>

      <!-- Course Name - just text, NO black bar -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.course.y}"
        text-anchor="middle"
        class="course"
        font-size="${POSITIONS.course.fontSize}"
        fill="#000000"
      >${course}</text>

      <!-- Graduate Name with Dr. prefix -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.name.y}"
        text-anchor="middle"
        class="name"
        font-size="${POSITIONS.name.fontSize}"
        fill="#000000"
      >${name}</text>

      <!-- Convocation Number -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convNumber.y}"
        text-anchor="middle"
        class="conv"
        font-size="${POSITIONS.convNumber.fontSize}"
        fill="#000000"
      >${convNum}</text>

      <!-- Collection Info -->
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

      <!-- Separator line -->
      <line
        x1="100"
        y1="${POSITIONS.separator.y}"
        x2="${BADGE_WIDTH - 100}"
        y2="${POSITIONS.separator.y}"
        stroke="#CCCCCC"
        stroke-width="1"
      />

      <!-- Note at bottom -->
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

function createFullBadgeSvg(graduate: GraduateData): string {
  // Full badge with orange header/footer (used when no overlay image)
  const escapeXml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const name = `Dr. ${escapeXml(graduate.name)}`;
  const course = escapeXml(graduate.course);
  const convNum = escapeXml(graduate.convocationNumber);

  // Orange color from AMASI branding
  const orangeColor = '#E85A00';

  // Using DejaVu Sans which is available on Vercel/Linux servers
  return `
    <svg width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .header-text { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .title { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .course { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .name { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .conv { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
          .info { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; }
          .note { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; }
          .footer { font-family: 'DejaVu Sans', 'Liberation Sans', sans-serif; font-weight: bold; }
        </style>
      </defs>

      <!-- White background -->
      <rect width="100%" height="100%" fill="#FFFFFF"/>

      <!-- Orange header -->
      <rect x="0" y="0" width="${BADGE_WIDTH}" height="220" fill="${orangeColor}"/>

      <!-- AMASI text in header -->
      <text x="${BADGE_WIDTH / 2}" y="90" text-anchor="middle"
            class="header-text" font-size="64" fill="#FFFFFF">
        AMASI
      </text>
      <text x="${BADGE_WIDTH / 2}" y="140" text-anchor="middle"
            class="header-text" font-size="22" fill="#FFFFFF">
        Academy of Medical Aesthetic Sciences of India
      </text>
      <text x="${BADGE_WIDTH / 2}" y="190" text-anchor="middle"
            font-size="18" fill="#FFFFFF" font-family="'DejaVu Sans', 'Liberation Sans', sans-serif">
        College of Medical Aesthetic Sciences
      </text>

      <!-- CONVOCATION 2026 Title - in white area -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convocationTitle.y}"
        text-anchor="middle"
        class="title"
        font-size="${POSITIONS.convocationTitle.fontSize}"
        fill="#000000"
      >CONVOCATION 2026</text>

      <!-- Course Name - just text, no black bar -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.course.y}"
        text-anchor="middle"
        class="course"
        font-size="${POSITIONS.course.fontSize}"
        fill="#000000"
      >${course}</text>

      <!-- Graduate Name with Dr. prefix -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.name.y}"
        text-anchor="middle"
        class="name"
        font-size="${POSITIONS.name.fontSize}"
        fill="#000000"
      >${name}</text>

      <!-- Convocation Number -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convNumber.y}"
        text-anchor="middle"
        class="conv"
        font-size="${POSITIONS.convNumber.fontSize}"
        fill="#000000"
      >${convNum}</text>

      <!-- Collection Info -->
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

      <!-- Separator line -->
      <line
        x1="100"
        y1="${POSITIONS.separator.y}"
        x2="${BADGE_WIDTH - 100}"
        y2="${POSITIONS.separator.y}"
        stroke="#CCCCCC"
        stroke-width="1"
      />

      <!-- Note at bottom -->
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

      <!-- Orange footer -->
      <rect x="0" y="${BADGE_HEIGHT - 120}" width="${BADGE_WIDTH}" height="120" fill="${orangeColor}"/>

      <!-- Footer text -->
      <text x="${BADGE_WIDTH / 2}" y="${BADGE_HEIGHT - 55}" text-anchor="middle"
            class="footer" font-size="32" fill="#FFFFFF">
        AMASICON 2026 • Kolkata
      </text>
    </svg>
  `;
}

// Plain badge - white background, no orange header/footer (for direct 4×6 printing)
function createPlainBadgeSvg(graduate: GraduateData): string {
  const escapeXml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const name = `Dr. ${escapeXml(graduate.name)}`;
  const course = escapeXml(graduate.course);
  const convNum = escapeXml(graduate.convocationNumber);

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

      <!-- White background -->
      <rect width="100%" height="100%" fill="#FFFFFF"/>

      <!-- CONVOCATION 2026 Title -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convocationTitle.y}"
        text-anchor="middle"
        class="title"
        font-size="${POSITIONS.convocationTitle.fontSize}"
        fill="#000000"
      >CONVOCATION 2026</text>

      <!-- Course Name -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.course.y}"
        text-anchor="middle"
        class="course"
        font-size="${POSITIONS.course.fontSize}"
        fill="#000000"
      >${course}</text>

      <!-- Graduate Name with Dr. prefix -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.name.y}"
        text-anchor="middle"
        class="name"
        font-size="${POSITIONS.name.fontSize}"
        fill="#000000"
      >${name}</text>

      <!-- Convocation Number -->
      <text
        x="${BADGE_WIDTH / 2}"
        y="${POSITIONS.convNumber.y}"
        text-anchor="middle"
        class="conv"
        font-size="${POSITIONS.convNumber.fontSize}"
        fill="#000000"
      >${convNum}</text>

      <!-- Collection Info -->
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

      <!-- Separator line -->
      <line
        x1="100"
        y1="${POSITIONS.separator.y}"
        x2="${BADGE_WIDTH - 100}"
        y2="${POSITIONS.separator.y}"
        stroke="#CCCCCC"
        stroke-width="1"
      />

      <!-- Note at bottom -->
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
    const { searchParams } = new URL(request.url);
    const plain = searchParams.get('plain') === 'true'; // ?plain=true for no background

    if (!convNumber) {
      return NextResponse.json(
        { success: false, error: 'Convocation number is required' },
        { status: 400 }
      );
    }

    console.log(`[Badge API] Generating badge for: ${convNumber}${plain ? ' (plain/no background)' : ''}`);

    // Get graduate data
    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate not found' },
        { status: 404 }
      );
    }

    console.log(`[Badge API] Found graduate: ${graduate.name}`);

    // Generate QR code
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

    let badge: Buffer;

    if (plain) {
      // Plain badge - white background, no header/footer (for direct 4×6 printing)
      console.log('[Badge API] Generating plain badge (no background)');

      const plainBadgeSvg = createPlainBadgeSvg(graduate);

      badge = await sharp(Buffer.from(plainBadgeSvg))
        .composite([
          {
            input: qrBuffer,
            top: POSITIONS.qrCode.y,
            left: Math.floor((BADGE_WIDTH - POSITIONS.qrCode.size) / 2),
          },
        ])
        .png()
        .toBuffer();
    } else {
      // Check if overlay image exists
      const overlayPath = path.join(process.cwd(), 'public/images/badge-overlay.png');
      const hasOverlay = fs.existsSync(overlayPath);

      if (hasOverlay) {
        // Load overlay and composite text/QR on top
        console.log('[Badge API] Using overlay image');

        const textSvg = createTextOverlaySvg(graduate);

        badge = await sharp(overlayPath)
          .resize(BADGE_WIDTH, BADGE_HEIGHT, { fit: 'fill' })
          .composite([
            {
              input: Buffer.from(textSvg),
              top: 0,
              left: 0,
            },
            {
              input: qrBuffer,
              top: POSITIONS.qrCode.y,
              left: Math.floor((BADGE_WIDTH - POSITIONS.qrCode.size) / 2),
            },
          ])
          .png()
          .toBuffer();
      } else {
        // Create full badge with generated header/footer
        console.log('[Badge API] No overlay found, generating full badge');

        const fullBadgeSvg = createFullBadgeSvg(graduate);

        badge = await sharp(Buffer.from(fullBadgeSvg))
          .composite([
            {
              input: qrBuffer,
              top: POSITIONS.qrCode.y,
              left: Math.floor((BADGE_WIDTH - POSITIONS.qrCode.size) / 2),
            },
          ])
          .png()
          .toBuffer();
      }
    }

    console.log(`[Badge API] Badge generated successfully, size: ${badge.length} bytes`);

    // Return PNG image
    return new NextResponse(new Uint8Array(badge), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="Badge_${convNumber}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Badge API] Error generating badge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate badge' },
      { status: 500 }
    );
  }
}
