import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { universalSearch } from '@/lib/tito';

// Badge dimensions: 4×6 inch at 300 DPI = 1200×1800 pixels
const BADGE_WIDTH = 1200;
const BADGE_HEIGHT = 1800;

interface GraduateData {
  name: string;
  course: string;
  convocationNumber: string;
  ticketSlug?: string;
}

// Cache font data
let fontData: ArrayBuffer | null = null;
let fontBoldData: ArrayBuffer | null = null;

async function loadFonts() {
  if (!fontData || !fontBoldData) {
    // Fetch Inter font from Google Fonts (reliable, always available)
    const [regularRes, boldRes] = await Promise.all([
      fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff'),
      fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff'),
    ]);
    fontData = await regularRes.arrayBuffer();
    fontBoldData = await boldRes.arrayBuffer();
  }
  return { fontData, fontBoldData };
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

// Create print badge using satori - white background for pre-printed paper
async function createPrintBadgeSvg(graduate: GraduateData, qrDataUrl: string): Promise<string> {
  const { fontData, fontBoldData } = await loadFonts();

  const element = {
    type: 'div',
    props: {
      style: {
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Inter',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '220px 60px 120px 60px', // Account for header/footer space on pre-printed paper
      },
      children: [
        // CONVOCATION 2026
        {
          type: 'div',
          props: {
            style: { fontSize: 64, fontWeight: 700, color: '#000000', marginTop: 40 },
            children: 'CONVOCATION 2026',
          },
        },
        // Course
        {
          type: 'div',
          props: {
            style: { fontSize: 48, fontWeight: 700, color: '#000000', marginTop: 50 },
            children: graduate.course,
          },
        },
        // Name
        {
          type: 'div',
          props: {
            style: { fontSize: 58, fontWeight: 700, color: '#000000', marginTop: 60, textAlign: 'center' },
            children: `Dr. ${graduate.name}`,
          },
        },
        // QR Code
        {
          type: 'img',
          props: {
            src: qrDataUrl,
            width: 320,
            height: 320,
            style: { marginTop: 50 },
          },
        },
        // Convocation Number
        {
          type: 'div',
          props: {
            style: { fontSize: 52, fontWeight: 700, color: '#000000', marginTop: 40 },
            children: graduate.convocationNumber,
          },
        },
        // Collection Info
        {
          type: 'div',
          props: {
            style: { fontSize: 26, color: '#333333', marginTop: 50, textAlign: 'center' },
            children: 'Collect your certificate on 28th August 2026',
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 26, color: '#333333', marginTop: 8 },
            children: 'at AMASI Office (Venue)',
          },
        },
        // Separator
        {
          type: 'div',
          props: {
            style: { width: '80%', height: 1, backgroundColor: '#CCCCCC', marginTop: 40 },
          },
        },
        // Note
        {
          type: 'div',
          props: {
            style: { fontSize: 18, color: '#666666', marginTop: 30, textAlign: 'center' },
            children: 'This badge is valid for Convocation Ceremony only,',
          },
        },
        {
          type: 'div',
          props: {
            style: { fontSize: 18, color: '#666666', marginTop: 8 },
            children: 'not for AMASICON 2026 conference registration.',
          },
        },
      ],
    },
  };

  const svg = await satori(element, {
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
    fonts: [
      {
        name: 'Inter',
        data: fontData!,
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Inter',
        data: fontBoldData!,
        weight: 700,
        style: 'normal',
      },
    ],
  });

  return svg;
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

    // Generate QR code as data URL for embedding in satori
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;

    const qrDataUrl = await QRCode.toDataURL(titoUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Generate print badge SVG using satori
    const badgeSvg = await createPrintBadgeSvg(graduate, qrDataUrl);

    // Convert SVG to PNG using resvg (properly handles SVG paths from satori)
    const resvg = new Resvg(badgeSvg, {
      fitTo: {
        mode: 'width',
        value: BADGE_WIDTH,
      },
    });
    const pngData = resvg.render();
    const badge = Buffer.from(pngData.asPng());

    console.log(`[Badge Print API] Print badge generated, size: ${badge.length} bytes`);

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
