// This file is now mostly for local state management during a session
// The main data comes from Tito API

import { Graduate, ScanRecord, ScanStatus, StationId, DashboardStats } from '@/types';
import { getStationStatus } from './stations';

// In-memory store for tracking scans during a session
// Note: This is cleared on server restart - production should use a database
const sessionScans: Map<string, ScanRecord[]> = new Map();
const sessionAddresses: Map<string, Graduate['address']> = new Map();
const sessionTracking: Map<string, { trackingNumber: string; dispatchMethod: 'DTDC' | 'India Post' }> = new Map();

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

export function getSessionScans(registrationNumber: string): ScanRecord[] {
  return sessionScans.get(registrationNumber) || [];
}

export function addSessionScan(
  registrationNumber: string,
  stationId: StationId,
  scannedBy?: string,
  notes?: string,
  metadata?: Record<string, unknown>
): ScanRecord {
  const scans = sessionScans.get(registrationNumber) || [];

  const scanRecord: ScanRecord = {
    station: stationId,
    timestamp: new Date().toISOString(),
    scannedBy,
    notes,
    metadata,
  };

  scans.push(scanRecord);
  sessionScans.set(registrationNumber, scans);

  return scanRecord;
}

export function getSessionStatus(registrationNumber: string): ScanStatus {
  const scans = getSessionScans(registrationNumber);
  const status = createEmptyStatus();

  for (const scan of scans) {
    const statusKey = getStationStatus(scan.station);
    status[statusKey] = true;
  }

  return status;
}

export function setSessionAddress(registrationNumber: string, address: Graduate['address']): void {
  sessionAddresses.set(registrationNumber, address);
}

export function getSessionAddress(registrationNumber: string): Graduate['address'] | undefined {
  return sessionAddresses.get(registrationNumber);
}

export function setSessionTracking(
  registrationNumber: string,
  trackingNumber: string,
  dispatchMethod: 'DTDC' | 'India Post'
): void {
  sessionTracking.set(registrationNumber, { trackingNumber, dispatchMethod });
}

export function getSessionTracking(registrationNumber: string): { trackingNumber: string; dispatchMethod: 'DTDC' | 'India Post' } | undefined {
  return sessionTracking.get(registrationNumber);
}

// Dashboard stats - to be populated from Tito API
export function getDashboardStats(): DashboardStats {
  return {
    totalGraduates: 0,
    packed: 0,
    dispatchedToVenue: 0,
    registered: 0,
    gownIssued: 0,
    gownReturned: 0,
    certificateCollected: 0,
    returnedToHO: 0,
    addressLabeled: 0,
    finalDispatched: 0,
    pendingGownDeposit: 0,
  };
}
