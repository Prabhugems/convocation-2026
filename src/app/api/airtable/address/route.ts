import { NextRequest, NextResponse } from 'next/server';
import { getAddressByRegistrationNumber, getRecordByEmail } from '@/lib/airtable';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const registrationNumber = searchParams.get('registrationNumber');
    const email = searchParams.get('email');
    const course = (searchParams.get('course') as 'FMAS' | 'MMAS') || 'FMAS';

    if (registrationNumber) {
      const result = await getAddressByRegistrationNumber(registrationNumber, course);
      return NextResponse.json(result);
    }

    if (email) {
      const result = await getRecordByEmail(email, course);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Registration number or email is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Airtable API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch address' },
      { status: 500 }
    );
  }
}
