import { NextRequest, NextResponse } from 'next/server';
import { recordScan, getOrCreateGraduate, getGraduate, updateGraduateAddress } from '@/lib/store';
import { getAddressByRegistrationNumber } from '@/lib/airtable';
import { StationId } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { registrationNumber, stationId, scannedBy, notes, metadata } = body;

    if (!registrationNumber || !stationId) {
      return NextResponse.json(
        { success: false, error: 'Registration number and station ID are required' },
        { status: 400 }
      );
    }

    // Get or create graduate
    let graduate = getGraduate(registrationNumber);
    if (!graduate) {
      // Try to create from the registration number
      graduate = getOrCreateGraduate(registrationNumber);
    }

    // For address-label station, fetch address from Airtable
    if (stationId === 'address-label' && !graduate.address) {
      const addressResponse = await getAddressByRegistrationNumber(
        registrationNumber,
        graduate.course
      );
      if (addressResponse.success && addressResponse.data) {
        updateGraduateAddress(registrationNumber, addressResponse.data);
        graduate = getGraduate(registrationNumber)!;
      }
    }

    // Record the scan
    const result = recordScan(
      registrationNumber,
      stationId as StationId,
      scannedBy,
      notes,
      metadata
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.graduate,
    });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const registrationNumber = searchParams.get('registrationNumber');

    if (!registrationNumber) {
      return NextResponse.json(
        { success: false, error: 'Registration number is required' },
        { status: 400 }
      );
    }

    const graduate = getGraduate(registrationNumber);

    if (!graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
