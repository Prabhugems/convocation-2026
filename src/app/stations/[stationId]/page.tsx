'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GlassCard from '@/components/GlassCard';
import QRScanner from '@/components/QRScanner';
import StatusBadge from '@/components/StatusBadge';
import { Sticker3x2, Badge4x6, ShippingLabel4x6, printElement } from '@/components/PrintTemplates';
import { stations, getStation } from '@/lib/stations';
import { Graduate, StationId, Address } from '@/types';
import {
  Package,
  Truck,
  UserCheck,
  Shirt,
  Undo2,
  Award,
  Building2,
  MapPin,
  Send,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  Keyboard,
  Loader2,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  Package,
  Truck,
  UserCheck,
  Shirt,
  Undo2,
  Award,
  Building2,
  MapPin,
  Send,
};

export default function StationPage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as StationId;
  const station = getStation(stationId);

  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; graduate?: Graduate } | null>(null);
  const [lastScanned, setLastScanned] = useState<Graduate | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState<'DTDC' | 'India Post'>('DTDC');
  const [address, setAddress] = useState<Address | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset result after 5 seconds
    if (result) {
      const timer = setTimeout(() => setResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!station) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <GlassCard className="p-8 text-center">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Station Not Found</h1>
          <p className="text-white/60 mb-6">The station &quot;{stationId}&quot; does not exist.</p>
          <button
            onClick={() => router.push('/stations')}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
          >
            Back to Stations
          </button>
        </GlassCard>
      </div>
    );
  }

  const Icon = iconMap[station.icon] || Package;
  const stationIndex = stations.findIndex((s) => s.id === stationId);

  async function handleScan(registrationNumber: string) {
    if (loading) return;
    setLoading(true);
    setResult(null);

    try {
      // First, ensure the graduate exists
      const checkResponse = await fetch(`/api/scan?registrationNumber=${registrationNumber}`);
      const checkData = await checkResponse.json();

      // If graduate doesn't exist, create them first
      if (!checkData.success) {
        await fetch('/api/graduates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrationNumber }),
        });
      }

      // Prepare metadata for special stations
      let metadata: Record<string, unknown> = {};
      if (stationId === 'final-dispatch') {
        if (!trackingNumber) {
          setResult({ success: false, message: 'Please enter tracking number' });
          setLoading(false);
          return;
        }
        metadata = { trackingNumber, dispatchMethod };
      }

      // Record the scan
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationNumber,
          stationId,
          metadata,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Successfully processed at ${station!.name}`,
          graduate: data.data,
        });
        setLastScanned(data.data);

        // Fetch address for address-label station
        if (stationId === 'address-label' && data.data) {
          const addrResponse = await fetch(`/api/airtable/address?registrationNumber=${registrationNumber}`);
          const addrData = await addrResponse.json();
          if (addrData.success && addrData.data) {
            setAddress(addrData.data);
          }
        }

        // Auto-print for print stations
        if (station!.printType && printRef.current) {
          setTimeout(() => {
            if (printRef.current) {
              printElement(printRef.current);
            }
          }, 500);
        }

        // Reset tracking number after successful dispatch
        if (stationId === 'final-dispatch') {
          setTrackingNumber('');
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to process scan',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setLoading(false);
      setManualInput('');
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim().toUpperCase());
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/stations')}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {stationIndex + 1}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">{station.name}</h1>
            <p className="text-white/60 text-sm">{station.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner Section */}
        <div className="space-y-4">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Icon className="w-5 h-5" />
                Scan QR Code
              </h2>
              <button
                onClick={() => setShowManual(!showManual)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="Manual Entry"
              >
                <Keyboard className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {showManual ? (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter Registration Number"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !manualInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Process</>
                  )}
                </button>
              </form>
            ) : (
              <QRScanner
                onScan={handleScan}
                onError={(error) => setResult({ success: false, message: error })}
                className="w-full"
              />
            )}
          </GlassCard>

          {/* Special inputs for certain stations */}
          {stationId === 'final-dispatch' && (
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white mb-4">Dispatch Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Courier</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDispatchMethod('DTDC')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        dispatchMethod === 'DTDC'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                          : 'bg-white/5 border-white/20 text-white/60'
                      }`}
                    >
                      DTDC
                    </button>
                    <button
                      onClick={() => setDispatchMethod('India Post')}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                        dispatchMethod === 'India Post'
                          ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                          : 'bg-white/5 border-white/20 text-white/60'
                      }`}
                    >
                      India Post
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </GlassCard>
          )}

          {/* Money handling reminder */}
          {station.collectMoney && (
            <GlassCard className="p-4 border-green-500/30 bg-green-500/10">
              <p className="text-green-400 font-medium flex items-center gap-2">
                <span className="text-2xl">₹</span>
                Collect ₹{station.collectMoney} deposit before issuing gown
              </p>
            </GlassCard>
          )}
          {station.refundMoney && (
            <GlassCard className="p-4 border-yellow-500/30 bg-yellow-500/10">
              <p className="text-yellow-400 font-medium flex items-center gap-2">
                <span className="text-2xl">₹</span>
                Refund ₹{station.refundMoney} after accepting gown return
              </p>
            </GlassCard>
          )}
        </div>

        {/* Result Section */}
        <div className="space-y-4">
          {/* Result Message */}
          {result && (
            <GlassCard
              className={`p-6 ${
                result.success
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              <div className="flex items-start gap-4">
                {result.success ? (
                  <CheckCircle className="w-8 h-8 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400 shrink-0" />
                )}
                <div>
                  <p
                    className={`font-semibold ${
                      result.success ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {result.success ? 'Success!' : 'Error'}
                  </p>
                  <p className="text-white/70 text-sm mt-1">{result.message}</p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Last Scanned Info */}
          {lastScanned && (
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white mb-4">Last Scanned</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Name</span>
                  <span className="text-white font-medium">{lastScanned.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Reg. No.</span>
                  <span className="text-white font-mono">{lastScanned.registrationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Course</span>
                  <span className="text-white">{lastScanned.course}</span>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="text-white/60 text-sm mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {lastScanned.status.packed && (
                      <StatusBadge status="completed" label="Packed" />
                    )}
                    {lastScanned.status.dispatchedToVenue && (
                      <StatusBadge status="completed" label="At Venue" />
                    )}
                    {lastScanned.status.registered && (
                      <StatusBadge status="completed" label="Registered" />
                    )}
                    {lastScanned.status.gownIssued && (
                      <StatusBadge status="completed" label="Gown Issued" />
                    )}
                    {lastScanned.status.gownReturned && (
                      <StatusBadge status="completed" label="Gown Returned" />
                    )}
                    {lastScanned.status.certificateCollected && (
                      <StatusBadge status="completed" label="Certificate" />
                    )}
                  </div>
                </div>

                {/* Print Button */}
                {station.printType && (
                  <button
                    onClick={() => printRef.current && printElement(printRef.current)}
                    className="w-full mt-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Again
                  </button>
                )}
              </div>
            </GlassCard>
          )}

          {/* Address Display for Address Label Station */}
          {stationId === 'address-label' && address && lastScanned && (
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white mb-4">Shipping Address</h3>
              <div className="space-y-1 text-white/80">
                <p className="font-medium text-white">{lastScanned.name}</p>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>
                  {address.city}, {address.state}
                </p>
                <p className="font-semibold">{address.pincode}</p>
                <p>{address.country}</p>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Hidden Print Templates */}
      <div className="hidden">
        {lastScanned && station.printType === '3x2-sticker' && (
          <Sticker3x2 ref={printRef} graduate={lastScanned} />
        )}
        {lastScanned && station.printType === '4x6-badge' && (
          <Badge4x6 ref={printRef} graduate={lastScanned} />
        )}
        {lastScanned && station.printType === '4x6-label' && address && (
          <ShippingLabel4x6 ref={printRef} graduate={lastScanned} address={address} />
        )}
      </div>
    </div>
  );
}
