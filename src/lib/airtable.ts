import { AirtableRecord, AirtableGraduateData, Address, ApiResponse } from '@/types';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Cache for Airtable data
let airtableCache: Map<string, AirtableGraduateData> | null = null;
let airtableCacheTime: number = 0;
const AIRTABLE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function airtableFetch<T>(
  tableId: string,
  endpoint: string = '',
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return { success: false, error: 'Airtable API credentials not configured' };
  }

  try {
    const response = await fetch(`${AIRTABLE_API_BASE}/${baseId}/${tableId}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Airtable API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Parse mobile number - clean and format
function parseMobile(mobile: string | undefined | null): string {
  if (!mobile) return '';

  // Remove spaces, dashes, and common prefixes
  let cleaned = String(mobile).replace(/[\s\-()]/g, '');

  // Remove country code if present
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

// Parse address from Airtable record
function parseAddress(record: AirtableRecord): Address {
  const fields = record.fields;

  const line1 = fields['Flat/Door/Block No'] || '';
  const area = fields['Area/Locality'] || '';
  const road = fields['Road/Street/Lane'] || '';
  const line2Parts = [area, road].filter(Boolean);

  return {
    line1: line1.trim(),
    line2: line2Parts.length > 0 ? line2Parts.join(', ').trim() : undefined,
    city: (fields['City/District'] || '').trim(),
    state: (fields['STATE'] || '').trim(),
    pincode: String(fields['POSTAL/PIN  CODE'] || '').trim(),
    country: 'India',
  };
}

// Parse Airtable record to graduate data
function parseAirtableRecord(record: AirtableRecord): AirtableGraduateData | null {
  const fields = record.fields;
  const convocationNumber = fields['CONVOCATION NUMBER'];

  if (!convocationNumber) {
    return null;
  }

  // Parse DTDC service availability
  const dtdcField = fields['DTDC Service available'];
  const dtdcAvailable = dtdcField?.toUpperCase().trim() === 'YES';

  return {
    convocationNumber: convocationNumber.toUpperCase().trim(),
    name: (fields['Name'] || '').trim(),
    email: (fields['Email'] || '').toLowerCase().trim(),
    mobile: parseMobile(fields['MOBILE']),
    address: parseAddress(record),
    courseDetails: fields['Skill Course Details'],
    trackingNumber: (fields['Tracking Number'] || '').trim() || undefined,
    dtdcAvailable,
    formAUrl: (fields['Form A'] || '').trim() || undefined,
  };
}

// Fetch all records from a table with pagination
async function fetchAllFromTable(tableId: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const endpoint = offset ? `?offset=${offset}` : '';
    const response = await airtableFetch<{ records: AirtableRecord[]; offset?: string }>(
      tableId,
      endpoint
    );

    if (!response.success || !response.data) {
      console.error('Failed to fetch Airtable records:', response.error);
      break;
    }

    allRecords.push(...response.data.records);
    offset = response.data.offset;
  } while (offset);

  return allRecords;
}

// Get all Airtable records as a map by convocation number
export async function getAirtableDataMap(): Promise<ApiResponse<Map<string, AirtableGraduateData>>> {
  const now = Date.now();

  // Return cached data if still valid
  if (airtableCache && (now - airtableCacheTime) < AIRTABLE_CACHE_DURATION) {
    return { success: true, data: airtableCache };
  }

  const fmasTableId = process.env.AIRTABLE_FMAS_TABLE;
  const mmasTableId = process.env.AIRTABLE_MMAS_TABLE;

  if (!fmasTableId) {
    return { success: false, error: 'Airtable FMAS table ID not configured' };
  }

  try {
    const dataMap = new Map<string, AirtableGraduateData>();

    // Fetch FMAS table
    console.log('Fetching FMAS records from Airtable...');
    const fmasRecords = await fetchAllFromTable(fmasTableId);
    console.log(`Fetched ${fmasRecords.length} FMAS records`);

    for (const record of fmasRecords) {
      const parsed = parseAirtableRecord(record);
      if (parsed) {
        dataMap.set(parsed.convocationNumber, parsed);
      }
    }

    // Fetch MMAS table if configured
    if (mmasTableId) {
      console.log('Fetching MMAS records from Airtable...');
      const mmasRecords = await fetchAllFromTable(mmasTableId);
      console.log(`Fetched ${mmasRecords.length} MMAS records`);

      for (const record of mmasRecords) {
        const parsed = parseAirtableRecord(record);
        if (parsed && !dataMap.has(parsed.convocationNumber)) {
          dataMap.set(parsed.convocationNumber, parsed);
        }
      }
    }

    // Update cache
    airtableCache = dataMap;
    airtableCacheTime = now;

    console.log(`Total Airtable records cached: ${dataMap.size}`);
    return { success: true, data: dataMap };
  } catch (error) {
    console.error('Error fetching Airtable data:', error);

    // Return stale cache if available
    if (airtableCache) {
      return { success: true, data: airtableCache };
    }

    return { success: false, error: 'Failed to fetch Airtable data' };
  }
}

// Get data for a specific convocation number
export async function getAirtableDataByConvocationNumber(
  convocationNumber: string
): Promise<ApiResponse<AirtableGraduateData | null>> {
  const mapResult = await getAirtableDataMap();

  if (!mapResult.success || !mapResult.data) {
    return { success: false, error: mapResult.error };
  }

  const normalized = convocationNumber.toUpperCase().trim();
  const data = mapResult.data.get(normalized) || null;

  return { success: true, data };
}

// Get address by convocation number
export async function getAddressByConvocationNumber(
  convocationNumber: string
): Promise<ApiResponse<Address | null>> {
  const result = await getAirtableDataByConvocationNumber(convocationNumber);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (result.data) {
    return { success: true, data: result.data.address };
  }

  return { success: true, data: null };
}

// Get mobile by convocation number
export async function getMobileByConvocationNumber(
  convocationNumber: string
): Promise<ApiResponse<string | null>> {
  const result = await getAirtableDataByConvocationNumber(convocationNumber);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (result.data && result.data.mobile) {
    return { success: true, data: result.data.mobile };
  }

  return { success: true, data: null };
}

// Clear the cache (useful for refreshing)
export function clearAirtableCache(): void {
  airtableCache = null;
  airtableCacheTime = 0;
}

// Legacy function for backwards compatibility
export async function getAddressByRegistrationNumber(
  registrationNumber: string,
  _course: 'FMAS' | 'MMAS' = 'FMAS'
): Promise<ApiResponse<Address | null>> {
  return getAddressByConvocationNumber(registrationNumber);
}

// Legacy: Get record by email (searches through cache)
export async function getRecordByEmail(email: string): Promise<ApiResponse<AirtableGraduateData | null>> {
  const mapResult = await getAirtableDataMap();

  if (!mapResult.success || !mapResult.data) {
    return { success: false, error: mapResult.error };
  }

  const normalizedEmail = email.toLowerCase().trim();

  for (const data of mapResult.data.values()) {
    if (data.email === normalizedEmail) {
      return { success: true, data };
    }
  }

  return { success: true, data: null };
}
