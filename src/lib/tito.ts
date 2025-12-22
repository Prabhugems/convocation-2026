import {
  TitoRegistration,
  TitoRegistrationExtended,
  TitoTicket,
  TitoCheckinList,
  ApiResponse,
  Graduate,
  ScanStatus,
  STATION_CHECKIN_MAPPING,
  StationId,
  AirtableGraduateData
} from '@/types';
import { getAirtableDataMap } from './airtable';

const TITO_API_BASE = 'https://api.tito.io/v3';

// Cache for all graduates (populated lazily)
let graduatesCache: Graduate[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function titoFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = process.env.TITO_API_TOKEN;
  const account = process.env.TITO_ACCOUNT_SLUG;
  const event = process.env.TITO_EVENT_SLUG;

  if (!token || !account || !event) {
    return { success: false, error: 'Tito API credentials not configured' };
  }

  const url = `${TITO_API_BASE}/${account}/${event}${endpoint}`;
  console.log(`[Tito API] Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token token=${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tito API] Error: ${response.status} - ${errorText}`);
      return { success: false, error: `Tito API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`[Tito API] Success for ${endpoint}`);
    return { success: true, data };
  } catch (error) {
    console.error(`[Tito API] Network error:`, error);
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Fetch all tickets with pagination
export async function getAllTickets(): Promise<ApiResponse<TitoTicket[]>> {
  const allTickets: TitoTicket[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await titoFetch<{ tickets: TitoTicket[]; meta: { next_page: number | null } }>(
      `/tickets?page[number]=${page}&page[size]=100`
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch tickets' };
    }

    allTickets.push(...response.data.tickets);
    hasMore = response.data.meta?.next_page !== null;
    page++;
  }

  return { success: true, data: allTickets };
}

// Fetch all registrations with pagination (legacy - use getAllTickets instead)
export async function getAllRegistrations(): Promise<ApiResponse<TitoRegistration[]>> {
  const allRegistrations: TitoRegistration[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await titoFetch<{ registrations: TitoRegistration[]; meta: { next_page: number | null } }>(
      `/registrations?page[number]=${page}&page[size]=100`
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to fetch registrations' };
    }

    allRegistrations.push(...response.data.registrations);
    hasMore = response.data.meta.next_page !== null;
    page++;
  }

  return { success: true, data: allRegistrations };
}

// Fetch single ticket by slug (for QR code lookups)
export async function getTicketBySlug(ticketSlug: string): Promise<ApiResponse<TitoTicket>> {
  const response = await titoFetch<{ ticket: TitoTicket }>(
    `/tickets/${ticketSlug}`
  );

  if (response.success && response.data) {
    return { success: true, data: response.data.ticket };
  }
  return { success: false, error: response.error || 'Failed to fetch ticket' };
}

// Search tickets by query
export async function searchTickets(query: string): Promise<ApiResponse<TitoTicket[]>> {
  const response = await titoFetch<{ tickets: TitoTicket[] }>(
    `/tickets?search[q]=${encodeURIComponent(query)}`
  );

  if (response.success && response.data) {
    return { success: true, data: response.data.tickets };
  }
  return { success: false, error: response.error || 'Failed to search tickets' };
}

// Fetch single registration with extended view (includes tickets) - legacy
export async function getRegistrationExtended(slug: string): Promise<ApiResponse<TitoRegistrationExtended>> {
  const response = await titoFetch<{ registration: TitoRegistrationExtended }>(
    `/registrations/${slug}?view=extended`
  );

  if (response.success && response.data) {
    return { success: true, data: response.data.registration };
  }
  return { success: false, error: response.error || 'Failed to fetch registration' };
}

// Fetch checkin lists
export async function getCheckinLists(): Promise<ApiResponse<TitoCheckinList[]>> {
  const response = await titoFetch<{ checkin_lists: TitoCheckinList[] }>('/checkin_lists');

  if (response.success && response.data) {
    return { success: true, data: response.data.checkin_lists };
  }
  return { success: false, error: response.error || 'Failed to fetch checkin lists' };
}

// Create a checkin for a ticket using Tito Check-in API
// Note: The Check-in API uses a different base URL (https://checkin.tito.io)
// and doesn't require authentication - the checkin_list_slug serves as the auth
export async function createCheckin(checkinListSlug: string, ticketId: number): Promise<ApiResponse<{ success: boolean; uuid?: string }>> {
  const url = `https://checkin.tito.io/checkin_lists/${checkinListSlug}/checkins`;

  console.log(`[Tito Check-in API] Creating checkin at: ${url} for ticket ID: ${ticketId}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        checkin: {
          ticket_id: ticketId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tito Check-in API] Error: ${response.status} - ${errorText}`);

      // Check for duplicate checkin (422 status)
      if (response.status === 422 && errorText.includes('already')) {
        return { success: false, error: 'Ticket already checked in at this station' };
      }

      return { success: false, error: `Check-in failed: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[Tito Check-in API] Success - checkin ID: ${data.id}, UUID: ${data.uuid}`);

    return { success: true, data: { success: true, uuid: data.uuid } };
  } catch (error) {
    console.error('[Tito Check-in API] Network error:', error);
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Search registrations by reference or email
export async function searchRegistrations(query: string): Promise<ApiResponse<TitoRegistration[]>> {
  // Try by reference first
  const byRef = await titoFetch<{ registrations: TitoRegistration[] }>(
    `/registrations?q[reference_eq]=${encodeURIComponent(query.toUpperCase())}`
  );

  if (byRef.success && byRef.data && byRef.data.registrations.length > 0) {
    return { success: true, data: byRef.data.registrations };
  }

  // Try by email
  const byEmail = await titoFetch<{ registrations: TitoRegistration[] }>(
    `/registrations?q[email_cont]=${encodeURIComponent(query)}`
  );

  if (byEmail.success && byEmail.data) {
    return { success: true, data: byEmail.data.registrations };
  }

  // Try by name
  const byName = await titoFetch<{ registrations: TitoRegistration[] }>(
    `/registrations?q[name_cont]=${encodeURIComponent(query)}`
  );

  if (byName.success && byName.data) {
    return { success: true, data: byName.data.registrations };
  }

  return { success: false, error: 'No registrations found' };
}

// Convert Tito ticket to Graduate format
export function ticketToGraduate(ticket: TitoTicket): Graduate {
  const convocationNumber = ticket.tag_names?.[0] || '';

  const emptyStatus: ScanStatus = {
    packed: false,
    dispatchedToVenue: false,
    registered: false,
    gownIssued: false,
    gownReturned: false,
    certificateCollected: false,
    returnedToHO: false,
    addressLabeled: false,
    finalDispatched: false,
  };

  return {
    id: ticket.slug,
    registrationNumber: ticket.reference,
    convocationNumber: convocationNumber.toUpperCase(),
    name: ticket.name,
    email: ticket.email,
    phone: ticket.phone_number || '',
    course: ticket.release_title || 'Unknown',
    titoSlug: ticket.registration_slug,
    ticketSlug: ticket.slug,
    ticketId: ticket.id, // Numeric ID for check-in API
    status: emptyStatus,
    scans: [],
  };
}

// Convert Tito registration to Graduate format (legacy - use ticketToGraduate)
export function registrationToGraduate(reg: TitoRegistrationExtended): Graduate {
  const ticket = reg.tickets?.[0];
  const convocationNumber = ticket?.tag_names?.[0] || '';

  const emptyStatus: ScanStatus = {
    packed: false,
    dispatchedToVenue: false,
    registered: false,
    gownIssued: false,
    gownReturned: false,
    certificateCollected: false,
    returnedToHO: false,
    addressLabeled: false,
    finalDispatched: false,
  };

  return {
    id: reg.slug,
    registrationNumber: reg.reference,
    convocationNumber: convocationNumber.toUpperCase(),
    name: reg.name,
    email: reg.email,
    phone: reg.phone_number || '',
    course: ticket?.release_title || 'Unknown',
    titoSlug: reg.slug,
    ticketSlug: ticket?.slug || '',
    ticketId: ticket?.id || 0, // Numeric ID for check-in API
    status: emptyStatus,
    scans: [],
  };
}

// Check in at a station
export async function checkinAtStation(
  ticketId: number,
  stationId: StationId
): Promise<ApiResponse<{ success: boolean }>> {
  const checkinListSlug = STATION_CHECKIN_MAPPING[stationId];

  if (!checkinListSlug) {
    return { success: false, error: `No checkin list configured for station: ${stationId}` };
  }

  if (!ticketId || ticketId === 0) {
    return { success: false, error: 'Invalid ticket ID for check-in' };
  }

  return createCheckin(checkinListSlug, ticketId);
}

// Get registration by reference (for QR scan lookup)
export async function getRegistrationByReference(reference: string): Promise<ApiResponse<TitoRegistrationExtended | null>> {
  const searchResult = await titoFetch<{ registrations: TitoRegistration[] }>(
    `/registrations?q[reference_eq]=${encodeURIComponent(reference.toUpperCase())}`
  );

  if (!searchResult.success || !searchResult.data) {
    return { success: false, error: searchResult.error || 'Search failed' };
  }

  const registrations = searchResult.data.registrations;
  if (registrations.length === 0) {
    return { success: true, data: null };
  }

  // Get extended view for the first match
  return getRegistrationExtended(registrations[0].slug);
}

// Merge Tito graduate with Airtable data
function mergeWithAirtableData(
  graduate: Graduate,
  airtableMap: Map<string, AirtableGraduateData>
): Graduate {
  if (!graduate.convocationNumber) {
    return graduate;
  }

  const airtableData = airtableMap.get(graduate.convocationNumber);
  if (!airtableData) {
    return graduate;
  }

  // Log name mismatch for debugging
  if (airtableData.name && graduate.name !== airtableData.name) {
    console.log(`[Name Merge] Using Airtable name "${airtableData.name}" instead of Tito name "${graduate.name}" for ${graduate.convocationNumber}`);
  }

  // Merge data - Airtable has priority for display name
  return {
    ...graduate,
    // ALWAYS use Airtable name if available (has full name with middle name)
    name: airtableData.name || graduate.name,
    // Use Airtable mobile if Tito doesn't have one
    phone: graduate.phone || airtableData.mobile,
    // Always get address from Airtable if available
    address: airtableData.address.line1 ? airtableData.address : graduate.address,
  };
}

// Get all graduates with caching (fetches from Tito + Airtable)
export async function getAllGraduatesWithCache(): Promise<ApiResponse<Graduate[]>> {
  const now = Date.now();

  // Return cached data if still valid
  if (graduatesCache && (now - cacheTime) < CACHE_DURATION) {
    return { success: true, data: graduatesCache };
  }

  console.log('[Tito] Fetching all tickets...');

  // Fetch all tickets from Tito (direct approach, no need for extended registration calls)
  const ticketsResult = await getAllTickets();
  if (!ticketsResult.success || !ticketsResult.data) {
    // Return stale cache if available
    if (graduatesCache) {
      console.log('[Tito] Returning stale cache due to fetch error');
      return { success: true, data: graduatesCache };
    }
    return { success: false, error: ticketsResult.error || 'Failed to fetch tickets' };
  }

  console.log(`[Tito] Found ${ticketsResult.data.length} tickets`);

  // Fetch Airtable data in parallel
  console.log('[Airtable] Fetching data for merging...');
  const airtableResult = await getAirtableDataMap();
  const airtableMap = airtableResult.success && airtableResult.data
    ? airtableResult.data
    : new Map<string, AirtableGraduateData>();

  console.log(`[Airtable] Has ${airtableMap.size} records for merging`);

  // Convert tickets to graduates and merge with Airtable data
  const graduates = ticketsResult.data.map(ticket => {
    const graduate = ticketToGraduate(ticket);
    return mergeWithAirtableData(graduate, airtableMap);
  });

  console.log(`[Total] ${graduates.length} graduates after merge`);

  // Update cache
  graduatesCache = graduates;
  cacheTime = now;

  return { success: true, data: graduates };
}

// Universal search - searches across all fields with partial, case-insensitive matching
export async function universalSearch(query: string): Promise<ApiResponse<Graduate[]>> {
  if (!query || query.trim().length === 0) {
    return { success: false, error: 'Search query is required' };
  }

  const searchTerm = query.trim().toLowerCase();

  // Check if it's a Tito ticket URL or ID
  if (searchTerm.includes('ti.to/') || searchTerm.includes('tito.io/') || searchTerm.startsWith('ti_')) {
    const ticketId = searchTerm.match(/ti_[a-zA-Z0-9]+/)?.[0];
    if (ticketId) {
      // Search by ticket slug in cached data
      const cacheResult = await getAllGraduatesWithCache();
      if (cacheResult.success && cacheResult.data) {
        const matches = cacheResult.data.filter(g =>
          g.ticketSlug.toLowerCase() === ticketId.toLowerCase()
        );
        if (matches.length > 0) {
          return { success: true, data: matches };
        }
      }
    }
  }

  // For short queries (< 3 chars), require exact match on ticket lookup
  if (searchTerm.length < 3) {
    // Try direct ticket lookup if it looks like a ticket slug
    if (searchTerm.startsWith('ti_')) {
      const ticketResult = await getTicketBySlug(searchTerm);
      if (ticketResult.success && ticketResult.data) {
        return { success: true, data: [ticketToGraduate(ticketResult.data)] };
      }
    }
    return { success: false, error: 'Please enter at least 3 characters to search' };
  }

  // Get all graduates from cache
  const cacheResult = await getAllGraduatesWithCache();
  if (!cacheResult.success || !cacheResult.data) {
    // Fallback to Tito API search using tickets endpoint
    const titoResult = await searchTickets(query);
    if (titoResult.success && titoResult.data && titoResult.data.length > 0) {
      const graduates = titoResult.data.slice(0, 10).map(ticket => ticketToGraduate(ticket));
      return { success: true, data: graduates };
    }
    return { success: false, error: 'Search failed' };
  }

  // Search across all fields
  const matches = cacheResult.data.filter(graduate => {
    // Convocation number (partial, case-insensitive)
    if (graduate.convocationNumber.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Name (partial, case-insensitive)
    if (graduate.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Email (partial, case-insensitive)
    if (graduate.email.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Mobile/Phone (partial, numbers only)
    const cleanPhone = graduate.phone.replace(/[\s\-\+]/g, '');
    const cleanQuery = searchTerm.replace(/[\s\-\+]/g, '');
    if (cleanPhone.includes(cleanQuery)) {
      return true;
    }

    // Tito reference (case-insensitive)
    if (graduate.registrationNumber.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Course (partial, case-insensitive)
    if (graduate.course.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Ticket slug
    if (graduate.ticketSlug.toLowerCase().includes(searchTerm)) {
      return true;
    }

    return false;
  });

  if (matches.length === 0) {
    return { success: false, error: 'No graduates found' };
  }

  // Sort by relevance (exact matches first, then by name)
  matches.sort((a, b) => {
    // Exact convocation number match first
    const aExactConv = a.convocationNumber.toLowerCase() === searchTerm;
    const bExactConv = b.convocationNumber.toLowerCase() === searchTerm;
    if (aExactConv && !bExactConv) return -1;
    if (bExactConv && !aExactConv) return 1;

    // Exact reference match
    const aExactRef = a.registrationNumber.toLowerCase() === searchTerm;
    const bExactRef = b.registrationNumber.toLowerCase() === searchTerm;
    if (aExactRef && !bExactRef) return -1;
    if (bExactRef && !aExactRef) return 1;

    // Name starts with query
    const aNameStarts = a.name.toLowerCase().startsWith(searchTerm);
    const bNameStarts = b.name.toLowerCase().startsWith(searchTerm);
    if (aNameStarts && !bNameStarts) return -1;
    if (bNameStarts && !aNameStarts) return 1;

    // Alphabetical by name
    return a.name.localeCompare(b.name);
  });

  return { success: true, data: matches.slice(0, 50) }; // Limit to 50 results
}

// Clear the cache (call when data might have changed)
export function clearGraduatesCache(): void {
  graduatesCache = null;
  cacheTime = 0;
}

// Checkin data structure from Tito Check-in API
interface TitoCheckin {
  id: number;
  uuid: string;
  ticket_id: number;
  created_at: string;
  deleted_at: string | null;
}

// Reverse mapping: checkin list slug -> station ID
const CHECKIN_LIST_TO_STATION: Record<string, StationId> = Object.entries(STATION_CHECKIN_MAPPING)
  .reduce((acc, [stationId, slug]) => {
    acc[slug] = stationId as StationId;
    return acc;
  }, {} as Record<string, StationId>);

// Fetch check-in status for a specific ticket from all stations
export async function getTicketCheckins(ticketId: number): Promise<ApiResponse<{
  status: ScanStatus;
  scans: Array<{ station: StationId; timestamp: string }>;
}>> {
  if (!ticketId || ticketId === 0) {
    return { success: false, error: 'Invalid ticket ID' };
  }

  const status: ScanStatus = {
    packed: false,
    dispatchedToVenue: false,
    registered: false,
    gownIssued: false,
    gownReturned: false,
    certificateCollected: false,
    returnedToHO: false,
    addressLabeled: false,
    finalDispatched: false,
  };

  const scans: Array<{ station: StationId; timestamp: string }> = [];

  // Map station IDs to status keys
  const stationToStatusKey: Record<StationId, keyof ScanStatus> = {
    'packing': 'packed',
    'dispatch-venue': 'dispatchedToVenue',
    'registration': 'registered',
    'gown-issue': 'gownIssued',
    'gown-return': 'gownReturned',
    'certificate-collection': 'certificateCollected',
    'return-ho': 'returnedToHO',
    'address-label': 'addressLabeled',
    'final-dispatch': 'finalDispatched',
  };

  // Fetch checkins from each station's checkin list in parallel
  const checkinPromises = Object.entries(STATION_CHECKIN_MAPPING).map(async ([stationId, checkinListSlug]) => {
    try {
      const url = `https://checkin.tito.io/checkin_lists/${checkinListSlug}/checkins?ticket_id=${ticketId}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 30 }, // Cache for 30 seconds
      });

      if (!response.ok) {
        console.log(`[Tito Check-in] No checkins for station ${stationId}: ${response.status}`);
        return null;
      }

      const data = await response.json() as TitoCheckin[];

      // Find valid (non-deleted) checkin for THIS SPECIFIC TICKET
      // Important: The Tito API returns ALL checkins, we must filter by ticket_id
      const validCheckin = data.find(c => c.ticket_id === ticketId && !c.deleted_at);

      if (validCheckin) {
        console.log(`[Tito Check-in] ✓ Found checkin for ticket ${ticketId} at station ${stationId}`);
        return {
          stationId: stationId as StationId,
          timestamp: validCheckin.created_at,
        };
      }
      return null;
    } catch (error) {
      console.error(`[Tito Check-in] Error fetching checkins for ${stationId}:`, error);
      return null;
    }
  });

  const results = await Promise.all(checkinPromises);

  // Process results
  for (const result of results) {
    if (result) {
      const statusKey = stationToStatusKey[result.stationId];
      if (statusKey) {
        status[statusKey] = true;
        scans.push({
          station: result.stationId,
          timestamp: result.timestamp,
        });
      }
    }
  }

  // Sort scans by timestamp
  scans.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { success: true, data: { status, scans } };
}

// Get graduate with real check-in status from Tito
export async function getGraduateWithCheckins(ticketSlug: string): Promise<ApiResponse<Graduate>> {
  // First get the ticket
  const ticketResult = await getTicketBySlug(ticketSlug);
  if (!ticketResult.success || !ticketResult.data) {
    return { success: false, error: ticketResult.error || 'Ticket not found' };
  }

  const graduate = ticketToGraduate(ticketResult.data);

  // Fetch real check-in status
  const checkinsResult = await getTicketCheckins(ticketResult.data.id);
  if (checkinsResult.success && checkinsResult.data) {
    graduate.status = checkinsResult.data.status;
    graduate.scans = checkinsResult.data.scans;
  }

  return { success: true, data: graduate };
}
