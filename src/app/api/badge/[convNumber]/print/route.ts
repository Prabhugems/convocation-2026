import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
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

async function getGraduateData(convNumber: string): Promise<GraduateData | null> {
  try {
    const airtableResult = await getAirtableDataByConvocationNumber(convNumber);
    const airtableName = airtableResult.success && airtableResult.data ? airtableResult.data.name : null;

    const searchResult = await universalSearch(convNumber);

    if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
      const graduate = searchResult.data.find(
        g => g.convocationNumber?.toUpperCase() === convNumber.toUpperCase()
      ) || searchResult.data[0];

      return {
        name: airtableName || graduate.name,
        course: graduate.course,
        convocationNumber: graduate.convocationNumber || convNumber,
        ticketSlug: graduate.ticketSlug,
      };
    }

    if (airtableResult.success && airtableResult.data) {
      return {
        name: airtableResult.data.name,
        course: airtableResult.data.courseDetails || 'FMAS',
        convocationNumber: airtableResult.data.convocationNumber,
      };
    }

    return null;
  } catch (error) {
    console.error('[Badge Print API] Error fetching graduate data:', error);
    return null;
  }
}

async function createTextImage(text: string, fontSize: number, color: string, bgColor: string = 'FFFFFF'): Promise<Buffer> {
  const width = Math.min(text.length * fontSize * 0.6, 1000);
  const height = fontSize * 1.5;
  const url = `https://dummyimage.com/${Math.floor(width)}x${Math.floor(height)}/${bgColor.replace('#', '')}/${color.replace('#', '')}.png&text=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ convNumber: string }> }
) {
  try {
    const { convNumber } = await params;

    if (!convNumber) {
      return NextResponse.json({ error: 'Convocation number required' }, { status: 400 });
    }

    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return NextResponse.json({ error: 'Graduate not found' }, { status: 404 });
    }

    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(titoUrl)}`;
    const qrResponse = await fetch(qrCodeUrl);
    const qrBuffer = Buffer.from(await qrResponse.arrayBuffer());

    const [titleImg, courseImg, nameImg, convNumImg, info1Img, info2Img, note1Img, note2Img] = await Promise.all([
      createTextImage('CONVOCATION 2026', 48, '000000', 'FFFFFF'),
      createTextImage(graduate.course, 36, '000000', 'FFFFFF'),
      createTextImage('Dr. ' + graduate.name, 40, '000000', 'FFFFFF'),
      createTextImage(graduate.convocationNumber, 36, '000000', 'FFFFFF'),
      createTextImage('Collect your certificate on 28th August 2026', 20, '333333', 'FFFFFF'),
      createTextImage('at AMASI Office (Venue)', 20, '333333', 'FFFFFF'),
      createTextImage('This badge is valid for Convocation Ceremony only,', 14, '666666', 'FFFFFF'),
      createTextImage('not for AMASICON 2026 conference registration.', 14, '666666', 'FFFFFF'),
    ]);

    // Print version - white background only (for pre-printed paper)
    const badge = await sharp({
      create: { width: BADGE_WIDTH, height: BADGE_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
    })
      .composite([
        { input: titleImg, top: 350, left: 300 },
        { input: courseImg, top: 450, left: 400 },
        { input: nameImg, top: 550, left: 350 },
        { input: qrBuffer, top: 700, left: Math.floor((BADGE_WIDTH - 320) / 2) },
        { input: convNumImg, top: 1080, left: 450 },
        { input: info1Img, top: 1180, left: 280 },
        { input: info2Img, top: 1230, left: 420 },
        { input: note1Img, top: 1350, left: 280 },
        { input: note2Img, top: 1390, left: 280 },
      ])
      .png()
      .toBuffer();

    return new NextResponse(badge, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="Badge_Print_${convNumber}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Badge Print API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate badge', details: String(error) }, { status: 500 });
  }
}
