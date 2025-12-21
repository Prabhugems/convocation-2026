import { Station, StationId } from '@/types';

export const stations: Station[] = [
  {
    id: 'packing',
    name: 'Packing',
    description: 'Print 3×2 sticker for certificate envelope',
    icon: 'Package',
    action: 'Print Sticker',
    printType: '3x2-sticker',
  },
  {
    id: 'dispatch-venue',
    name: 'Dispatch to Venue',
    description: 'Mark certificate as sent to convocation venue',
    icon: 'Truck',
    action: 'Mark Dispatched',
  },
  {
    id: 'registration',
    name: 'Registration',
    description: 'Print 4×6 badge for graduate',
    icon: 'UserCheck',
    action: 'Print Badge',
    printType: '4x6-badge',
  },
  {
    id: 'gown-issue',
    name: 'Gown Issue',
    description: 'Collect ₹1000 deposit and issue academic gown',
    icon: 'Shirt',
    action: 'Collect Deposit',
    collectMoney: 1000,
  },
  {
    id: 'gown-return',
    name: 'Gown Return',
    description: 'Accept gown return and refund ₹1000 deposit',
    icon: 'Undo2',
    action: 'Refund Deposit',
    refundMoney: 1000,
  },
  {
    id: 'certificate-collection',
    name: 'Certificate Collection',
    description: 'Hand over certificate to graduate',
    icon: 'Award',
    action: 'Hand Over',
  },
  {
    id: 'return-ho',
    name: 'Return to Head Office',
    description: 'Mark uncollected certificate as returned to HO',
    icon: 'Building2',
    action: 'Mark Returned',
  },
  {
    id: 'address-label',
    name: 'Address Label',
    description: 'Print 4×6 shipping label with address from Airtable',
    icon: 'MapPin',
    action: 'Print Label',
    printType: '4x6-label',
    requiresAddress: true,
  },
  {
    id: 'final-dispatch',
    name: 'Final Dispatch',
    description: 'Record DTDC/India Post tracking number',
    icon: 'Send',
    action: 'Dispatch',
    requiresTracking: true,
  },
];

export function getStation(id: StationId): Station | undefined {
  return stations.find((s) => s.id === id);
}

export function getStationIndex(id: StationId): number {
  return stations.findIndex((s) => s.id === id);
}

export function getNextStation(currentId: StationId): Station | undefined {
  const index = getStationIndex(currentId);
  return index < stations.length - 1 ? stations[index + 1] : undefined;
}

export function getStationStatus(stationId: StationId): keyof import('@/types').ScanStatus {
  const mapping: Record<StationId, keyof import('@/types').ScanStatus> = {
    'packing': 'packed',
    'dispatch-venue': 'dispatchedToVenue',
    'registration': 'registered',
    'gown-issue': 'gownIssued',
    'gown-return': 'gownReturned',
    'certificate-collection': 'certificateCollected',
    'return-ho': 'returnedToHO',
    'address-label': 'addressLabeled',
    'final-dispatch': 'finalDispatched',
  };
  return mapping[stationId];
}
