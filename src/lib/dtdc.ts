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

// DTDC API Configuration
const DTDC_API_KEY = process.env.DTDC_API_KEY || '';
const DTDC_API_BASE = 'https://blaboradigi.dtdc.com/dtdc-api/rest/JSONCnTrk';

// Delivery status keywords
const DELIVERY_STATUSES = [
  'DELIVERED',
  'SHIPMENT DELIVERED',
  'CONSIGNMENT DELIVERED',
  'POD UPLOADED',
  'DELIVERY CONFIRMED',
];

/**
 * Track a shipment using DTDC API
 */
export async function trackShipment(trackingNumber: string): Promise<DTDCTrackingResult> {
  if (!trackingNumber) {
    return {
      success: false,
      trackingNumber: '',
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: 'Tracking number is required',
    };
  }

  if (!DTDC_API_KEY) {
    return {
      success: false,
      trackingNumber,
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: 'DTDC API key not configured',
    };
  }

  try {
    // DTDC API request format
    const requestBody = {
      TrkType: 'cnno',
      strcnno: trackingNumber.trim(),
      addtnlDtl: 'Y',
    };

    const response = await fetch(DTDC_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': DTDC_API_KEY,
        'Api-Key': DTDC_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try alternative endpoint format
      return await trackShipmentAlternative(trackingNumber);
    }

    const data = await response.json();

    // Parse DTDC response
    if (data.error || data.Error) {
      return {
        success: false,
        trackingNumber,
        currentStatus: '',
        isDelivered: false,
        events: [],
        error: data.error || data.Error || 'Unknown API error',
      };
    }

    // Parse tracking events from response
    const events: DTDCTrackingEvent[] = [];
    let currentStatus = '';
    let isDelivered = false;
    let deliveryDate: string | undefined;

    // DTDC returns tracking info in various formats
    const trackingData = data.trackDetails || data.TrackDetails || data.data || [];

    if (Array.isArray(trackingData)) {
      for (const event of trackingData) {
        const status = event.strAction || event.Status || event.status || '';
        const date = event.strActionDate || event.Date || event.date || '';
        const time = event.strActionTime || event.Time || event.time || '';
        const location = event.strOrigin || event.Location || event.location || '';

        events.push({
          date,
          time,
          status,
          location,
          remarks: event.strRemarks || event.Remarks || '',
        });

        // Check if delivered
        const upperStatus = status.toUpperCase();
        if (DELIVERY_STATUSES.some(ds => upperStatus.includes(ds))) {
          isDelivered = true;
          deliveryDate = date;
        }
      }
    }

    // Get current status from first event (most recent)
    currentStatus = events[0]?.status || data.strStatus || 'Unknown';

    return {
      success: true,
      trackingNumber,
      currentStatus,
      isDelivered,
      deliveryDate,
      events,
    };
  } catch (error) {
    console.error('[DTDC] Tracking error:', error);
    return {
      success: false,
      trackingNumber,
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Alternative tracking method using different endpoint
 */
async function trackShipmentAlternative(trackingNumber: string): Promise<DTDCTrackingResult> {
  try {
    // Alternative DTDC endpoint
    const altUrl = `https://ctbsplusapi.dtdc.com/dtdc-staging-api/api/dtdc/tracking`;

    const response = await fetch(altUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DTDC_API_KEY}`,
      },
      body: JSON.stringify({
        consignmentNumber: trackingNumber,
        referenceNumber: trackingNumber,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        trackingNumber,
        currentStatus: '',
        isDelivered: false,
        events: [],
        error: `API returned ${response.status}`,
      };
    }

    const data = await response.json();

    // Parse response similar to main method
    const events: DTDCTrackingEvent[] = [];
    const trackingInfo = data.trackingInfo || data.tracking || data.data || [];

    let isDelivered = false;
    let deliveryDate: string | undefined;

    if (Array.isArray(trackingInfo)) {
      for (const event of trackingInfo) {
        const status = event.status || event.activity || '';
        events.push({
          date: event.date || '',
          time: event.time || '',
          status,
          location: event.location || event.city || '',
        });

        if (DELIVERY_STATUSES.some(ds => status.toUpperCase().includes(ds))) {
          isDelivered = true;
          deliveryDate = event.date;
        }
      }
    }

    return {
      success: true,
      trackingNumber,
      currentStatus: events[0]?.status || 'In Transit',
      isDelivered,
      deliveryDate,
      events,
    };
  } catch (error) {
    return {
      success: false,
      trackingNumber,
      currentStatus: '',
      isDelivered: false,
      events: [],
      error: error instanceof Error ? error.message : 'Alternative tracking failed',
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
