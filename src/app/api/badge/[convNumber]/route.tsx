import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getAirtableDataByConvocationNumber } from '@/lib/airtable';
import { universalSearch } from '@/lib/tito';

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
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&format=png&data=${encodeURIComponent(titoUrl)}`;

    const orangeColor = '#E85A00';

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            fontFamily: 'sans-serif',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 280,
              backgroundColor: orangeColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 96, color: '#FFFFFF', fontWeight: 700 }}>AMASI</span>
            <span style={{ fontSize: 32, color: '#FFFFFF', marginTop: 12 }}>
              Association of Minimal Access Surgeons of India
            </span>
            <span style={{ fontSize: 26, color: '#FFFFFF', marginTop: 6 }}>
              College of Minimal Access Surgery
            </span>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 60,
            }}
          >
            <span style={{ fontSize: 72, color: '#000000', fontWeight: 700 }}>CONVOCATION 2026</span>
            <span style={{ fontSize: 52, color: '#000000', marginTop: 40 }}>{graduate.course}</span>
            <span style={{ fontSize: 64, color: '#000000', marginTop: 50, textAlign: 'center', maxWidth: 1000, fontWeight: 700 }}>
              Dr. {graduate.name}
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeUrl} width={320} height={320} style={{ marginTop: 45 }} alt="QR" />

            <span style={{ fontSize: 56, color: '#000000', marginTop: 35 }}>{graduate.convocationNumber}</span>
            <span style={{ fontSize: 32, color: '#333333', marginTop: 45 }}>
              Collect your certificate on 28th August 2026
            </span>
            <span style={{ fontSize: 32, color: '#333333', marginTop: 8 }}>at AMASI Office (Venue)</span>

            <span style={{ fontSize: 22, color: '#666666', marginTop: 45 }}>
              This badge is valid for Convocation Ceremony only,
            </span>
            <span style={{ fontSize: 22, color: '#666666', marginTop: 6 }}>
              not for AMASICON 2026 conference registration.
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 120,
              backgroundColor: orangeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 38, color: '#FFFFFF' }}>AMASICON 2026 - Kolkata</span>
          </div>
        </div>
      ),
      {
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
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
