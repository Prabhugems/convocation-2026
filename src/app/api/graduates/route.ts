import { NextRequest, NextResponse } from 'next/server';
import { getAllGraduatesWithCache } from '@/lib/tito';
import { Graduate } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const stats = searchParams.get('stats');

    // Get all graduates with caching
    const result = await getAllGraduatesWithCache();

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch graduates' },
        { status: 500 }
      );
    }

    const allGraduates = result.data;

    if (stats === 'true') {
      // Calculate stats from all graduates
      const dashboardStats = {
        totalGraduates: allGraduates.length,
        packed: allGraduates.filter(g => g.status.packed).length,
        dispatchedToVenue: allGraduates.filter(g => g.status.dispatchedToVenue).length,
        registered: allGraduates.filter(g => g.status.registered).length,
        gownIssued: allGraduates.filter(g => g.status.gownIssued).length,
        gownReturned: allGraduates.filter(g => g.status.gownReturned).length,
        certificateCollected: allGraduates.filter(g => g.status.certificateCollected).length,
        returnedToHO: allGraduates.filter(g => g.status.returnedToHO).length,
        addressLabeled: allGraduates.filter(g => g.status.addressLabeled).length,
        finalDispatched: allGraduates.filter(g => g.status.finalDispatched).length,
        pendingGownDeposit: allGraduates.filter(g => g.status.gownIssued && !g.status.gownReturned).length,
      };

      return NextResponse.json({
        success: true,
        data: dashboardStats,
      });
    }

    // Filter by search query if provided
    let filteredGraduates = allGraduates;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredGraduates = allGraduates.filter(
        (g) =>
          g.name.toLowerCase().includes(lowerQuery) ||
          g.registrationNumber.toLowerCase().includes(lowerQuery) ||
          g.email.toLowerCase().includes(lowerQuery) ||
          g.convocationNumber?.toLowerCase().includes(lowerQuery) ||
          g.phone?.replace(/[\s\-\+]/g, '').includes(lowerQuery.replace(/[\s\-\+]/g, '')) ||
          g.course.toLowerCase().includes(lowerQuery)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredGraduates,
      meta: {
        total: filteredGraduates.length,
        allTotal: allGraduates.length,
      },
    });
  } catch (error) {
    console.error('Graduates API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graduates' },
      { status: 500 }
    );
  }
}
