import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
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

    const graduate = await getGraduateData(convNumber);

    if (!graduate) {
      return new Response(JSON.stringify({ error: 'Graduate not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber}`;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(titoUrl)}`;

    const fontData = await fetch(
      'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff'
    ).then((res) => res.arrayBuffer());

    // Print version - white background for pre-printed paper
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: '220px 60px 120px 60px',
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, color: '#000000', marginTop: 40 }}>
            CONVOCATION 2026
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#000000', marginTop: 50 }}>
            {graduate.course}
          </div>
          <div style={{ fontSize: 58, fontWeight: 700, color: '#000000', marginTop: 60, textAlign: 'center' }}>
            Dr. {graduate.name}
          </div>

          <img src={qrCodeUrl} width={320} height={320} style={{ marginTop: 50 }} />

          <div style={{ fontSize: 52, fontWeight: 700, color: '#000000', marginTop: 40 }}>
            {graduate.convocationNumber}
          </div>
          <div style={{ fontSize: 26, color: '#333333', marginTop: 50, textAlign: 'center' }}>
            Collect your certificate on 28th August 2026
          </div>
          <div style={{ fontSize: 26, color: '#333333', marginTop: 8 }}>
            at AMASI Office (Venue)
          </div>

          <div style={{ width: '80%', height: 1, backgroundColor: '#CCCCCC', marginTop: 40 }} />

          <div style={{ fontSize: 18, color: '#666666', marginTop: 30, textAlign: 'center' }}>
            This badge is valid for Convocation Ceremony only,
          </div>
          <div style={{ fontSize: 18, color: '#666666', marginTop: 8 }}>
            not for AMASICON 2026 conference registration.
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
    console.error('[Badge Print API] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate badge', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
