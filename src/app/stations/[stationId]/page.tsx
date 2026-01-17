'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import GlassCard from '@/components/GlassCard';
import UniversalScanner, { SearchInputType } from '@/components/UniversalScanner';
import StatusBadge from '@/components/StatusBadge';
import { Sticker3x2, Badge4x6, AddressLabel4x6, AddressLabelData, printElement, printSticker3x2, printAddressLabel4x6 } from '@/components/PrintTemplates';
import { printBadge4x6PDF, generateQRDataUrl } from '@/lib/pdfPrint';
import { stations, getStation } from '@/lib/stations';
import { Graduate, StationId, Address, AirtableGraduateData } from '@/types';
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
  AlertTriangle,
  Users,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  X,
  Sparkles,
  Phone,
  Mail,
  Loader2,
  Download,
} from 'lucide-react';
import { usePrinter } from '@/hooks/usePrinter';
import { useBrowserPrint } from '@/hooks/useBrowserPrint';
import { useMobilePrint } from '@/hooks/useMobilePrint';
import { generateConvocationBadgeZPL } from '@/lib/zpl-badge-generator';
import PrinterSetup from '@/components/PrinterSetup';
import QRCode from 'react-qr-code';
import { Share2 } from 'lucide-react';

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

// Station color themes
const stationColors: Record<string, { gradient: string; accent: string; bg: string }> = {
  'packing': { gradient: 'from-gray-500 to-gray-700', accent: '#6b7280', bg: 'bg-gray-500/10' },
  'dispatch-venue': { gradient: 'from-purple-500 to-purple-700', accent: '#a855f7', bg: 'bg-purple-500/10' },
  'registration': { gradient: 'from-cyan-500 to-cyan-700', accent: '#06b6d4', bg: 'bg-cyan-500/10' },
  'gown-issue': { gradient: 'from-orange-500 to-orange-700', accent: '#f97316', bg: 'bg-orange-500/10' },
  'gown-return': { gradient: 'from-amber-500 to-amber-700', accent: '#f59e0b', bg: 'bg-amber-500/10' },
  'certificate-collection': { gradient: 'from-green-500 to-green-700', accent: '#22c55e', bg: 'bg-green-500/10' },
  'return-ho': { gradient: 'from-yellow-500 to-yellow-700', accent: '#eab308', bg: 'bg-yellow-500/10' },
  'address-label': { gradient: 'from-blue-500 to-blue-700', accent: '#3b82f6', bg: 'bg-blue-500/10' },
  'final-dispatch': { gradient: 'from-indigo-500 to-indigo-700', accent: '#6366f1', bg: 'bg-indigo-500/10' },
};

export default function StationPage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as StationId;
  const station = getStation(stationId);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; graduate?: Graduate } | null>(null);
  const [lastScanned, setLastScanned] = useState<Graduate | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState<'DTDC' | 'India Post'>('DTDC');
  const [address, setAddress] = useState<Address | null>(null);
  const [airtableData, setAirtableData] = useState<AirtableGraduateData | null>(null);
  const [searchResults, setSearchResults] = useState<Graduate[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Station stats and sharing
  const [stationStats, setStationStats] = useState<{ checkedIn: number; total: number } | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Animation state
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Zebra printer direct print (legacy)
  const { printLabel, status: printStatus } = usePrinter();

  // Zebra Browser Print (for registration station 4x6 badges)
  const browserPrint = useBrowserPrint();
  // Mobile/Network print (works from phone - no software needed)
  const mobilePrint = useMobilePrint();
  const [showPrinterSetup, setShowPrinterSetup] = useState(false);

  // Get the shareable station URL
  const stationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/stations/${stationId}`
    : `/stations/${stationId}`;

  // Get station colors
  const colors = stationColors[stationId] || stationColors['packing'];

  // Fetch station stats from Tito
  const fetchStationStats = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/tito/stats');
      const data = await res.json();
      if (data.success && data.meta?.checkinLists) {
        const stationMapping: Record<StationId, string> = {
          'packing': 'Packing',
          'dispatch-venue': 'Dispatch to Convocation',
          'registration': 'Registration',
          'gown-issue': 'Gown Issued',
          'gown-return': 'Gown Returned',
          'certificate-collection': 'Certificate Collected',
          'return-ho': 'Dispatch to Head Office',
          'address-label': 'Address Label Printed',
          'final-dispatch': 'Dispatched DTDC',
        };

        const listName = stationMapping[stationId];
        const list = data.meta.checkinLists.find((l: { title: string }) => l.title === listName);

        if (list) {
          setStationStats({ checkedIn: list.checked_in, total: list.total });
        } else if (data.data) {
          setStationStats({ checkedIn: 0, total: data.data.totalGraduates });
        }
      }
      setLastSync(new Date());
    } catch (error) {
      console.error('Failed to fetch station stats:', error);
    } finally {
      setSyncing(false);
    }
  }, [stationId]);

  // Copy station URL to clipboard
  const copyStationUrl = async () => {
    try {
      await navigator.clipboard.writeText(stationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = stationUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch stats on mount and periodically
  useEffect(() => {
    fetchStationStats();
    const interval = setInterval(fetchStationStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStationStats]);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  // Helper function to print 4x6 badge
  // Uses Browser Print, Mobile Print, or falls back to jsPDF
  const handlePrintBadge4x6 = async (graduate: Graduate) => {
    // For registration station, try different print methods
    if (stationId === 'registration') {
      // 1. Try Browser Print first (desktop with Zebra Browser Print software)
      if (browserPrint.isRunning) {
        const success = await browserPrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Browser Print');
          return;
        }
        console.warn('[Registration] Browser Print failed, trying other methods');
      }

      // 2. Try Mobile/Network Print - check localStorage directly
      let mobileSettings = null;
      try {
        const saved = localStorage.getItem('mobile-printer-settings');
        console.log('[Registration] Mobile settings from localStorage:', saved);
        if (saved) {
          mobileSettings = JSON.parse(saved);
          console.log('[Registration] Parsed mobile settings:', mobileSettings);
        }
      } catch (e) {
        console.error('[Registration] Failed to read mobile settings:', e);
      }

      // If we have an IP address, try to print
      if (mobileSettings?.ip) {
        console.log('[Registration] Attempting mobile/network print to', mobileSettings.ip);
        const success = await mobilePrint.printBadge(graduate);
        if (success) {
          console.log('[Registration] Badge printed via Mobile/Network Print');
          return;
        }
        console.warn('[Registration] Mobile Print failed');
        // Don't show modal or fall through - user can use Zebra App button
        return;
      }

      // No print method available - just return, user can use Zebra App button
      console.log('[Registration] No auto-print available. User can use Zebra App button.');
      return;
    }

    // For non-registration stations: jsPDF print (browser print dialog)
    const titoUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.convocationNumber || graduate.registrationNumber}`;

    const qrDataUrl = await generateQRDataUrl(titoUrl, 200);

    await printBadge4x6PDF({
      name: graduate.name,
      course: graduate.course,
      convocationNumber: graduate.convocationNumber,
      qrCodeDataUrl: qrDataUrl,
    });
  };

  // Process a graduate at this station
  const processGraduate = async (graduate: Graduate) => {
    setLoading(true);
    setResult(null);
    setShowResults(false);

    try {
      let metadata: Record<string, unknown> = {};
      if (stationId === 'final-dispatch') {
        if (!trackingNumber) {
          setResult({ success: false, message: 'Please enter tracking number' });
          setLoading(false);
          return;
        }
        metadata = { trackingNumber, dispatchMethod };
      }

      const scanBody = {
        registrationNumber: graduate.ticketSlug || graduate.registrationNumber,
        stationId,
        metadata,
      };

      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanBody),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Successfully processed at ${station!.name}`,
          graduate: data.data,
        });
        setLastScanned(data.data);
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 1500);

        // Refresh stats after successful scan
        fetchStationStats();

        // Handle address-label station
        if (stationId === 'address-label' && data.data) {
          const convNum = data.data.convocationNumber || graduate.convocationNumber;
          if (convNum) {
            const addrResponse = await fetch(`/api/airtable/address?registrationNumber=${convNum}&fullData=true`);
            const addrData = await addrResponse.json();
            if (addrData.success && addrData.data) {
              setAirtableData(addrData.data);
              setAddress(addrData.data.address);

              if (station!.printType === '4x6-label') {
                const labelData: AddressLabelData = {
                  name: data.data.name,
                  course: data.data.course,
                  convocationNumber: data.data.convocationNumber,
                  ticketSlug: data.data.ticketSlug,
                  registrationNumber: data.data.registrationNumber,
                  address: addrData.data.address,
                  phone: addrData.data.mobile,
                  trackingNumber: addrData.data.trackingNumber,
                  dtdcAvailable: addrData.data.dtdcAvailable,
                };
                setTimeout(() => {
                  printAddressLabel4x6(labelData, printRef.current);
                }, 500);
              }
            }
          }
        } else if (station!.printType) {
          setTimeout(async () => {
            if (station!.printType === '3x2-sticker' && data.data) {
              printSticker3x2(data.data, printRef.current);
            } else if (station!.printType === '4x6-badge' && data.data) {
              // USE NEW jsPDF PRINT FUNCTION
              await handlePrintBadge4x6(data.data);
            } else if (printRef.current) {
              printElement(printRef.current, station!.printType);
            }
          }, 500);
        }

        if (stationId === 'final-dispatch') {
          setTrackingNumber('');
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to process scan',
          graduate: data.data,
        });
        if (data.data) {
          setLastScanned(data.data);
        }
      }
    } catch (error) {
      console.error('[processGraduate] Error:', error);
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle search from UniversalScanner
  const handleSearch = useCallback(async (query: string, _type: SearchInputType) => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    setSearchResults([]);
    setShowResults(false);

    try {
      const apiUrl = `/api/search?q=${encodeURIComponent(query)}&includeAddress=${stationId === 'address-label'}`;
      const searchResponse = await fetch(apiUrl);
      const searchData = await searchResponse.json();

      if (!searchData.success || !searchData.data || searchData.data.length === 0) {
        setResult({
          success: false,
          message: searchData.error || 'No graduates found. Try searching by name, convocation number, or mobile.',
        });
        setLoading(false);
        return;
      }

      const graduates = searchData.data as Graduate[];

      if (graduates.length === 1) {
        setLoading(false);
        await processGraduate(graduates[0]);
      } else {
        setSearchResults(graduates);
        setShowResults(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('[Station] Search error:', error);
      setResult({
        success: false,
        message: 'Search failed. Please try again.',
      });
      setLoading(false);
    }
  }, [loading, stationId]);

  // Early return for invalid station
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
  const progressPercent = stationStats ? Math.round((stationStats.checkedIn / stationStats.total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 no-print">
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-ping">
            <CheckCircle className="w-32 h-32 text-green-400" />
          </div>
        </div>
      )}

      {/* Station Header Card */}
      <div className="relative mb-8">
        <GlassCard className="p-0 overflow-hidden">
          {/* Gradient Background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-20`} />

          <div className="relative p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Back + Station Info */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/stations')}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>

                {/* Station Icon with Progress Ring */}
                <div className="relative">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke={colors.accent}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - progressPercent / 100)}`}
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className={`absolute inset-0 flex items-center justify-center`}>
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/60 text-xs font-medium">
                      Station {stationIndex + 1}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-white mt-1">{station.name}</h1>
                  <p className="text-white/50 text-sm">{station.description}</p>
                </div>
              </div>

              {/* Right: Stats + Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Stats */}
                {stationStats && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{stationStats.checkedIn}</p>
                      <p className="text-xs text-white/40">of {stationStats.total}</p>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div>
                      <p className="text-2xl font-bold" style={{ color: colors.accent }}>{progressPercent}%</p>
                      <p className="text-xs text-white/40">complete</p>
                    </div>
                    <button
                      onClick={fetchStationStats}
                      disabled={syncing}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 text-white/50 ${syncing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                )}

                {/* Share Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyStationUrl}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Share'}</span>
                  </button>
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <QrCode className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Scan to Open Station</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCode value={stationUrl} size={200} />
              </div>
            </div>
            <p className="text-center text-white/60 text-sm mb-4">{station.name}</p>
            <button
              onClick={copyStationUrl}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r ${colors.gradient} text-white rounded-xl transition-opacity hover:opacity-90`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Printer Setup Modal - Registration Station Only */}
      {showPrinterSetup && stationId === 'registration' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowPrinterSetup(false)}>
          <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Printer className="w-6 h-6 text-cyan-400" />
                Printer Setup
              </h3>
              <button onClick={() => setShowPrinterSetup(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <PrinterSetup
                onPrinterReady={(printer) => {
                  browserPrint.setSelectedPrinter(printer);
                  // Auto-close modal after printer is ready
                  setTimeout(() => setShowPrinterSetup(false), 1000);
                }}
                onMobilePrintReady={() => {
                  // Auto-close modal after mobile print is configured
                  setTimeout(() => setShowPrinterSetup(false), 1000);
                }}
                showMobileOption={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Money Alerts */}
      {(station.collectMoney || station.refundMoney) && (
        <div className="mb-8">
          {station.collectMoney && (
            <GlassCard className="p-5 border-green-500/30 bg-green-500/10 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <span className="text-2xl text-green-400">₹</span>
                </div>
                <div>
                  <p className="text-green-400 font-semibold">Collect ₹{station.collectMoney} Deposit</p>
                  <p className="text-green-400/60 text-sm">Before issuing gown</p>
                </div>
              </div>
            </GlassCard>
          )}
          {station.refundMoney && (
            <GlassCard className="p-5 border-amber-500/30 bg-amber-500/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <span className="text-2xl text-amber-400">₹</span>
                </div>
                <div>
                  <p className="text-amber-400 font-semibold">Refund ₹{station.refundMoney}</p>
                  <p className="text-amber-400/60 text-sm">After accepting gown return</p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Scanner Section - Takes 3 columns */}
        <div className="lg:col-span-3 space-y-6">
          <GlassCard className={`p-6 ${colors.bg} border-2 border-white/20`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Scan or Search</h2>
                <p className="text-white/40 text-sm">QR code, barcode, name, or conv. number</p>
              </div>
            </div>

            <UniversalScanner
              onSearch={handleSearch}
              onError={(error) => console.log('[Station] Scanner error:', error)}
              loading={loading}
              placeholder="Name, Conv. No, Mobile, or scan QR/Barcode"
            />
          </GlassCard>

          {/* Print Status - Registration Station Only */}
          {stationId === 'registration' && (
            <GlassCard className="p-4">
              <div className="space-y-3">
                {/* Browser Print Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Printer className="w-5 h-5 text-cyan-400" />
                    <div className="flex items-center gap-2">
                      {browserPrint.isChecking ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          <span className="text-blue-400 text-sm">Checking...</span>
                        </>
                      ) : browserPrint.isRunning ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm">
                            Browser Print
                            {browserPrint.selectedPrinter && ` (${browserPrint.selectedPrinter.name})`}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-white/40" />
                          <span className="text-white/40 text-sm">Browser Print (desktop)</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => browserPrint.checkStatus()}
                    disabled={browserPrint.isChecking}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    title="Refresh status"
                  >
                    <RefreshCw className={`w-4 h-4 text-white/50 ${browserPrint.isChecking ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Mobile Print Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-green-400" />
                    <div className="flex items-center gap-2">
                      {mobilePrint.isConfigured ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400 text-sm">
                            Mobile Print ({mobilePrint.settings.ip})
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-white/40" />
                          <span className="text-white/40 text-sm">Mobile Print (network)</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!mobilePrint.isConfigured && (
                    <button
                      onClick={() => setShowPrinterSetup(true)}
                      className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm hover:bg-green-500/30 transition-colors"
                    >
                      Setup
                    </button>
                  )}
                </div>

                {/* Status Summary */}
                {mobilePrint.isLoading && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-400 text-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading printer settings...
                    </p>
                  </div>
                )}

                {!mobilePrint.isLoading && !browserPrint.isRunning && !mobilePrint.isConfigured && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-400 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      No printer configured. Tap Setup to connect.
                    </p>
                  </div>
                )}

                {!mobilePrint.isLoading && (browserPrint.isRunning || mobilePrint.isConfigured) && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Ready to print! Scan a QR code to get started.
                    </p>
                  </div>
                )}

                {browserPrint.error && (
                  <p className="text-red-400/70 text-xs">{browserPrint.error}</p>
                )}
                {mobilePrint.error && (
                  <p className="text-red-400/70 text-xs">{mobilePrint.error}</p>
                )}

                {/* Settings Button */}
                <button
                  onClick={() => setShowPrinterSetup(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/70 text-sm hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Printer Settings
                </button>
              </div>
            </GlassCard>
          )}

          {/* Final Dispatch Special Inputs */}
          {stationId === 'final-dispatch' && (
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Send className="w-5 h-5" style={{ color: colors.accent }} />
                Dispatch Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Courier Service</label>
                  <div className="flex gap-3">
                    {['DTDC', 'India Post'].map((method) => (
                      <button
                        key={method}
                        onClick={() => setDispatchMethod(method as 'DTDC' | 'India Post')}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${
                          dispatchMethod === method
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </GlassCard>
          )}

          {/* Multiple Results Selection */}
          {showResults && searchResults.length > 1 && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" style={{ color: colors.accent }} />
                  <h3 className="font-semibold text-white">Select Graduate</h3>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
                    {searchResults.length} matches
                  </span>
                </div>
                <button
                  onClick={() => { setShowResults(false); setSearchResults([]); }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.map((graduate) => (
                  <button
                    key={graduate.id}
                    onClick={() => processGraduate(graduate)}
                    disabled={loading}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-left transition-all disabled:opacity-50 group"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-white group-hover:text-white">{graduate.name}</p>
                        <p className="text-sm text-white/50">{graduate.course}</p>
                      </div>
                      {graduate.convocationNumber && (
                        <span className="px-3 py-1 rounded-lg bg-white/10 text-sm font-mono" style={{ color: colors.accent }}>
                          {graduate.convocationNumber}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Result Section - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Result Message */}
          {result && (
            <GlassCard
              className={`p-6 border-2 transition-all ${
                result.success
                  ? 'border-green-500/50 bg-green-500/10'
                  : result.message.includes('already')
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-red-500/50 bg-red-500/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  result.success ? 'bg-green-500/20' : result.message.includes('already') ? 'bg-amber-500/20' : 'bg-red-500/20'
                }`}>
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : result.message.includes('already') ? (
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${
                    result.success ? 'text-green-400' : result.message.includes('already') ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {result.success ? 'Success!' : result.message.includes('already') ? 'Already Scanned' : 'Error'}
                  </p>
                  <p className="text-white/60 text-sm mt-1">{result.message}</p>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Last Scanned Graduate Card */}
          {lastScanned && (
            <GlassCard className="p-6 relative overflow-hidden">
              {/* Decorative background */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: colors.accent }} />
                    Last Scanned
                  </h3>
                  {station.printType && lastScanned && (() => {
                    // Determine current print state based on print method
                    const currentPrintState = stationId === 'registration'
                      ? (browserPrint.state === 'printing' || mobilePrint.state === 'printing'
                        ? 'printing'
                        : browserPrint.state === 'success' || mobilePrint.state === 'success'
                        ? 'success'
                        : browserPrint.state === 'error' || mobilePrint.state === 'error'
                        ? 'error'
                        : 'idle')
                      : printStatus;

                    return (
                      <button
                        onClick={async () => {
                          if (station.printType === '4x6-badge') {
                            await handlePrintBadge4x6(lastScanned);
                          } else {
                            const printType = station.printType === '3x2-sticker' ? 'packing' : 'badge';
                            printLabel(lastScanned, printType, printRef.current);
                          }
                        }}
                        disabled={currentPrintState === 'printing'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm transition-all ${
                          currentPrintState === 'printing'
                            ? 'bg-blue-500/30 cursor-wait'
                            : currentPrintState === 'success'
                            ? 'bg-green-500/30'
                            : currentPrintState === 'error'
                            ? 'bg-red-500/30 hover:bg-red-500/40'
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {currentPrintState === 'printing' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : currentPrintState === 'success' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : currentPrintState === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <Printer className="w-4 h-4" />
                        )}
                        {currentPrintState === 'printing'
                          ? 'Printing...'
                          : currentPrintState === 'success'
                          ? 'Printed!'
                          : currentPrintState === 'error'
                          ? 'Retry'
                          : 'Print'}
                      </button>
                    );
                  })()}

                  {/* Share to Zebra App Button - for mobile */}
                  {station.printType === '4x6-badge' && lastScanned && (
                    <button
                      onClick={async () => {
                        // Generate ZPL for this graduate
                        const zpl = generateConvocationBadgeZPL({
                          name: lastScanned.name,
                          course: lastScanned.course,
                          convocationNumber: lastScanned.convocationNumber || 'N/A',
                          registrationId: lastScanned.ticketSlug || lastScanned.registrationNumber,
                        });

                        // Try Web Share API first (works on Android)
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: `Badge: ${lastScanned.name}`,
                              text: zpl,
                            });
                            return;
                          } catch (e) {
                            // User cancelled or share failed, fall back to clipboard
                          }
                        }

                        // Fall back to clipboard
                        try {
                          await navigator.clipboard.writeText(zpl);
                          alert('ZPL code copied! Paste it in Zebra Print Connect app.');
                        } catch (e) {
                          // Show ZPL in prompt for manual copy
                          prompt('Copy this ZPL code and paste in Zebra Print Connect:', zpl);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-green-400 text-sm bg-green-500/20 hover:bg-green-500/30 transition-all"
                      title="Share to Zebra Print Connect app"
                    >
                      <Share2 className="w-4 h-4" />
                      Zebra App
                    </button>
                  )}
                </div>

                {/* Graduate Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold text-white">Dr. {lastScanned.name}</p>
                    <p className="text-white/50">{lastScanned.course}</p>
                  </div>

                  {lastScanned.convocationNumber && (
                    <div className="inline-flex items-center px-4 py-2 rounded-xl bg-white/10">
                      <span className="text-white/50 text-sm mr-2">Conv. No.</span>
                      <span className="font-mono font-bold text-lg" style={{ color: colors.accent }}>
                        {lastScanned.convocationNumber}
                      </span>
                    </div>
                  )}

                  {/* Contact Info */}
                  {(lastScanned.phone || lastScanned.email) && (
                    <div className="flex flex-wrap gap-3">
                      {lastScanned.phone && (
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                          <Phone className="w-4 h-4" />
                          {lastScanned.phone}
                        </div>
                      )}
                      {lastScanned.email && (
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                          <Mail className="w-4 h-4" />
                          {lastScanned.email}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Journey Status</p>
                    <div className="flex flex-wrap gap-2">
                      {lastScanned.status.packed && <StatusBadge status="completed" label="Packed" />}
                      {lastScanned.status.dispatchedToVenue && <StatusBadge status="completed" label="At Venue" />}
                      {lastScanned.status.registered && <StatusBadge status="completed" label="Registered" />}
                      {lastScanned.status.gownIssued && <StatusBadge status="completed" label="Gown Issued" />}
                      {lastScanned.status.gownReturned && <StatusBadge status="completed" label="Gown Returned" />}
                      {lastScanned.status.certificateCollected && <StatusBadge status="completed" label="Certificate" />}
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Address Display for Address Label Station */}
          {stationId === 'address-label' && address && lastScanned && (
            <GlassCard className="p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Shipping Address
              </h3>
              <div className="space-y-1 text-white/70 bg-white/5 p-4 rounded-xl">
                <p className="font-medium text-white">Dr. {lastScanned.name}</p>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>{address.city}, {address.state}</p>
                <p className="font-bold text-white">{address.pincode}</p>
                <p>{address.country}</p>
              </div>
            </GlassCard>
          )}

          {/* Empty State */}
          {!lastScanned && !result && !showResults && (
            <GlassCard className="p-8 text-center">
              <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${colors.gradient} opacity-50 flex items-center justify-center mb-5`}>
                <Icon className="w-10 h-10 text-white" />
              </div>
              <p className="text-white/40 text-lg">Ready to scan</p>
              <p className="text-white/30 text-sm mt-1">Scan QR code or search for a graduate</p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Print Badge - Only this prints (75mm × 50mm sticker) */}
      {/* FIXED: Exact 75mm × 50mm sizing with 28mm QR code, rotate(180deg) for Zebra ZD230 */}
      {lastScanned && station.printType === '3x2-sticker' && (
        <div
          ref={printRef}
          className="print-badge"
          style={{
            width: '75mm',
            height: '50mm',
            maxWidth: '75mm',
            maxHeight: '50mm',
            backgroundColor: 'white',
            display: 'none',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4mm',
            fontFamily: 'Helvetica, Arial, sans-serif',
            boxSizing: 'border-box',
            overflow: 'hidden',
            transform: 'rotate(180deg)',  // Fix reversed print on Zebra
          }}
        >
          <div className="sticker-left" style={{
            flex: '0 0 43mm',
            maxWidth: '43mm',
            paddingRight: '2mm',
            overflow: 'hidden',
          }}>
            <p style={{ fontSize: '7pt', color: '#333', margin: 0, marginBottom: '1mm' }}>CON. No-</p>
            <p style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000', margin: 0, marginBottom: '2mm' }}>
              {lastScanned.convocationNumber || 'N/A'}
            </p>
            <p style={{ fontSize: '8pt', color: '#000', margin: 0, lineHeight: 1.2 }}>Dr. {lastScanned.name}</p>
          </div>
          <div className="sticker-right" style={{
            flex: '0 0 28mm',
            width: '28mm',
            height: '28mm',
            maxWidth: '28mm',
            maxHeight: '28mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}>
            <QRCode
              value={lastScanned.ticketSlug ? `https://ti.to/tickets/${lastScanned.ticketSlug}` : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${lastScanned.registrationNumber}`}
              size={106}
              level="M"
              style={{ width: '28mm', height: '28mm', maxWidth: '28mm', maxHeight: '28mm' }}
            />
          </div>
        </div>
      )}

      {/* Print Badge 4x6 - For badges and labels */}
      {lastScanned && station.printType === '4x6-badge' && (
        <div ref={printRef} className="print-badge-4x6" style={{ display: 'none' }}>
          <Badge4x6 graduate={lastScanned} />
        </div>
      )}
      {lastScanned && station.printType === '4x6-label' && address && airtableData && (
        <div ref={printRef} className="print-badge-4x6" style={{ display: 'none' }}>
          <AddressLabel4x6
            data={{
              name: lastScanned.name,
              course: lastScanned.course,
              convocationNumber: lastScanned.convocationNumber,
              ticketSlug: lastScanned.ticketSlug,
              registrationNumber: lastScanned.registrationNumber,
              address: address,
              phone: airtableData.mobile,
              trackingNumber: airtableData.trackingNumber,
              dtdcAvailable: airtableData.dtdcAvailable,
            }}
          />
        </div>
      )}
    </div>
  );
}
