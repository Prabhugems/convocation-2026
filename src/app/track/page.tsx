'use client';

import { useState, useEffect } from 'react';
import GlassCard from '@/components/GlassCard';
import { Graduate, Address } from '@/types';
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
  AlertCircle,
  X,
  Pencil,
  ExternalLink,
  Lock,
  Info,
  Download,
  IdCard,
  ChevronDown,
  ChevronUp,
  Mail,
  GraduationCap,
  ArrowDown,
  HelpCircle,
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

// Address data from Airtable
interface AddressData {
  address: Address;
  mobile?: string;
  trackingNumber?: string;
  dtdcAvailable?: boolean;
}

// Process steps for the sidebar
const processSteps = [
  {
    id: 'packed',
    icon: Package,
    title: 'Packed',
    description: 'Certificate prepared at Head Office',
    color: 'gray',
  },
  {
    id: 'dispatched',
    icon: Truck,
    title: 'Dispatched to Venue',
    description: 'Sent to Kolkata venue',
    color: 'purple',
  },
  {
    id: 'convocation',
    icon: GraduationCap,
    title: 'Convocation Day',
    description: '27 Aug 2026, 5:30 PM',
    color: 'blue',
  },
  {
    id: 'collected',
    icon: Award,
    title: 'Collected',
    description: 'Certificate received!',
    color: 'green',
  },
];

export default function TrackPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [graduate, setGraduate] = useState<Graduate | null>(null);
  const [searchResults, setSearchResults] = useState<Graduate[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [addressData, setAddressData] = useState<AddressData | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  // Determine current step based on graduate status
  function getCurrentStep(): number {
    if (!graduate) return 0;
    if (graduate.status.certificateCollected) return 4;
    if (graduate.status.registered) return 3;
    if (graduate.status.dispatchedToVenue) return 2;
    if (graduate.status.packed) return 1;
    return 0;
  }

  // Fetch address when graduate changes
  useEffect(() => {
    async function fetchAddress() {
      if (!graduate?.convocationNumber) {
        setAddressData(null);
        return;
      }

      setAddressLoading(true);
      try {
        const response = await fetch(
          `/api/airtable/address?registrationNumber=${encodeURIComponent(graduate.convocationNumber)}&fullData=true`
        );
        const data = await response.json();

        if (data.success && data.data) {
          setAddressData({
            address: data.data.address,
            mobile: data.data.mobile,
            trackingNumber: data.data.trackingNumber,
            dtdcAvailable: data.data.dtdcAvailable,
          });
        } else {
          setAddressData(null);
        }
      } catch (err) {
        console.error('Failed to fetch address:', err);
        setAddressData(null);
      } finally {
        setAddressLoading(false);
      }
    }

    fetchAddress();
  }, [graduate?.convocationNumber]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setSearched(true);
    setShowResults(false);
    setSearchResults([]);
    setGraduate(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await response.json();

      if (data.success && data.data) {
        if (data.data.length === 1) {
          setGraduate(data.data[0]);
        } else if (data.data.length > 1) {
          setSearchResults(data.data);
          setShowResults(true);
        }
      } else {
        setGraduate(null);
        setError(data.error || 'Certificate not found.');
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function selectGraduate(g: Graduate) {
    setGraduate(g);
    setShowResults(false);
    setSearchResults([]);
  }

  function clearSearch() {
    setQuery('');
    setGraduate(null);
    setSearchResults([]);
    setShowResults(false);
    setError(null);
    setSuggestions([]);
    setAddressData(null);
    setSearched(false);
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

  const currentStep = getCurrentStep();

  // Process Guide Sidebar Component
  const ProcessGuide = ({ className = '' }: { className?: string }) => (
    <div className={className}>
      <GlassCard className="p-5 sticky top-24">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-400" />
          How It Works
        </h3>
        <p className="text-white/50 text-sm mb-4">Your certificate journey:</p>

        {/* Process Steps */}
        <div className="space-y-3">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = currentStep > index;
            const isCurrent = currentStep === index + 1;
            const isPending = currentStep <= index;

            return (
              <div key={step.id}>
                <div
                  className={`p-3 rounded-xl border-2 transition-all ${
                    isCompleted
                      ? 'border-green-500/50 bg-green-500/10'
                      : isCurrent
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-green-500/20'
                          : isCurrent
                          ? 'bg-blue-500/20'
                          : 'bg-white/10'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <Icon
                          className={`w-5 h-5 ${
                            isCurrent ? 'text-blue-400' : 'text-white/40'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium text-sm ${
                          isCompleted
                            ? 'text-green-400'
                            : isCurrent
                            ? 'text-blue-400'
                            : 'text-white/50'
                        }`}
                      >
                        {index + 1}. {step.title}
                      </p>
                      <p
                        className={`text-xs mt-0.5 ${
                          isPending && !isCurrent ? 'text-white/30' : 'text-white/50'
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
                {index < processSteps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className={`w-4 h-4 ${isCompleted ? 'text-green-400/50' : 'text-white/20'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 my-5" />

        {/* Not Attending Note */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-2">
            <Send className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 text-sm font-medium">Not Attending?</p>
              <p className="text-white/50 text-xs mt-1">
                Your certificate will be couriered to your address after the convocation.
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 my-5" />

        {/* Need Help */}
        <div className="text-center">
          <p className="text-white/40 text-xs mb-2">Need Help?</p>
          <a
            href="mailto:connect@amasi.in"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            <Mail className="w-4 h-4" />
            connect@amasi.in
          </a>
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Track Your Certificate</h1>
        <p className="text-white/60">
          Search by name, convocation number, email, or mobile
        </p>
      </div>

      {/* Mobile Process Guide (Collapsible) */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setShowMobileGuide(!showMobileGuide)}
          className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl text-white"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            <span className="font-medium">How It Works</span>
          </div>
          {showMobileGuide ? (
            <ChevronUp className="w-5 h-5 text-white/50" />
          ) : (
            <ChevronDown className="w-5 h-5 text-white/50" />
          )}
        </button>
        {showMobileGuide && (
          <div className="mt-2">
            <ProcessGuide />
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Search Form */}
          <GlassCard className="p-6 mb-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter name, convocation no, email, or mobile..."
                  className="w-full pl-12 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
                {query && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
              </button>
            </form>
            <p className="text-xs text-white/30 mt-3">
              Examples: &quot;Sanjay&quot;, &quot;118AEC1001&quot;, &quot;9876543210&quot;, &quot;example@gmail.com&quot;
            </p>
          </GlassCard>

          {/* Multiple Results Selection */}
          {showResults && searchResults.length > 1 && (
            <GlassCard className="p-6 mb-6">
              <h3 className="font-semibold text-white mb-4">
                Multiple matches found ({searchResults.length}). Please select:
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => selectGraduate(g)}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-white">{g.name}</p>
                        <p className="text-sm text-white/60">{g.course}</p>
                        <p className="text-xs text-white/40 mt-1">{g.email}</p>
                      </div>
                      {g.convocationNumber && (
                        <p className="text-sm font-mono text-blue-400">{g.convocationNumber}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Error Message */}
          {error && (
            <GlassCard className="p-6 mb-6 border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">{error}</p>
                  {suggestions.length > 0 && (
                    <ul className="mt-3 text-sm text-white/60 space-y-1">
                      {suggestions.map((s, i) => (
                        <li key={i}>• {s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Graduate Info */}
          {graduate && (
            <>
              <GlassCard className="p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4">Dr. {graduate.name}</h2>
                    <div className="space-y-2">
                      {graduate.convocationNumber && (
                        <div className="flex justify-between">
                          <span className="text-white/60">Convocation No.</span>
                          <span className="text-white font-mono">{graduate.convocationNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-white/60">Course</span>
                        <span className="text-white">{graduate.course}</span>
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

              {/* Shipping Address */}
              <GlassCard className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-400" />
                    Shipping Address
                  </h3>
                  {graduate.status.addressLabeled ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/40 border border-white/20 rounded-lg">
                      <Lock className="w-3.5 h-3.5" />
                      Locked
                    </div>
                  ) : (
                    <a
                      href={`https://amasi.fillout.com/address-update?conv=${graduate.convocationNumber || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 border border-blue-400/30 hover:border-blue-400/50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Update Address
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {addressLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                  </div>
                ) : addressData && addressData.address.line1 ? (
                  <div className="space-y-1 text-white/80">
                    <p>{addressData.address.line1}</p>
                    {addressData.address.line2 && <p>{addressData.address.line2}</p>}
                    <p>{addressData.address.city}</p>
                    <p>
                      {addressData.address.state} - {addressData.address.pincode}
                    </p>
                    {addressData.mobile && (
                      <p className="pt-2 text-white/60">Ph: {addressData.mobile}</p>
                    )}
                    {addressData.trackingNumber && (
                      <div className="pt-3 mt-3 border-t border-white/10">
                        <p className="text-sm text-white/60">
                          {addressData.dtdcAvailable ? 'DTDC' : 'Speed Post'} Tracking:
                          <span className="ml-2 font-mono text-white">{addressData.trackingNumber}</span>
                        </p>
                      </div>
                    )}
                    {graduate.status.addressLabeled && (
                      <div className="pt-3 mt-3 border-t border-white/10">
                        <div className="flex items-start gap-2 text-sm text-yellow-400/80">
                          <Info className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p>Address locked - Label already printed</p>
                            <p className="text-white/50 mt-1">
                              Contact <a href="mailto:connect@amasi.in" className="text-blue-400 hover:underline">connect@amasi.in</a> for assistance
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <MapPin className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    {graduate.status.addressLabeled ? (
                      <>
                        <p className="text-white/60 mb-2">Address on file (label printed)</p>
                        <div className="flex items-center justify-center gap-2 text-sm text-yellow-400/80">
                          <Lock className="w-4 h-4" />
                          <span>Contact connect@amasi.in to update</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-white/60 mb-4">Address not found. Please update your shipping address.</p>
                        <a
                          href={`https://amasi.fillout.com/address-update?conv=${graduate.convocationNumber || ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          Update Address
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* Download Badge - Always available */}
              <GlassCard className="p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                      <IdCard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Your Badge</h3>
                      <p className="text-white/60 text-sm">Download your convocation badge</p>
                    </div>
                  </div>
                  <a
                    href={`/api/badge/${graduate.convocationNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-all shadow-lg hover:shadow-orange-500/25"
                  >
                    <Download className="w-4 h-4" />
                    View Badge
                  </a>
                </div>
              </GlassCard>

              {/* Timeline */}
              <GlassCard className="p-6">
                <h3 className="text-white font-semibold mb-6">Journey Timeline</h3>
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-px bg-white/20" />

                  <div className="space-y-6">
                    {stations.map((station, index) => {
                      const Icon = iconMap[station.icon] || Package;
                      const status = getStationStatus(station.id);
                      const scanTime = getScanTime(station.id);
                      const isCompleted = status === 'completed';

                      return (
                        <div key={station.id} className="relative flex items-start gap-4 pl-3">
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
          {searched && !graduate && !showResults && !error && !loading && (
            <GlassCard className="p-8 text-center">
              <Search className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Results Found</h3>
              <p className="text-white/60 mb-4">
                We couldn&apos;t find a certificate matching your search.
              </p>
              <div className="text-sm text-white/40 space-y-1">
                <p>Try searching by:</p>
                <ul className="text-white/30">
                  <li>Full or partial name (e.g., &quot;Sanjay&quot;)</li>
                  <li>Convocation number (e.g., &quot;118AEC1001&quot;)</li>
                  <li>Mobile number (e.g., &quot;9876543210&quot;)</li>
                  <li>Email address</li>
                </ul>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Sidebar - Desktop Only */}
        <div className="hidden lg:block w-80 shrink-0">
          <ProcessGuide />
        </div>
      </div>
    </div>
  );
}
