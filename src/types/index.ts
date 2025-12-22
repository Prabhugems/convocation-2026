export interface Graduate {
  id: string;
  registrationNumber: string; // Tito reference (e.g., "3YRX")
  convocationNumber: string;  // From Tito tags (e.g., "120aec1003")
  name: string;
  email: string;
  phone: string;
  course: string; // Release title (e.g., "120 FMAS Kolkata")
  titoSlug: string; // For API calls
  ticketSlug: string;
  ticketId: number; // Numeric ticket ID for check-in API
  status: ScanStatus;
  scans: ScanRecord[];
  address?: Address;
  trackingNumber?: string;
  dispatchMethod?: 'DTDC' | 'India Post';
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ScanRecord {
  station: StationId;
  timestamp: string;
  scannedBy?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type StationId =
  | 'packing'
  | 'dispatch-venue'
  | 'registration'
  | 'gown-issue'
  | 'gown-return'
  | 'certificate-collection'
  | 'return-ho'
  | 'address-label'
  | 'final-dispatch';

export interface Station {
  id: StationId;
  name: string;
  description: string;
  icon: string;
  action: string;
  printType?: '3x2-sticker' | '4x6-badge' | '4x6-label';
  collectMoney?: number;
  refundMoney?: number;
  requiresAddress?: boolean;
  requiresTracking?: boolean;
  titoCheckinListSlug?: string;
}

export interface ScanStatus {
  packed: boolean;
  dispatchedToVenue: boolean;
  registered: boolean;
  gownIssued: boolean;
  gownReturned: boolean;
  certificateCollected: boolean;
  returnedToHO: boolean;
  addressLabeled: boolean;
  finalDispatched: boolean;
}

// Tito API Types
export interface TitoRegistration {
  id: number;
  slug: string;
  name: string;
  email: string;
  phone_number: string;
  reference: string;
  state: string;
  tickets_count: number;
  created_at: string;
  updated_at: string;
}

export interface TitoTicket {
  id: number;
  slug: string;
  name: string;
  email: string;
  phone_number: string;
  reference: string;
  release_title: string;
  release_slug: string;
  tag_names: string[];
  registration_slug: string;
  created_at: string;
  updated_at: string;
}

export interface TitoRegistrationExtended extends TitoRegistration {
  tickets: TitoTicket[];
}

export interface TitoCheckinList {
  id: number;
  slug: string;
  title: string;
  checked_in_count: number;
  tickets_count: number;
}

export interface TitoCheckin {
  id: number;
  slug: string;
  ticket_slug: string;
  checked_in_at: string | null;
  deleted_at: string | null;
}

// Airtable Types
export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    'CONVOCATION NUMBER'?: string;
    'Name'?: string;
    'Email'?: string;
    'MOBILE'?: string;
    'Flat/Door/Block No'?: string;
    'Area/Locality'?: string;
    'Road/Street/Lane'?: string;
    'City/District'?: string;
    'STATE'?: string;
    'POSTAL/PIN  CODE'?: number | string;
    'Full address'?: string;
    'Skill Course Details'?: string;
    'AMASI Number'?: number;
    'Category'?: string;
    'Tracking Number'?: string;
    'DTDC Service available'?: string; // YES or NO
  };
}

// Parsed Airtable data for merging
export interface AirtableGraduateData {
  convocationNumber: string;
  name: string;
  email: string;
  mobile: string;
  address: Address;
  courseDetails?: string;
  trackingNumber?: string;
  dtdcAvailable?: boolean; // true if DTDC Service available = YES
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardStats {
  totalGraduates: number;
  packed: number;
  dispatchedToVenue: number;
  registered: number;
  gownIssued: number;
  gownReturned: number;
  certificateCollected: number;
  returnedToHO: number;
  addressLabeled: number;
  finalDispatched: number;
  pendingGownDeposit: number;
}

// Checkin list mapping to stations
export const CHECKIN_LIST_MAPPING: Record<string, StationId> = {
  'chk_pEDaCAGHy1FNgnpvbZcXNxg': 'packing',
  'chk_pvErjsyTW4NdQn3DgXkRoiA': 'dispatch-venue',
  'chk_p2UfVnVH0undd57esXyIWeg': 'registration',
  'chk_pdJWLCS1kLdcxYVX1g7z9HA': 'gown-issue',
  'chk_pbzMzIS5GqOCrs1h0jH4z6g': 'gown-return',
  'chk_pIn2aaw0MjiC2jdABMN1dsQ': 'certificate-collection',
  'chk_p6NMnIGFZY8EAf1SMwIUmvA': 'return-ho',
  'chk_p3GV4YRIJAMuu4LlTdiMGog': 'address-label',
  'chk_p1QwHGjQdVZXdWw2TRkhXWA': 'final-dispatch', // DTDC
  'chk_pExuj2TOmyhsjP5mFWQuz1g': 'final-dispatch', // India Post
};

export const STATION_CHECKIN_MAPPING: Record<StationId, string> = {
  'packing': 'chk_pEDaCAGHy1FNgnpvbZcXNxg',
  'dispatch-venue': 'chk_pvErjsyTW4NdQn3DgXkRoiA',
  'registration': 'chk_p2UfVnVH0undd57esXyIWeg',
  'gown-issue': 'chk_pdJWLCS1kLdcxYVX1g7z9HA',
  'gown-return': 'chk_pbzMzIS5GqOCrs1h0jH4z6g',
  'certificate-collection': 'chk_pIn2aaw0MjiC2jdABMN1dsQ',
  'return-ho': 'chk_p6NMnIGFZY8EAf1SMwIUmvA',
  'address-label': 'chk_p3GV4YRIJAMuu4LlTdiMGog',
  'final-dispatch': 'chk_p1QwHGjQdVZXdWw2TRkhXWA',
};
