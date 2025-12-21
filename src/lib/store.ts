import { Graduate, ScanRecord, ScanStatus, StationId, DashboardStats } from '@/types';
import { getStationStatus } from './stations';

// In-memory store for demo purposes
// In production, replace with a database (PostgreSQL, MongoDB, etc.)
const graduates: Map<string, Graduate> = new Map();

function createEmptyStatus(): ScanStatus {
  return {
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
}

export function getOrCreateGraduate(registrationNumber: string, name?: string, email?: string, phone?: string): Graduate {
  let graduate = graduates.get(registrationNumber);

  if (!graduate) {
    graduate = {
      id: registrationNumber,
      registrationNumber,
      name: name || 'Unknown',
      email: email || '',
      phone: phone || '',
      course: 'FMAS',
      batch: '2026',
      status: createEmptyStatus(),
      scans: [],
    };
    graduates.set(registrationNumber, graduate);
  } else if (name || email || phone) {
    // Update info if provided
    if (name) graduate.name = name;
    if (email) graduate.email = email;
    if (phone) graduate.phone = phone;
  }

  return graduate;
}

export function getGraduate(registrationNumber: string): Graduate | undefined {
  return graduates.get(registrationNumber);
}

export function getAllGraduates(): Graduate[] {
  return Array.from(graduates.values());
}

export function recordScan(
  registrationNumber: string,
  stationId: StationId,
  scannedBy?: string,
  notes?: string,
  metadata?: Record<string, unknown>
): { success: boolean; graduate?: Graduate; error?: string } {
  const graduate = graduates.get(registrationNumber);

  if (!graduate) {
    return { success: false, error: 'Graduate not found. Please ensure the certificate is registered in the system.' };
  }

  const statusKey = getStationStatus(stationId);

  // Check if already scanned at this station
  if (graduate.status[statusKey]) {
    return { success: false, error: `Already scanned at ${stationId} station` };
  }

  // Create scan record
  const scanRecord: ScanRecord = {
    station: stationId,
    timestamp: new Date().toISOString(),
    scannedBy,
    notes,
    metadata,
  };

  // Update graduate
  graduate.scans.push(scanRecord);
  graduate.status[statusKey] = true;

  // Handle special cases
  if (stationId === 'final-dispatch' && metadata?.trackingNumber) {
    graduate.trackingNumber = metadata.trackingNumber as string;
    graduate.dispatchMethod = metadata.dispatchMethod as 'DTDC' | 'India Post';
  }

  return { success: true, graduate };
}

export function updateGraduateAddress(registrationNumber: string, address: Graduate['address']): boolean {
  const graduate = graduates.get(registrationNumber);
  if (graduate) {
    graduate.address = address;
    return true;
  }
  return false;
}

export function getDashboardStats(): DashboardStats {
  const allGraduates = getAllGraduates();

  return {
    totalGraduates: allGraduates.length,
    packed: allGraduates.filter((g) => g.status.packed).length,
    dispatchedToVenue: allGraduates.filter((g) => g.status.dispatchedToVenue).length,
    registered: allGraduates.filter((g) => g.status.registered).length,
    gownIssued: allGraduates.filter((g) => g.status.gownIssued).length,
    gownReturned: allGraduates.filter((g) => g.status.gownReturned).length,
    certificateCollected: allGraduates.filter((g) => g.status.certificateCollected).length,
    returnedToHO: allGraduates.filter((g) => g.status.returnedToHO).length,
    addressLabeled: allGraduates.filter((g) => g.status.addressLabeled).length,
    finalDispatched: allGraduates.filter((g) => g.status.finalDispatched).length,
    pendingGownDeposit: allGraduates.filter((g) => g.status.gownIssued && !g.status.gownReturned).length,
  };
}

export function searchGraduates(query: string): Graduate[] {
  const lowerQuery = query.toLowerCase();
  return getAllGraduates().filter(
    (g) =>
      g.name.toLowerCase().includes(lowerQuery) ||
      g.registrationNumber.toLowerCase().includes(lowerQuery) ||
      g.email.toLowerCase().includes(lowerQuery)
  );
}

// Initialize with some demo data
export function initializeDemoData(): void {
  const demoGraduates = [
    { reg: 'FMAS2026001', name: 'Arun Kumar', email: 'arun@example.com', phone: '+91 98765 43210' },
    { reg: 'FMAS2026002', name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43211' },
    { reg: 'FMAS2026003', name: 'Rahul Verma', email: 'rahul@example.com', phone: '+91 98765 43212' },
    { reg: 'FMAS2026004', name: 'Sneha Patel', email: 'sneha@example.com', phone: '+91 98765 43213' },
    { reg: 'FMAS2026005', name: 'Vikram Singh', email: 'vikram@example.com', phone: '+91 98765 43214' },
  ];

  demoGraduates.forEach((g) => {
    getOrCreateGraduate(g.reg, g.name, g.email, g.phone);
  });

  // Add some scan records for demo
  recordScan('FMAS2026001', 'packing');
  recordScan('FMAS2026001', 'dispatch-venue');
  recordScan('FMAS2026002', 'packing');
}
