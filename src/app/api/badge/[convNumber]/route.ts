import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import QRCode from 'qrcode';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
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

// Create badge using satori (React-like JSX to SVG with embedded fonts)
async function createBadgeSvg(graduate: GraduateData, qrDataUrl: string): Promise<string> {
  const { fontData, fontBoldData } = await loadFonts();

  const orangeColor = '#E85A00';

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
      },
      children: [
        // Orange Header
        {
          type: 'div',
          props: {
            style: {
              width: '100%',
              height: 220,
              backgroundColor: orangeColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: 64, fontWeight: 700, color: '#FFFFFF' },
                  children: 'AMASI',
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: 22, fontWeight: 700, color: '#FFFFFF', marginTop: 8 },
                  children: 'Association of Minimal Access Surgeons of India',
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: 18, color: '#FFFFFF', marginTop: 4 },
                  children: 'College of Minimal Access Surgery',
                },
              },
            ],
          },
        },
        // Content Area
        {
          type: 'div',
          props: {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 60px',
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
        },
        // Orange Footer
        {
          type: 'div',
          props: {
            style: {
              width: '100%',
              height: 120,
              backgroundColor: orangeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: 32, fontWeight: 700, color: '#FFFFFF' },
                  children: 'AMASICON 2026 • Kolkata',
                },
              },
            ],
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
    const { searchParams } = new URL(request.url);
    const plain = searchParams.get('plain') === 'true';

    if (!convNumber) {
      return NextResponse.json(
        { success: false, error: 'Convocation number is required' },
        { status: 400 }
      );
    }

    console.log(`[Badge API] Generating badge for: ${convNumber}${plain ? ' (plain)' : ''}`);

    // Get graduate data
    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate not found' },
        { status: 404 }
      );
    }

    console.log(`[Badge API] Found graduate: ${graduate.name}`);

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

    // Generate badge SVG using satori (text is converted to paths)
    const badgeSvg = await createBadgeSvg(graduate, qrDataUrl);

    // Convert SVG to PNG using resvg (properly handles SVG paths from satori)
    const resvg = new Resvg(badgeSvg, {
      fitTo: {
        mode: 'width',
        value: BADGE_WIDTH,
      },
    });
    const pngData = resvg.render();
    let badge = Buffer.from(pngData.asPng());

    // If overlay exists and not plain mode, composite the generated badge with overlay
    const overlayPath = path.join(process.cwd(), 'public/images/badge-overlay.png');
    const hasOverlay = fs.existsSync(overlayPath);

    if (hasOverlay && !plain) {
      // Composite: overlay as base, generated badge content on top
      badge = await sharp(overlayPath)
        .resize(BADGE_WIDTH, BADGE_HEIGHT, { fit: 'fill' })
        .composite([
          {
            input: badge,
            blend: 'over',
          },
        ])
        .png()
        .toBuffer();
    }

    console.log(`[Badge API] Badge generated successfully, size: ${badge.length} bytes`);

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
