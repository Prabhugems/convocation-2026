import { AirtableRecord, Address, ApiResponse } from '@/types';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

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

export async function getAddressByRegistrationNumber(
  registrationNumber: string,
  course: 'FMAS' | 'MMAS' = 'FMAS'
): Promise<ApiResponse<Address | null>> {
  const tableId = course === 'FMAS'
    ? process.env.AIRTABLE_FMAS_TABLE
    : process.env.AIRTABLE_MMAS_TABLE;

  if (!tableId) {
    return { success: false, error: 'Airtable table ID not configured' };
  }

  const filterFormula = encodeURIComponent(`{Registration Number} = "${registrationNumber}"`);
  const response = await airtableFetch<{ records: AirtableRecord[] }>(
    tableId,
    `?filterByFormula=${filterFormula}&maxRecords=1`
  );

  if (response.success && response.data) {
    const record = response.data.records?.[0];
    if (record) {
      const address: Address = {
        line1: record.fields['Address Line 1'] || '',
        line2: record.fields['Address Line 2'],
        city: record.fields.City || '',
        state: record.fields.State || '',
        pincode: record.fields.Pincode || '',
        country: record.fields.Country || 'India',
      };
      return { success: true, data: address };
    }
    return { success: true, data: null };
  }
  return { success: false, error: response.error || 'Failed to fetch address' };
}

export async function getAllRecords(course: 'FMAS' | 'MMAS' = 'FMAS'): Promise<ApiResponse<AirtableRecord[]>> {
  const tableId = course === 'FMAS'
    ? process.env.AIRTABLE_FMAS_TABLE
    : process.env.AIRTABLE_MMAS_TABLE;

  if (!tableId) {
    return { success: false, error: 'Airtable table ID not configured' };
  }

  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const response = await airtableFetch<{ records: AirtableRecord[]; offset?: string }>(
      tableId,
      offset ? `?offset=${offset}` : ''
    );

    if (!response.success) {
      return { success: false, error: response.error || 'Failed to fetch records' };
    }

    if (response.data) {
      allRecords.push(...response.data.records);
      offset = response.data.offset;
    }
  } while (offset);

  return { success: true, data: allRecords };
}

export async function getRecordByEmail(
  email: string,
  course: 'FMAS' | 'MMAS' = 'FMAS'
): Promise<ApiResponse<AirtableRecord | null>> {
  const tableId = course === 'FMAS'
    ? process.env.AIRTABLE_FMAS_TABLE
    : process.env.AIRTABLE_MMAS_TABLE;

  if (!tableId) {
    return { success: false, error: 'Airtable table ID not configured' };
  }

  const filterFormula = encodeURIComponent(`{Email} = "${email}"`);
  const response = await airtableFetch<{ records: AirtableRecord[] }>(
    tableId,
    `?filterByFormula=${filterFormula}&maxRecords=1`
  );

  if (response.success && response.data) {
    return { success: true, data: response.data.records?.[0] || null };
  }
  return { success: false, error: response.error || 'Failed to fetch record' };
}
