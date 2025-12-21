import { NextRequest, NextResponse } from 'next/server';
import { getAllGraduates, searchGraduates, getOrCreateGraduate, getDashboardStats, initializeDemoData } from '@/lib/store';

// Initialize demo data on first request
let initialized = false;

export async function GET(request: NextRequest) {
  // Initialize demo data once
  if (!initialized) {
    initializeDemoData();
    initialized = true;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const stats = searchParams.get('stats');

    if (stats === 'true') {
      const dashboardStats = getDashboardStats();
      return NextResponse.json({
        success: true,
        data: dashboardStats,
      });
    }

    if (query) {
      const graduates = searchGraduates(query);
      return NextResponse.json({
        success: true,
        data: graduates,
      });
    }

    const graduates = getAllGraduates();
    return NextResponse.json({
      success: true,
      data: graduates,
    });
  } catch (error) {
    console.error('Graduates API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graduates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Initialize demo data once
  if (!initialized) {
    initializeDemoData();
    initialized = true;
  }

  try {
    const body = await request.json();
    const { registrationNumber, name, email, phone } = body;

    if (!registrationNumber) {
      return NextResponse.json(
        { success: false, error: 'Registration number is required' },
        { status: 400 }
      );
    }

    const graduate = getOrCreateGraduate(registrationNumber, name, email, phone);

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('Graduates API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create graduate' },
      { status: 500 }
    );
  }
}
