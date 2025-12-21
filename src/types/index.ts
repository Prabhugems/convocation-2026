export interface Graduate {
  id: string;
  registrationNumber: string;
  name: string;
  email: string;
  phone: string;
  course: 'FMAS' | 'MMAS';
  batch: string;
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

export interface TitoCheckin {
  id: number;
  slug: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone_number: string;
  reference: string;
  registration_id: string;
  ticket_id: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AirtableRecord {
  id: string;
  fields: {
    Name: string;
    Email: string;
    Phone: string;
    'Registration Number': string;
    'Address Line 1': string;
    'Address Line 2'?: string;
    City: string;
    State: string;
    Pincode: string;
    Country: string;
  };
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
