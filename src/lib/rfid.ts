import { ApiResponse } from '@/types';
import {
  RfidTag,
  RfidScanRecord,
  RfidStatus,
  RfidStation,
  RfidTagType,
  RfidDashboardStats,
  AirtableRfidRecord,
  EPC_GRADUATE_PATTERN,
  RFID_TO_TITO_STATION,
} from '@/types/rfid';
import { checkinAtStation } from './tito';
import { StationId } from '@/types';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Cache for RFID records
let rfidCache: Map<string, RfidTag> | null = null;
let rfidCacheTime: number = 0;
const RFID_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// ─── Airtable Helpers ────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_RFID_TABLE;

  if (!apiKey || !baseId || !tableId) {
    throw new Error('RFID Airtable configuration missing (AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_RFID_TABLE)');
  }

  return { apiKey, baseId, tableId };
}

async function rfidAirtableFetch<T>(
  endpoint: string = '',
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { apiKey, baseId, tableId } = getConfig();

  try {
    const response = await fetch(
      `${AIRTABLE_API_BASE}/${baseId}/${tableId}${endpoint}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RFID Airtable] Error: ${response.status} - ${errorText}`);
      return { success: false, error: `Airtable error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('[RFID Airtable] Network error:', error);
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ─── Record Parsing ──────────────────────────────────────────────────────────

function parseRfidRecord(record: AirtableRfidRecord): RfidTag {
  const fields = record.fields;

  let scanHistory: RfidScanRecord[] = [];
  try {
    scanHistory = fields['Scan History'] ? JSON.parse(fields['Scan History']) : [];
  } catch {
    scanHistory = [];
  }

  let boxContents: string[] = [];
  try {
    boxContents = fields['Box Contents'] ? JSON.parse(fields['Box Contents']) : [];
  } catch {
    boxContents = [];
  }

  return {
    id: record.id,
    epc: fields['EPC'] || '',
    type: (fields['Type'] as RfidTagType) || 'graduate',
    convocationNumber: fields['Convocation Number'],
    boxId: fields['Box ID'],
    graduateName: fields['Graduate Name'],
    titoTicketId: fields['Tito Ticket ID'],
    titoTicketSlug: fields['Tito Ticket Slug'],
    status: (fields['Status'] as RfidStatus) || 'encoded',
    currentStation: (fields['Current Station'] as RfidStation) || 'encoding',
    encodedAt: fields['Encoded At'] || record.createdTime,
    encodedBy: fields['Encoded By'] || '',
    lastScanAt: fields['Last Scan At'],
    lastScanBy: fields['Last Scan By'],
    lastScanStation: fields['Last Scan Station'] as RfidStation | undefined,
    scanHistory,
    boxContents,
    boxLabel: fields['Box Label'],
  };
}

function tagToAirtableFields(tag: Partial<RfidTag>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (tag.epc !== undefined) fields['EPC'] = tag.epc;
  if (tag.type !== undefined) fields['Type'] = tag.type;
  if (tag.convocationNumber !== undefined) fields['Convocation Number'] = tag.convocationNumber;
  if (tag.boxId !== undefined) fields['Box ID'] = tag.boxId;
  if (tag.graduateName !== undefined) fields['Graduate Name'] = tag.graduateName;
  if (tag.titoTicketId !== undefined) fields['Tito Ticket ID'] = String(tag.titoTicketId);
  if (tag.titoTicketSlug !== undefined) fields['Tito Ticket Slug'] = tag.titoTicketSlug;
  if (tag.status !== undefined) fields['Status'] = tag.status;
  if (tag.currentStation !== undefined) fields['Current Station'] = tag.currentStation;
  if (tag.encodedAt !== undefined) fields['Encoded At'] = tag.encodedAt;
  if (tag.encodedBy !== undefined) fields['Encoded By'] = tag.encodedBy;
  if (tag.lastScanAt !== undefined) fields['Last Scan At'] = tag.lastScanAt;
  if (tag.lastScanBy !== undefined) fields['Last Scan By'] = tag.lastScanBy;
  if (tag.lastScanStation !== undefined) fields['Last Scan Station'] = tag.lastScanStation;
  if (tag.scanHistory !== undefined) fields['Scan History'] = JSON.stringify(tag.scanHistory);
  if (tag.boxContents !== undefined) fields['Box Contents'] = JSON.stringify(tag.boxContents);
  if (tag.boxLabel !== undefined) fields['Box Label'] = tag.boxLabel;

  return fields;
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

// Fetch all RFID records with pagination
async function fetchAllRfidRecords(): Promise<AirtableRfidRecord[]> {
  const allRecords: AirtableRfidRecord[] = [];
  let offset: string | undefined;

  do {
    const endpoint = offset ? `?offset=${offset}` : '';
    const response = await rfidAirtableFetch<{
      records: AirtableRfidRecord[];
      offset?: string;
    }>(endpoint);

    if (!response.success || !response.data) {
      console.error('[RFID] Failed to fetch records:', response.error);
      break;
    }

    allRecords.push(...response.data.records);
    offset = response.data.offset;
  } while (offset);

  return allRecords;
}

// Get all RFID tags as a map keyed by EPC
export async function getRfidTagMap(): Promise<ApiResponse<Map<string, RfidTag>>> {
  const now = Date.now();

  if (rfidCache && now - rfidCacheTime < RFID_CACHE_DURATION) {
    return { success: true, data: rfidCache };
  }

  try {
    const records = await fetchAllRfidRecords();
    const tagMap = new Map<string, RfidTag>();

    for (const record of records) {
      const tag = parseRfidRecord(record);
      if (tag.epc) {
        tagMap.set(tag.epc, tag);
      }
    }

    rfidCache = tagMap;
    rfidCacheTime = now;
    console.log(`[RFID] Cached ${tagMap.size} tags`);

    return { success: true, data: tagMap };
  } catch (error) {
    if (rfidCache) {
      return { success: true, data: rfidCache };
    }
    return { success: false, error: `Failed to fetch RFID records: ${error}` };
  }
}

// Lookup a single tag by EPC
export async function getTagByEpc(epc: string): Promise<ApiResponse<RfidTag | null>> {
  const normalizedEpc = epc.toUpperCase().trim();

  // Try cache first
  const mapResult = await getRfidTagMap();
  if (mapResult.success && mapResult.data) {
    const tag = mapResult.data.get(normalizedEpc);
    if (tag) return { success: true, data: tag };
  }

  // Direct Airtable lookup (fresh, bypasses cache)
  const filterFormula = encodeURIComponent(`{EPC}="${normalizedEpc}"`);
  const response = await rfidAirtableFetch<{ records: AirtableRfidRecord[] }>(
    `?filterByFormula=${filterFormula}`
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Lookup failed' };
  }

  if (response.data.records.length === 0) {
    return { success: true, data: null };
  }

  const tag = parseRfidRecord(response.data.records[0]);
  return { success: true, data: tag };
}

// Create a new RFID tag record
export async function createRfidTag(tag: Omit<RfidTag, 'id'>): Promise<ApiResponse<RfidTag>> {
  // Check for duplicate EPC
  const existing = await getTagByEpc(tag.epc);
  if (existing.success && existing.data) {
    return { success: false, error: `EPC ${tag.epc} already exists in the system` };
  }

  const fields = tagToAirtableFields(tag);

  const response = await rfidAirtableFetch<{ id: string; fields: Record<string, unknown>; createdTime: string }>(
    '',
    {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Failed to create RFID record' };
  }

  clearRfidCache();

  const created: RfidTag = {
    ...tag,
    id: response.data.id,
  };

  return { success: true, data: created };
}

// Update an existing RFID tag record
export async function updateRfidTag(
  recordId: string,
  updates: Partial<RfidTag>
): Promise<ApiResponse<RfidTag>> {
  const fields = tagToAirtableFields(updates);

  const response = await rfidAirtableFetch<{ id: string; fields: Record<string, unknown> }>(
    `/${recordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    }
  );

  if (!response.success || !response.data) {
    return { success: false, error: response.error || 'Failed to update RFID record' };
  }

  clearRfidCache();

  // Re-fetch to get complete record
  const refreshed = await rfidAirtableFetch<{ id: string; createdTime: string; fields: Record<string, unknown> }>(
    `/${recordId}`
  );

  if (refreshed.success && refreshed.data) {
    return {
      success: true,
      data: parseRfidRecord(refreshed.data as unknown as AirtableRfidRecord),
    };
  }

  return { success: true, data: { id: recordId, ...updates } as RfidTag };
}

// ─── Scan + Tito Integration ─────────────────────────────────────────────────

// Process a single RFID scan: update Airtable + trigger Tito check-in
export async function processRfidScan(
  epc: string,
  station: RfidStation,
  scannedBy: string,
  action?: string,
  notes?: string
): Promise<ApiResponse<{ tag: RfidTag; titoCheckin?: { success: boolean; error?: string } }>> {
  const normalizedEpc = epc.toUpperCase().trim();

  // Look up the tag
  const tagResult = await getTagByEpc(normalizedEpc);
  if (!tagResult.success) {
    return { success: false, error: tagResult.error };
  }
  if (!tagResult.data) {
    return { success: false, error: `Tag ${normalizedEpc} not found. Encode it first.` };
  }

  const tag = tagResult.data;

  // Determine new status based on station
  let newStatus: RfidStatus = 'scanned';
  if (station === 'final-dispatch') newStatus = 'dispatched';
  if (station === 'handover') newStatus = 'delivered';
  if (station === 'return-ho') newStatus = 'returned';

  // Build scan record
  const scanRecord: RfidScanRecord = {
    station,
    timestamp: new Date().toISOString(),
    scannedBy,
    action: action || `Scanned at ${station}`,
    notes,
  };

  const updatedHistory = [...tag.scanHistory, scanRecord];

  // Update Airtable RFID record
  const updateResult = await updateRfidTag(tag.id, {
    status: newStatus,
    currentStation: station,
    lastScanAt: scanRecord.timestamp,
    lastScanBy: scannedBy,
    lastScanStation: station,
    scanHistory: updatedHistory,
  });

  if (!updateResult.success) {
    return { success: false, error: updateResult.error };
  }

  // Auto-trigger Tito check-in for graduate tags at mapped stations
  let titoCheckinResult: { success: boolean; error?: string } | undefined;

  if (tag.type === 'graduate' && tag.titoTicketId) {
    const titoStation = RFID_TO_TITO_STATION[station];
    if (titoStation) {
      console.log(`[RFID] Auto-triggering Tito check-in for ticket ${tag.titoTicketId} at ${titoStation}`);
      const checkinResult = await checkinAtStation(tag.titoTicketId, titoStation as StationId);
      titoCheckinResult = {
        success: checkinResult.success,
        error: checkinResult.error,
      };

      if (checkinResult.success) {
        console.log(`[RFID] Tito check-in successful for ${normalizedEpc} at ${titoStation}`);
      } else {
        console.log(`[RFID] Tito check-in note for ${normalizedEpc}: ${checkinResult.error}`);
      }
    }
  }

  return {
    success: true,
    data: {
      tag: updateResult.data!,
      titoCheckin: titoCheckinResult,
    },
  };
}

// Process multiple RFID scans
export async function processRfidBulkScan(
  epcs: string[],
  station: RfidStation,
  scannedBy: string,
  action?: string,
  notes?: string
): Promise<
  ApiResponse<{
    results: Array<{
      epc: string;
      success: boolean;
      tag?: RfidTag;
      titoCheckin?: { success: boolean; error?: string };
      error?: string;
    }>;
    summary: { total: number; successful: number; failed: number; titoCheckins: number };
  }>
> {
  const results: Array<{
    epc: string;
    success: boolean;
    tag?: RfidTag;
    titoCheckin?: { success: boolean; error?: string };
    error?: string;
  }> = [];

  let successful = 0;
  let failed = 0;
  let titoCheckins = 0;

  // Process sequentially to avoid Airtable rate limits
  for (const epc of epcs) {
    const result = await processRfidScan(epc, station, scannedBy, action, notes);

    if (result.success && result.data) {
      results.push({
        epc: epc.toUpperCase().trim(),
        success: true,
        tag: result.data.tag,
        titoCheckin: result.data.titoCheckin,
      });
      successful++;
      if (result.data.titoCheckin?.success) titoCheckins++;
    } else {
      results.push({
        epc: epc.toUpperCase().trim(),
        success: false,
        error: result.error,
      });
      failed++;
    }
  }

  return {
    success: true,
    data: {
      results,
      summary: {
        total: epcs.length,
        successful,
        failed,
        titoCheckins,
      },
    },
  };
}

// ─── Box Operations ──────────────────────────────────────────────────────────

// Add items to a box
export async function addItemsToBox(
  boxEpc: string,
  itemEpcs: string[]
): Promise<ApiResponse<RfidTag>> {
  const boxTag = await getTagByEpc(boxEpc);
  if (!boxTag.success || !boxTag.data) {
    return { success: false, error: `Box tag ${boxEpc} not found` };
  }

  if (boxTag.data.type !== 'box') {
    return { success: false, error: `${boxEpc} is not a box tag` };
  }

  const existingContents = boxTag.data.boxContents || [];
  const newContents = [...new Set([...existingContents, ...itemEpcs.map(e => e.toUpperCase().trim())])];

  return updateRfidTag(boxTag.data.id, { boxContents: newContents });
}

// Get box contents with tag details
export async function getBoxContents(
  boxEpc: string
): Promise<ApiResponse<{ box: RfidTag; items: RfidTag[] }>> {
  const boxTag = await getTagByEpc(boxEpc);
  if (!boxTag.success || !boxTag.data) {
    return { success: false, error: `Box tag ${boxEpc} not found` };
  }

  if (boxTag.data.type !== 'box') {
    return { success: false, error: `${boxEpc} is not a box tag` };
  }

  const items: RfidTag[] = [];
  for (const itemEpc of boxTag.data.boxContents || []) {
    const itemTag = await getTagByEpc(itemEpc);
    if (itemTag.success && itemTag.data) {
      items.push(itemTag.data);
    }
  }

  return { success: true, data: { box: boxTag.data, items } };
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getRfidDashboardStats(): Promise<ApiResponse<RfidDashboardStats>> {
  const mapResult = await getRfidTagMap();
  if (!mapResult.success || !mapResult.data) {
    return { success: false, error: mapResult.error };
  }

  const tags = Array.from(mapResult.data.values());

  const stats: RfidDashboardStats = {
    totalTags: tags.length,
    graduateTags: tags.filter(t => t.type === 'graduate').length,
    boxTags: tags.filter(t => t.type === 'box').length,
    encoded: tags.filter(t => t.status === 'encoded').length,
    scanned: tags.filter(t => t.status === 'scanned').length,
    dispatched: tags.filter(t => t.status === 'dispatched').length,
    delivered: tags.filter(t => t.status === 'delivered').length,
    returned: tags.filter(t => t.status === 'returned').length,
    void: tags.filter(t => t.status === 'void').length,
    stationBreakdown: {
      'encoding': 0,
      'packing': 0,
      'dispatch-venue': 0,
      'registration': 0,
      'gown-issue': 0,
      'gown-return': 0,
      'certificate-collection': 0,
      'return-ho': 0,
      'address-label': 0,
      'final-dispatch': 0,
      'handover': 0,
    },
    recentScans: [],
    boxSummary: {
      totalBoxes: 0,
      itemsInBoxes: 0,
    },
  };

  // Station breakdown
  for (const tag of tags) {
    if (tag.currentStation && tag.currentStation in stats.stationBreakdown) {
      stats.stationBreakdown[tag.currentStation]++;
    }
  }

  // Recent scans (last 50 across all tags)
  const allScans: (RfidScanRecord & { epc: string })[] = [];
  for (const tag of tags) {
    for (const scan of tag.scanHistory) {
      allScans.push({ ...scan, epc: tag.epc });
    }
  }
  allScans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  stats.recentScans = allScans.slice(0, 50);

  // Box summary
  const boxTags = tags.filter(t => t.type === 'box');
  stats.boxSummary.totalBoxes = boxTags.length;
  stats.boxSummary.itemsInBoxes = boxTags.reduce(
    (sum, box) => sum + (box.boxContents?.length || 0),
    0
  );

  return { success: true, data: stats };
}

// ─── Dispatch & Handover ─────────────────────────────────────────────────────

export async function processDispatch(
  epcs: string[],
  dispatchedBy: string,
  trackingNumber?: string,
  dispatchMethod?: string,
  notes?: string
): Promise<ApiResponse<{ successful: number; failed: number; results: Array<{ epc: string; success: boolean; error?: string }> }>> {
  const results: Array<{ epc: string; success: boolean; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  for (const epc of epcs) {
    const scanResult = await processRfidScan(
      epc,
      'final-dispatch',
      dispatchedBy,
      `Dispatched via ${dispatchMethod || 'Unknown'}`,
      [trackingNumber ? `Tracking: ${trackingNumber}` : '', notes].filter(Boolean).join(' | ')
    );

    if (scanResult.success) {
      successful++;
      results.push({ epc, success: true });
    } else {
      failed++;
      results.push({ epc, success: false, error: scanResult.error });
    }
  }

  return { success: true, data: { successful, failed, results } };
}

export async function processHandover(
  epcs: string[],
  handoverBy: string,
  handoverTo: string,
  notes?: string
): Promise<ApiResponse<{ successful: number; failed: number; results: Array<{ epc: string; success: boolean; error?: string }> }>> {
  const results: Array<{ epc: string; success: boolean; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  for (const epc of epcs) {
    const scanResult = await processRfidScan(
      epc,
      'handover',
      handoverBy,
      `Handed over to ${handoverTo}`,
      notes
    );

    if (scanResult.success) {
      successful++;
      results.push({ epc, success: true });
    } else {
      failed++;
      results.push({ epc, success: false, error: scanResult.error });
    }
  }

  return { success: true, data: { successful, failed, results } };
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconciliationResult {
  station: RfidStation;
  totalEncoded: number;
  scannedAtStation: number;
  missingCount: number;
  missing: Array<{
    epc: string;
    graduateName?: string;
    convocationNumber?: string;
    status: RfidStatus;
    currentStation: RfidStation;
  }>;
}

export async function getReconciliationForStation(
  station: RfidStation
): Promise<ApiResponse<ReconciliationResult>> {
  const mapResult = await getRfidTagMap();
  if (!mapResult.success || !mapResult.data) {
    return { success: false, error: mapResult.error };
  }

  const tags = Array.from(mapResult.data.values());

  // Only consider non-void graduate and box tags that have been encoded
  const encodedTags = tags.filter(
    (t) => t.status !== 'void' && (t.type === 'graduate' || t.type === 'box')
  );

  const missing: ReconciliationResult['missing'] = [];
  let scannedAtStation = 0;

  for (const tag of encodedTags) {
    const hasStationScan = tag.scanHistory.some((s) => s.station === station);
    if (hasStationScan) {
      scannedAtStation++;
    } else {
      missing.push({
        epc: tag.epc,
        graduateName: tag.graduateName,
        convocationNumber: tag.convocationNumber,
        status: tag.status,
        currentStation: tag.currentStation,
      });
    }
  }

  return {
    success: true,
    data: {
      station,
      totalEncoded: encodedTags.length,
      scannedAtStation,
      missingCount: missing.length,
      missing,
    },
  };
}

// ─── Cache Management ────────────────────────────────────────────────────────

export function clearRfidCache(): void {
  rfidCache = null;
  rfidCacheTime = 0;
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

export function isValidEpc(epc: string): boolean {
  if (!epc || epc.trim().length === 0) return false;
  const normalized = epc.toUpperCase().trim();
  return EPC_GRADUATE_PATTERN.test(normalized) || normalized.startsWith('BOX-');
}

export function isGraduateEpc(epc: string): boolean {
  return EPC_GRADUATE_PATTERN.test(epc.toUpperCase().trim());
}

export function isBoxEpc(epc: string): boolean {
  return epc.toUpperCase().trim().startsWith('BOX-');
}
