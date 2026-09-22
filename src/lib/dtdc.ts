/**
 * DTDC Courier Tracking Integration
 *
 * Provides tracking status checks and delivery detection
 * to automatically trigger delivery confirmation emails.
 */

export interface DTDCTrackingEvent {
  date: string;
  time: string;
  status: string;
  location: string;
  remarks?: string;
}

export interface DTDCTrackingResult {
  success: boolean;
  trackingNumber: string;
  currentStatus: string;
  isDelivered: boolean;
  deliveryDate?: string;
  events: DTDCTrackingEvent[];
  error?: string;
}

const DTDC_BASE = 'https://blktracksvc.dtdc.com';

const DELIVERY_STATUSES = [
  'DELIVERED',
  'SHIPMENT DELIVERED',
  'CONSIGNMENT DELIVERED',
  'POD UPLOADED',
  'DELIVERY CONFIRMED',
];

// The x-access-token is a short-lived derived credential, not the secret
// itself (that's DTDC_TRACKING_USERNAME/PASSWORD in env). Cached in-memory
// per serverless instance only — never sent to the client, never logged.
let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL = 20 * 60 * 1000; // 20 minutes

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticate(): Promise<{ success: boolean; token?: string; error?: string }> {
  const username = process.env.DTDC_TRACKING_USERNAME;
  const password = process.env.DTDC_TRACKING_PASSWORD;

  if (!username || !password) {
    return { success: false, error: 'DTDC tracking credentials not configured' };
  }

  try {
    const url = `${DTDC_BASE}/dtdc-api/api/dtdc/authenticate?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const response = await fetchWithTimeout(url, { method: 'GET' });

    if (!response.ok) {
      console.error(`[DTDC] Authentication failed: ${response.status}`);
      return { success: false, error: `DTDC authentication failed (${response.status})` };
    }

    const token = (await response.text()).trim();
    if (!token) {
      return { success: false, error: 'DTDC authentication returned an empty token' };
    }

    cachedToken = token;
    tokenFetchedAt = Date.now();
    return { success: true, token };
  } catch (error) {
    console.error('[DTDC] Authentication network error:', error instanceof Error ? error.message : error);
    return { success: false, error: 'Network error contacting DTDC authentication' };
  }
}

async function getToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_TTL) {
    return { success: true, token: cachedToken };
  }
  return authenticate();
}

/**
 * Track a shipment using DTDC's REST Tracking API v4
 */
export async function trackShipment(trackingNumber: string): Promise<DTDCTrackingResult> {
  const trimmed = trackingNumber?.trim();
  if (!trimmed) {
    return {
      success: false,
      trackingNumber: '',
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: 'Tracking number is required',
    };
  }

  const tokenResult = await getToken();
  if (!tokenResult.success || !tokenResult.token) {
    return {
      success: false,
      trackingNumber: trimmed,
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: tokenResult.error || 'Could not authenticate with DTDC',
    };
  }

  const callTrack = (token: string) =>
    fetchWithTimeout(`${DTDC_BASE}/dtdc-api/rest/JSONCnTrk/getTrackDetails`, {
      method: 'POST',
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trkType: 'cnno', strcnno: trimmed, addtnlDtl: 'Y' }),
    });

  try {
    let response = await callTrack(tokenResult.token);

    // A cached token can go stale between calls (DTDC-side expiry, not just
    // our TTL) — retry once with a freshly authenticated token before
    // giving up, rather than surfacing a spurious auth failure.
    if (response.status === 401) {
      const retryAuth = await authenticate();
      if (!retryAuth.success || !retryAuth.token) {
        return {
          success: false,
          trackingNumber: trimmed,
          currentStatus: '',
          isDelivered: false,
          events: [],
          error: retryAuth.error || 'Could not authenticate with DTDC',
        };
      }
      response = await callTrack(retryAuth.token);
    }

    if (!response.ok) {
      console.error(`[DTDC] Track request failed: ${response.status}`);
      return {
        success: false,
        trackingNumber: trimmed,
        currentStatus: '',
        isDelivered: false,
        events: [],
        error: `DTDC tracking request failed (${response.status})`,
      };
    }

    const data = await response.json();

    if (!data.statusFlag || data.status !== 'SUCCESS') {
      const dtdcError = data.errorDetails?.find((d: { name: string; value: string }) => d.name === 'strError')?.value;
      return {
        success: false,
        trackingNumber: trimmed,
        currentStatus: '',
        isDelivered: false,
        events: [],
        error: dtdcError || 'No tracking data available for this number',
      };
    }

    const header = data.trackHeader || {};
    const events: DTDCTrackingEvent[] = (data.trackDetails || []).map((d: Record<string, string>) => ({
      date: d.strActionDate || '',
      time: d.strActionTime || '',
      status: d.strAction || '',
      location: d.strOrigin || '',
      remarks: d.sTrRemarks || '',
    }));

    const currentStatus: string = header.strStatus || events[0]?.status || 'Unknown';
    const upperStatus = currentStatus.toUpperCase();
    const isDelivered = DELIVERY_STATUSES.some(ds => upperStatus.includes(ds));
    const deliveryDate = isDelivered ? header.strStatusTransOn || events.find(e => e.status.toUpperCase().includes('DELIVERED'))?.date : undefined;

    return {
      success: true,
      trackingNumber: header.strShipmentNo || trimmed,
      currentStatus,
      isDelivered,
      deliveryDate,
      events,
    };
  } catch (error) {
    console.error('[DTDC] Tracking error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      trackingNumber: trimmed,
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Check multiple tracking numbers for delivery status
 */
export async function checkDeliveryStatus(trackingNumbers: string[]): Promise<Map<string, DTDCTrackingResult>> {
  const results = new Map<string, DTDCTrackingResult>();

  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < trackingNumbers.length; i += batchSize) {
    const batch = trackingNumbers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(tn => trackShipment(tn))
    );

    batch.forEach((tn, idx) => {
      results.set(tn, batchResults[idx]);
    });

    // Small delay between batches
    if (i + batchSize < trackingNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Get newly delivered shipments from a list of tracking numbers
 */
export async function getDeliveredShipments(trackingNumbers: string[]): Promise<DTDCTrackingResult[]> {
  const results = await checkDeliveryStatus(trackingNumbers);
  return Array.from(results.values()).filter(r => r.success && r.isDelivered);
}
