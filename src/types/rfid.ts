// UHF RFID Tag Types and Interfaces

export type RfidTagType = 'graduate' | 'box';

export type RfidStatus =
  | 'encoded'
  | 'scanned'
  | 'dispatched'
  | 'delivered'
  | 'returned'
  | 'void';

export type RfidStation =
  | 'encoding'
  | 'packing'
  | 'dispatch-venue'
  | 'registration'
  | 'gown-issue'
  | 'gown-return'
  | 'certificate-collection'
  | 'return-ho'
  | 'address-label'
  | 'final-dispatch'
  | 'handover';

export interface RfidScanRecord {
  station: RfidStation;
  timestamp: string;
  scannedBy: string;
  action: string;
  notes?: string;
}

export interface RfidTag {
  id: string; // Airtable record ID
  epc: string; // EPC tag identifier (e.g., 118AEC1001 or BOX-001)
  type: RfidTagType;
  convocationNumber?: string; // For graduate tags
  boxId?: string; // For box tags
  graduateName?: string;
  titoTicketId?: number;
  titoTicketSlug?: string;
  status: RfidStatus;
  currentStation: RfidStation;
  encodedAt: string;
  encodedBy: string;
  lastScanAt?: string;
  lastScanBy?: string;
  lastScanStation?: RfidStation;
  scanHistory: RfidScanRecord[];
  boxContents?: string[]; // EPCs of items in the box (for box tags)
  boxLabel?: string; // Human-readable box label
}

export interface RfidEncodeRequest {
  epc: string;
  type: RfidTagType;
  convocationNumber?: string;
  boxId?: string;
  boxLabel?: string;
  encodedBy: string;
}

export interface RfidScanRequest {
  epc: string;
  station: RfidStation;
  scannedBy: string;
  action?: string;
  notes?: string;
}

export interface RfidBulkScanRequest {
  epcs: string[];
  station: RfidStation;
  scannedBy: string;
  action?: string;
  notes?: string;
}

export interface RfidVerifyRequest {
  epc: string;
}

export interface RfidDispatchRequest {
  epcs: string[];
  trackingNumber?: string;
  dispatchMethod?: 'DTDC' | 'India Post' | 'Hand Delivery';
  dispatchedBy: string;
  notes?: string;
}

export interface RfidHandoverRequest {
  epcs: string[];
  handoverTo: string;
  handoverBy: string;
  notes?: string;
}

export interface RfidBoxAddRequest {
  boxEpc: string;
  itemEpcs: string[];
}

export interface RfidDashboardStats {
  totalTags: number;
  graduateTags: number;
  boxTags: number;
  encoded: number;
  scanned: number;
  dispatched: number;
  delivered: number;
  returned: number;
  void: number;
  stationBreakdown: Record<RfidStation, number>;
  recentScans: RfidScanRecord[];
  boxSummary: {
    totalBoxes: number;
    itemsInBoxes: number;
  };
}

// Airtable RFID record shape
export interface AirtableRfidRecord {
  id: string;
  createdTime: string;
  fields: {
    'EPC'?: string;
    'Type'?: string;
    'Convocation Number'?: string;
    'Box ID'?: string;
    'Graduate Name'?: string;
    'Tito Ticket ID'?: number;
    'Tito Ticket Slug'?: string;
    'Status'?: string;
    'Current Station'?: string;
    'Encoded At'?: string;
    'Encoded By'?: string;
    'Last Scan At'?: string;
    'Last Scan By'?: string;
    'Last Scan Station'?: string;
    'Scan History'?: string; // JSON string
    'Box Contents'?: string; // JSON string of EPCs
    'Box Label'?: string;
  };
}

// WD01 desktop reader → UHF EPC conversion
// WD01 reads TID (32 hex / 16 bytes), UHF scanner reads EPC bank (24 hex / 12 bytes)
// The WD01 TID contains the UHF EPC in reversed byte order:
//   WD01: C4C2 DCAFCE816E0002A5B01180E2 0030
//   Reversed bytes: 3000 E28011B0A502006E81CEAFDC C2C4
//   UHF EPC (bytes 2-13): E28011B0A502006E81CEAFDC
export function isWd01Format(epc: string): boolean {
  return /^[0-9A-Fa-f]{32}$/.test(epc) && epc.toUpperCase().endsWith('0030');
}

export function convertWd01ToUhfEpc(wd01Epc: string): string {
  const hex = wd01Epc.toUpperCase();
  // Split into bytes, reverse order
  const bytes: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(hex.slice(i, i + 2));
  }
  bytes.reverse();
  // Skip first 2 bytes (PC word), take next 12 bytes (96-bit EPC)
  return bytes.slice(2, 14).join('');
}

// Reverse: given a 24-char UHF EPC, produce the reversed-byte substring
// that would appear inside any WD01 TID storing the same tag
export function uhfEpcToReversedHex(uhfEpc: string): string {
  const hex = uhfEpc.toUpperCase();
  const bytes: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(hex.slice(i, i + 2));
  }
  bytes.reverse();
  return bytes.join('');
}

// EPC pattern constants
// Graduate EPCs: convocation numbers like 118AEC1001 (AEC = AMASI Exam Category, WEC = Without Exam Category)
export const EPC_GRADUATE_PATTERN = /^\d+(?:AEC|WEC)\d+$/i;
export const EPC_PREFIX_BOX = 'BOX-';

// Helper to determine tag type from EPC
export function getTagTypeFromEpc(epc: string): RfidTagType | null {
  if (EPC_GRADUATE_PATTERN.test(epc)) return 'graduate';
  if (epc.startsWith(EPC_PREFIX_BOX)) return 'box';
  return null;
}

// Helper to extract convocation number from EPC
// For graduate tags, the EPC IS the convocation number
export function getConvocationFromEpc(epc: string): string | null {
  if (EPC_GRADUATE_PATTERN.test(epc)) {
    return epc.toUpperCase();
  }
  return null;
}

// Helper to extract box ID from EPC
export function getBoxIdFromEpc(epc: string): string | null {
  if (epc.startsWith(EPC_PREFIX_BOX)) {
    return epc.slice(EPC_PREFIX_BOX.length);
  }
  return null;
}

// RFID station to Tito station mapping
export const RFID_TO_TITO_STATION: Record<string, string> = {
  'packing': 'packing',
  'dispatch-venue': 'dispatch-venue',
  'registration': 'registration',
  'gown-issue': 'gown-issue',
  'gown-return': 'gown-return',
  'certificate-collection': 'certificate-collection',
  'return-ho': 'return-ho',
  'address-label': 'address-label',
  'final-dispatch': 'final-dispatch',
};
