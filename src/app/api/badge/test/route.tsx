import { ImageResponse } from '@vercel/og';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          fontSize: 48,
          fontFamily: 'sans-serif',
        }}
      >
        Test Badge
      </div>
    ),
    {
      width: 600,
      height: 400,
    }
  );
}
