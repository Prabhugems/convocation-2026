import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
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
    console.error('[Badge API] Error fetching graduate data:', error);
    return null;
  }
}

// Generate text as PNG using placekitten alternative - use simple colored rectangles with text
async function createTextImage(text: string, fontSize: number, color: string, bgColor: string = 'transparent'): Promise<Buffer> {
  // Use dummyimage.com which reliably generates text images
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

    console.log(`[Badge API] Generating badge for: ${convNumber}`);

    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return NextResponse.json({ error: 'Graduate not found' }, { status: 404 });
    }

    console.log(`[Badge API] Found graduate: ${graduate.name}`);

    // Generate QR code using external service
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(titoUrl)}`;
    const qrResponse = await fetch(qrCodeUrl);
    const qrBuffer = Buffer.from(await qrResponse.arrayBuffer());

    // Check if overlay exists
    const overlayPath = path.join(process.cwd(), 'public/images/badge-overlay.png');
    const hasOverlay = fs.existsSync(overlayPath);

    // Create text images using dummyimage.com
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

    let badge: Buffer;

    if (hasOverlay) {
      // Use overlay as base
      badge = await sharp(overlayPath)
        .resize(BADGE_WIDTH, BADGE_HEIGHT, { fit: 'fill' })
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
    } else {
      // Create from scratch with white background
      const orangeHeader = await sharp({
        create: { width: BADGE_WIDTH, height: 220, channels: 4, background: { r: 232, g: 90, b: 0, alpha: 1 } }
      }).png().toBuffer();

      const orangeFooter = await sharp({
        create: { width: BADGE_WIDTH, height: 120, channels: 4, background: { r: 232, g: 90, b: 0, alpha: 1 } }
      }).png().toBuffer();

      badge = await sharp({
        create: { width: BADGE_WIDTH, height: BADGE_HEIGHT, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
      })
        .composite([
          { input: orangeHeader, top: 0, left: 0 },
          { input: orangeFooter, top: BADGE_HEIGHT - 120, left: 0 },
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
    }

    console.log(`[Badge API] Badge generated, size: ${badge.length} bytes`);

    return new NextResponse(badge, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="Badge_${convNumber}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Badge API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate badge', details: String(error) }, { status: 500 });
  }
}
