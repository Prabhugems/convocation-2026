import { NextResponse } from 'next/server';
import { getCheckinLists } from '@/lib/tito';
import { DashboardStats } from '@/types';

// Mapping from Tito check-in list titles to dashboard stat keys
const CHECKIN_LIST_MAPPING: Record<string, keyof DashboardStats> = {
  'Packing': 'packed',
  'Dispatch to Convocation': 'dispatchedToVenue',
  'Registration': 'registered',
  'Gown Issued': 'gownIssued',
  'Gown Returned': 'gownReturned',
  'Certificate Collected': 'certificateCollected',
  'Dispatch to Head Office': 'returnedToHO',
  'Address Label Printed': 'addressLabeled',
  'Dispatched DTDC': 'finalDispatched', // Will add to this
  'Dispatched India Post': 'finalDispatched', // Will add to this too
};

export async function GET() {
  try {
    console.log('[Stats API] Fetching check-in lists from Tito...');

    const result = await getCheckinLists();

    if (!result.success || !result.data) {
      console.error('[Stats API] Failed to fetch check-in lists:', result.error);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch check-in lists' },
        { status: 500 }
      );
    }

    const checkinLists = result.data;
    console.log(`[Stats API] Found ${checkinLists.length} check-in lists`);

    // Initialize stats
    const stats: DashboardStats = {
      totalGraduates: 0,
      packed: 0,
      dispatchedToVenue: 0,
      registered: 0,
      gownIssued: 0,
      gownReturned: 0,
      certificateCollected: 0,
      returnedToHO: 0,
      addressLabeled: 0,
      finalDispatched: 0,
      pendingGownDeposit: 0,
    };

    // Track DTDC and India Post separately for better reporting
    let dispatchedDTDC = 0;
    let dispatchedIndiaPost = 0;

    // Map check-in lists to stats
    for (const list of checkinLists) {
      console.log(`[Stats API] Check-in list: "${list.title}" - ${list.checked_in_count}/${list.tickets_count}`);

      // Get total from any list (they all have the same tickets_count)
      if (list.tickets_count > stats.totalGraduates) {
        stats.totalGraduates = list.tickets_count;
      }

      const statKey = CHECKIN_LIST_MAPPING[list.title];
      if (statKey) {
        if (list.title === 'Dispatched DTDC') {
          dispatchedDTDC = list.checked_in_count;
        } else if (list.title === 'Dispatched India Post') {
          dispatchedIndiaPost = list.checked_in_count;
        } else {
          stats[statKey] = list.checked_in_count;
        }
      }
    }

    // Combine DTDC and India Post for total dispatched
    stats.finalDispatched = dispatchedDTDC + dispatchedIndiaPost;

    // Calculate pending gown deposit (issued but not returned)
    stats.pendingGownDeposit = Math.max(0, stats.gownIssued - stats.gownReturned);

    console.log('[Stats API] Final stats:', stats);

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        dispatchedDTDC,
        dispatchedIndiaPost,
        checkinLists: checkinLists.map(list => ({
          title: list.title,
          slug: list.slug,
          checked_in: list.checked_in_count,
          total: list.tickets_count,
        })),
      },
    });
  } catch (error) {
    console.error('[Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
