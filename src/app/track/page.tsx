'use client';

import { useState } from 'react';
import GlassCard from '@/components/GlassCard';
import { Graduate } from '@/types';
import { stations } from '@/lib/stations';
import {
  Search,
  Package,
  Truck,
  UserCheck,
  Shirt,
  Undo2,
  Award,
  Building2,
  MapPin,
  Send,
  CheckCircle,
  Circle,
  Loader2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

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

export default function TrackPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [graduate, setGraduate] = useState<Graduate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await fetch(`/api/scan?registrationNumber=${query.trim().toUpperCase()}`);
      const data = await response.json();

      if (data.success) {
        setGraduate(data.data);
      } else {
        setGraduate(null);
        setError('Certificate not found. Please check the registration number.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getStationStatus(stationId: string): 'completed' | 'pending' {
    if (!graduate) return 'pending';

    const statusMap: Record<string, boolean> = {
      'packing': graduate.status.packed,
      'dispatch-venue': graduate.status.dispatchedToVenue,
      'registration': graduate.status.registered,
      'gown-issue': graduate.status.gownIssued,
      'gown-return': graduate.status.gownReturned,
      'certificate-collection': graduate.status.certificateCollected,
      'return-ho': graduate.status.returnedToHO,
      'address-label': graduate.status.addressLabeled,
      'final-dispatch': graduate.status.finalDispatched,
    };

    return statusMap[stationId] ? 'completed' : 'pending';
  }

  function getScanTime(stationId: string): string | null {
    if (!graduate) return null;
    const scan = graduate.scans.find((s) => s.station === stationId);
    return scan ? format(new Date(scan.timestamp), 'dd MMM yyyy, hh:mm a') : null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Track Your Certificate</h1>
        <p className="text-white/60">
          Enter your registration number to see the current status
        </p>
      </div>

      {/* Search Form */}
      <GlassCard className="p-6 mb-8">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Registration Number (e.g., FMAS2026001)"
              className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
          </button>
        </form>
      </GlassCard>

      {/* Error Message */}
      {error && (
        <GlassCard className="p-6 mb-8 border-red-500/30 bg-red-500/10">
          <p className="text-red-400">{error}</p>
        </GlassCard>
      )}

      {/* Graduate Info */}
      {graduate && (
        <>
          <GlassCard className="p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-4">{graduate.name}</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Registration No.</span>
                    <span className="text-white font-mono">{graduate.registrationNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Course</span>
                    <span className="text-white">{graduate.course}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Batch</span>
                    <span className="text-white">{graduate.batch}</span>
                  </div>
                </div>
              </div>

              <div className="md:border-l md:border-white/10 md:pl-6">
                <h3 className="text-white/60 text-sm mb-3">Current Status</h3>
                {graduate.status.certificateCollected ? (
                  <div className="flex items-center gap-3 text-green-400">
                    <CheckCircle className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">Certificate Collected</p>
                      <p className="text-sm text-white/60">
                        Collected on {getScanTime('certificate-collection')}
                      </p>
                    </div>
                  </div>
                ) : graduate.status.finalDispatched ? (
                  <div className="flex items-center gap-3 text-blue-400">
                    <Send className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">Dispatched</p>
                      {graduate.trackingNumber && (
                        <p className="text-sm text-white/60">
                          {graduate.dispatchMethod}: {graduate.trackingNumber}
                        </p>
                      )}
                    </div>
                  </div>
                ) : graduate.status.returnedToHO ? (
                  <div className="flex items-center gap-3 text-yellow-400">
                    <Building2 className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">At Head Office</p>
                      <p className="text-sm text-white/60">Ready for dispatch</p>
                    </div>
                  </div>
                ) : graduate.status.registered ? (
                  <div className="flex items-center gap-3 text-purple-400">
                    <Clock className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">At Venue</p>
                      <p className="text-sm text-white/60">Ready for collection</p>
                    </div>
                  </div>
                ) : graduate.status.dispatchedToVenue ? (
                  <div className="flex items-center gap-3 text-blue-400">
                    <Truck className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">In Transit to Venue</p>
                      <p className="text-sm text-white/60">Will be available at registration</p>
                    </div>
                  </div>
                ) : graduate.status.packed ? (
                  <div className="flex items-center gap-3 text-white/80">
                    <Package className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">Packed</p>
                      <p className="text-sm text-white/60">Ready for dispatch to venue</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-white/60">
                    <Circle className="w-8 h-8" />
                    <div>
                      <p className="font-semibold">Processing</p>
                      <p className="text-sm">Certificate is being prepared</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Timeline */}
          <GlassCard className="p-6">
            <h3 className="text-white font-semibold mb-6">Journey Timeline</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-white/20" />

              <div className="space-y-6">
                {stations.map((station, index) => {
                  const Icon = iconMap[station.icon] || Package;
                  const status = getStationStatus(station.id);
                  const scanTime = getScanTime(station.id);
                  const isCompleted = status === 'completed';

                  return (
                    <div key={station.id} className="relative flex items-start gap-4 pl-3">
                      {/* Circle indicator */}
                      <div
                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? 'bg-gradient-to-br from-green-400 to-green-600'
                            : 'bg-white/20'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-xs text-white/60">{index + 1}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-5 h-5 ${
                              isCompleted ? 'text-green-400' : 'text-white/40'
                            }`}
                          />
                          <span
                            className={`font-medium ${
                              isCompleted ? 'text-white' : 'text-white/40'
                            }`}
                          >
                            {station.name}
                          </span>
                        </div>
                        {scanTime && (
                          <p className="text-sm text-white/50 mt-1 ml-8">{scanTime}</p>
                        )}
                        {!isCompleted && (
                          <p className="text-sm text-white/30 mt-1 ml-8">Pending</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* No Results */}
      {searched && !graduate && !error && !loading && (
        <GlassCard className="p-8 text-center">
          <Search className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Results Found</h3>
          <p className="text-white/60">
            We couldn&apos;t find a certificate with that registration number.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
