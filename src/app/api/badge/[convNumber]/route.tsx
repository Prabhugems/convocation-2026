import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { universalSearch } from '@/lib/tito';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Badge dimensions: 4×6 inch at 300 DPI = 1200×1800 pixels
const BADGE_WIDTH = 1200;
const BADGE_HEIGHT = 1800;

interface GraduateData {
  name: string;
  course: string;
  convocationNumber: string;
  ticketSlug?: string;
}

// Load font once and cache
let interBold: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (interBold) return interBold;

  // Try loading from public folder
  try {
    const fontPath = join(process.cwd(), 'public', 'fonts', 'Inter-Bold.woff2');
    const fontBuffer = await readFile(fontPath);
    interBold = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
    return interBold;
  } catch {
    // Fallback: fetch from Google Fonts
    const res = await fetch('https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff');
    interBold = await res.arrayBuffer();
    return interBold;
  }
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ convNumber: string }> }
) {
  try {
    const { convNumber } = await params;

    if (!convNumber) {
      return new Response(JSON.stringify({ error: 'Convocation number required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Badge API] Generating badge for: ${convNumber}`);

    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return new Response(JSON.stringify({ error: 'Graduate not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Badge API] Found graduate: ${graduate.name}`);

    // Load font
    const fontData = await loadFont();

    // Generate QR code URL
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(titoUrl)}`;

    const orangeColor = '#E85A00';

    return new ImageResponse(
      (
        <div
          style={{
            width: BADGE_WIDTH,
            height: BADGE_HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            fontFamily: 'Inter',
          }}
        >
          {/* Orange Header */}
          <div
            style={{
              width: '100%',
              height: 220,
              backgroundColor: orangeColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 700, color: '#FFFFFF' }}>AMASI</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', marginTop: 8 }}>
              Association of Minimal Access Surgeons of India
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', marginTop: 4 }}>
              College of Minimal Access Surgery
            </div>
          </div>

          {/* Content Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: 60,
            }}
          >
            <div style={{ fontSize: 56, fontWeight: 700, color: '#000000' }}>
              CONVOCATION 2026
            </div>
            <div style={{ fontSize: 42, fontWeight: 700, color: '#000000', marginTop: 40 }}>
              {graduate.course}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#000000', marginTop: 50, textAlign: 'center', maxWidth: 1000 }}>
              Dr. {graduate.name}
            </div>

            {/* QR Code */}
            <img src={qrCodeUrl} width={280} height={280} style={{ marginTop: 40 }} />

            <div style={{ fontSize: 44, fontWeight: 700, color: '#000000', marginTop: 30 }}>
              {graduate.convocationNumber}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#333333', marginTop: 40 }}>
              Collect your certificate on 28th August 2026
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#333333', marginTop: 8 }}>
              at AMASI Office (Venue)
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: '#666666', marginTop: 40 }}>
              This badge is valid for Convocation Ceremony only,
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#666666', marginTop: 4 }}>
              not for AMASICON 2026 conference registration.
            </div>
          </div>

          {/* Orange Footer */}
          <div
            style={{
              width: '100%',
              height: 100,
              backgroundColor: orangeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF' }}>
              AMASICON 2026 - Kolkata
            </div>
          </div>
        </div>
      ),
      {
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        fonts: [
          {
            name: 'Inter',
            data: fontData,
            style: 'normal',
            weight: 700,
          },
        ],
      }
    );
  } catch (error) {
    console.error('[Badge API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate badge', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
