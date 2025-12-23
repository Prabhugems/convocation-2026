'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import CircularProgress from '@/components/CircularProgress';
import { DashboardStats, Graduate, Address } from '@/types';
import { stations } from '@/lib/stations';
import { ArrowRight, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import {
  Users,
  Package,
  Truck,
  UserCheck,
  Shirt,
  Award,
  Building2,
  Send,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  X,
  Loader2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  MapPin,
  Undo2,
  Phone,
  Mail,
  Printer,
  CheckCircle,
  Circle,
  User,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searching, setSearching] = useState(false);
  const [dispatchMeta, setDispatchMeta] = useState<{ dispatchedDTDC: number; dispatchedIndiaPost: number } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [checkinLists, setCheckinLists] = useState<Array<{ title: string; slug: string; checked_in: number; total: number }>>([]);
  const [copiedStation, setCopiedStation] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [selectedGraduate, setSelectedGraduate] = useState<Graduate | null>(null);
  const [graduateAddress, setGraduateAddress] = useState<Address | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Get base URL for station links
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Icon mapping for stations
  const stationIconMap: Record<string, React.ElementType> = {
    Package, Truck, UserCheck, Shirt, Undo2, Award, Building2, MapPin, Send,
  };

  // Copy station URL to clipboard
  const copyStationUrl = async (stationId: string) => {
    const url = `${baseUrl}/stations/${stationId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedStation(stationId);
      setTimeout(() => setCopiedStation(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedStation(stationId);
      setTimeout(() => setCopiedStation(null), 2000);
    }
  };

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch real check-in stats from Tito check-in lists
      const statsRes = await fetch('/api/tito/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
        if (statsData.meta) {
          setDispatchMeta({
            dispatchedDTDC: statsData.meta.dispatchedDTDC || 0,
            dispatchedIndiaPost: statsData.meta.dispatchedIndiaPost || 0,
          });
          if (statsData.meta.checkinLists) {
            setCheckinLists(statsData.meta.checkinLists);
          }
        }
      }

      // Then fetch all graduates (for the list view)
      const graduatesRes = await fetch('/api/graduates');
      const graduatesData = await graduatesRes.json();
      if (graduatesData.success) setGraduates(graduatesData.data);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Universal search function - searches across all fields
  const searchGraduates = useCallback((graduates: Graduate[], query: string): Graduate[] => {
    if (!query.trim()) return graduates;

    const searchTerm = query.trim().toLowerCase();

    return graduates.filter((g) => {
      // Convocation number (partial, case-insensitive)
      if (g.convocationNumber?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Registration/Reference number
      if (g.registrationNumber.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Name (partial, case-insensitive)
      if (g.name.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Email (partial, case-insensitive)
      if (g.email.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Phone/Mobile (partial, with cleaned numbers)
      const cleanPhone = g.phone?.replace(/[\s\-\+]/g, '') || '';
      const cleanQuery = searchTerm.replace(/[\s\-\+]/g, '');
      if (cleanPhone.includes(cleanQuery)) {
        return true;
      }

      // Course (partial, case-insensitive)
      if (g.course.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Ticket slug
      if (g.ticketSlug?.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });
  }, []);

  // Memoized filtered graduates
  const filteredGraduates = useMemo(() => {
    // First apply search filter
    let result = searchGraduates(graduates, searchQuery);

    // Then apply status filter
    if (filterStatus !== 'all') {
      result = result.filter((g) => {
        switch (filterStatus) {
          case 'pending-gown':
            return g.status.gownIssued && !g.status.gownReturned;
          case 'collected':
            return g.status.certificateCollected;
          case 'dispatched':
            return g.status.finalDispatched;
          case 'uncollected':
            return !g.status.certificateCollected && !g.status.finalDispatched;
          default:
            return true;
        }
      });
    }

    // Sort by relevance if searching
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase();
      result.sort((a, b) => {
        // Exact convocation number match first
        const aExactConv = a.convocationNumber?.toLowerCase() === searchTerm;
        const bExactConv = b.convocationNumber?.toLowerCase() === searchTerm;
        if (aExactConv && !bExactConv) return -1;
        if (bExactConv && !aExactConv) return 1;

        // Exact reference match
        const aExactRef = a.registrationNumber.toLowerCase() === searchTerm;
        const bExactRef = b.registrationNumber.toLowerCase() === searchTerm;
        if (aExactRef && !bExactRef) return -1;
        if (bExactRef && !aExactRef) return 1;

        // Name starts with query
        const aNameStarts = a.name.toLowerCase().startsWith(searchTerm);
        const bNameStarts = b.name.toLowerCase().startsWith(searchTerm);
        if (aNameStarts && !bNameStarts) return -1;
        if (bNameStarts && !aNameStarts) return 1;

        // Alphabetical by name
        return a.name.localeCompare(b.name);
      });
    }

    return result;
  }, [graduates, searchQuery, filterStatus, searchGraduates]);

  function exportCSV() {
    const headers = ['Convocation Number', 'Name', 'Email', 'Phone', 'Course', 'Status', 'Tracking Number'];
    const rows = filteredGraduates.map((g) => [
      g.convocationNumber || '',
      g.name,
      g.email,
      g.phone,
      g.course,
      g.status.certificateCollected ? 'Collected' : g.status.finalDispatched ? 'Dispatched' : 'Pending',
      g.trackingNumber || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graduates-export.csv';
    a.click();
  }

  function clearSearch() {
    setSearchQuery('');
  }

  // Open graduate detail modal
  async function openGraduateDetail(graduate: Graduate) {
    setSelectedGraduate(graduate);
    setGraduateAddress(null);

    // Fetch address if convocation number exists
    if (graduate.convocationNumber) {
      setAddressLoading(true);
      try {
        const response = await fetch(
          `/api/airtable/address?registrationNumber=${encodeURIComponent(graduate.convocationNumber)}&fullData=true`
        );
        const data = await response.json();
        if (data.success && data.data?.address) {
          setGraduateAddress(data.data.address);
        }
      } catch (err) {
        console.error('Failed to fetch address:', err);
      } finally {
        setAddressLoading(false);
      }
    }
  }

  function closeGraduateDetail() {
    setSelectedGraduate(null);
    setGraduateAddress(null);
    setShowEmailModal(false);
    setEmailResult(null);
  }

  // Send email to graduate
  async function sendEmailToGraduate(template: 'CERTIFICATE_READY_ATTENDING' | 'CERTIFICATE_READY_NOT_ATTENDING' | 'DISPATCHED_COURIER') {
    if (!selectedGraduate || !selectedGraduate.email) return;

    setEmailSending(true);
    setEmailResult(null);

    try {
      // Prepare data based on template
      const data: Record<string, unknown> = {
        name: selectedGraduate.name,
        convocationNumber: selectedGraduate.convocationNumber || '',
        course: selectedGraduate.course,
      };

      if (template === 'CERTIFICATE_READY_NOT_ATTENDING' && graduateAddress) {
        data.address = graduateAddress;
      }

      if (template === 'DISPATCHED_COURIER') {
        data.courierName = selectedGraduate.dispatchMethod || 'Courier';
        data.trackingNumber = selectedGraduate.trackingNumber || '';
        if (graduateAddress) {
          data.address = graduateAddress;
        }
      }

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedGraduate.email,
          template,
          data,
          attachBadge: template === 'CERTIFICATE_READY_ATTENDING',
          convocationNumber: selectedGraduate.convocationNumber,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setEmailResult({ success: true, message: `Email sent successfully to ${selectedGraduate.email}` });
      } else {
        setEmailResult({ success: false, message: result.error || 'Failed to send email' });
      }
    } catch (err) {
      console.error('Failed to send email:', err);
      setEmailResult({ success: false, message: 'Failed to send email. Please try again.' });
    } finally {
      setEmailSending(false);
      setShowEmailModal(false);
    }
  }

  // Get current status text and color for a graduate
  function getGraduateCurrentStatus(g: Graduate): { text: string; color: string; icon: React.ElementType } {
    if (g.status.certificateCollected) {
      return { text: 'Certificate Collected', color: 'green', icon: Award };
    }
    if (g.status.finalDispatched) {
      return { text: 'Dispatched via Courier', color: 'indigo', icon: Send };
    }
    if (g.status.addressLabeled) {
      return { text: 'Address Label Printed', color: 'blue', icon: MapPin };
    }
    if (g.status.returnedToHO) {
      return { text: 'At Head Office', color: 'yellow', icon: Building2 };
    }
    if (g.status.gownReturned) {
      return { text: 'Gown Returned - Ready for Collection', color: 'amber', icon: Undo2 };
    }
    if (g.status.gownIssued) {
      return { text: 'Gown Issued - Pending Return', color: 'orange', icon: Shirt };
    }
    if (g.status.registered) {
      return { text: 'Registered at Venue', color: 'cyan', icon: UserCheck };
    }
    if (g.status.dispatchedToVenue) {
      return { text: 'In Transit to Venue', color: 'purple', icon: Truck };
    }
    if (g.status.packed) {
      return { text: 'Packed - Ready for Dispatch', color: 'gray', icon: Package };
    }
    return { text: 'Processing', color: 'gray', icon: Circle };
  }

  // Get scan time for a station
  function getScanTime(graduate: Graduate, stationId: string): string | null {
    const scan = graduate.scans?.find((s) => s.station === stationId);
    return scan ? format(new Date(scan.timestamp), 'dd MMM yyyy, h:mm a') : null;
  }

  // Check if station is completed
  function isStationCompleted(graduate: Graduate, stationId: string): boolean {
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
    return statusMap[stationId] || false;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500">
            Overview of certificate management
            {lastRefresh && (
              <span className="ml-2 text-gray-400">
                • Last sync: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-white"
            title="Sync with Tito"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Syncing...' : 'Sync'}</span>
          </button>
          <button
            onClick={exportCSV}
            className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
            title="Export CSV"
          >
            <Download className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Overview Cards with Circular Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Progress Card */}
        <GlassCard className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Overall Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <CircularProgress
              value={stats?.certificateCollected || 0}
              max={stats?.totalGraduates || 1}
              color="#22c55e"
              label="Collected"
              sublabel={`${stats?.certificateCollected || 0} of ${stats?.totalGraduates || 0}`}
            />
            <CircularProgress
              value={stats?.finalDispatched || 0}
              max={stats?.totalGraduates || 1}
              color="#6366f1"
              label="Dispatched"
              sublabel={`${stats?.finalDispatched || 0} of ${stats?.totalGraduates || 0}`}
            />
            <CircularProgress
              value={(stats?.certificateCollected || 0) + (stats?.finalDispatched || 0)}
              max={stats?.totalGraduates || 1}
              color="#3b82f6"
              label="Completed"
              sublabel="Collected + Dispatched"
            />
            <CircularProgress
              value={stats?.registered || 0}
              max={stats?.totalGraduates || 1}
              color="#06b6d4"
              label="Registered"
              sublabel={`${stats?.registered || 0} checked in`}
            />
          </div>
        </GlassCard>

        {/* Quick Stats Card */}
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-gray-600">Total Graduates</span>
              </div>
              <span className="text-xl font-bold text-gray-800">{stats?.totalGraduates || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-gray-600">Completed</span>
              </div>
              <span className="text-xl font-bold text-green-600">
                {(stats?.certificateCollected || 0) + (stats?.finalDispatched || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-gray-600">Pending</span>
              </div>
              <span className="text-xl font-bold text-amber-600">
                {(stats?.totalGraduates || 0) - (stats?.certificateCollected || 0) - (stats?.finalDispatched || 0)}
              </span>
            </div>
            {(stats?.pendingGownDeposit || 0) > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Shirt className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-700">Gown Returns</span>
                </div>
                <span className="text-xl font-bold text-amber-600">{stats?.pendingGownDeposit || 0}</span>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Certificate Pipeline Flow */}
      <GlassCard className="p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Certificate Pipeline</h2>
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between min-w-[800px] gap-2">
            {[
              { label: 'Packed', value: stats?.packed || 0, color: 'bg-gray-500', icon: Package },
              { label: 'At Venue', value: stats?.dispatchedToVenue || 0, color: 'bg-purple-500', icon: Truck },
              { label: 'Registered', value: stats?.registered || 0, color: 'bg-cyan-500', icon: UserCheck },
              { label: 'Gown Issued', value: stats?.gownIssued || 0, color: 'bg-orange-500', icon: Shirt },
              { label: 'Gown Return', value: stats?.gownReturned || 0, color: 'bg-amber-500', icon: Shirt },
              { label: 'Collected', value: stats?.certificateCollected || 0, color: 'bg-green-500', icon: Award },
            ].map((step, index, arr) => {
              const percentage = stats?.totalGraduates ? Math.round((step.value / stats.totalGraduates) * 100) : 0;
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex-1 text-center">
                    <div className={`w-16 h-16 mx-auto rounded-full ${step.color.replace('bg-', 'bg-')}/10 flex items-center justify-center mb-2 relative`}>
                      <Icon className={`w-7 h-7 ${step.color.replace('bg-', 'text-')}`} />
                      <div className="absolute -bottom-1 -right-1 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm">
                        <span className="text-xs font-bold text-gray-700">{percentage}%</span>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{step.value}</p>
                    <p className="text-xs text-gray-500">{step.label}</p>
                  </div>
                  {index < arr.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-gray-300 shrink-0 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Post-event pipeline */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Post-Event Dispatch</p>
          <div className="flex items-center justify-start gap-2">
            {[
              { label: 'At Head Office', value: stats?.returnedToHO || 0, color: 'bg-yellow-500', icon: Building2 },
              { label: 'Address Labeled', value: 0, color: 'bg-blue-500', icon: MapPin },
              { label: 'Dispatched', value: stats?.finalDispatched || 0, color: 'bg-indigo-500', icon: Send },
            ].map((step, index, arr) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="text-center min-w-[100px]">
                    <div className={`w-12 h-12 mx-auto rounded-full ${step.color.replace('bg-', 'bg-')}/10 flex items-center justify-center mb-2`}>
                      <Icon className={`w-5 h-5 ${step.color.replace('bg-', 'text-')}`} />
                    </div>
                    <p className="text-lg font-bold text-gray-800">{step.value}</p>
                    <p className="text-xs text-gray-500">{step.label}</p>
                  </div>
                  {index < arr.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mx-2" />
                  )}
                </div>
              );
            })}
            {dispatchMeta && (stats?.finalDispatched || 0) > 0 && (
              <div className="ml-4 pl-4 border-l border-gray-200 text-sm">
                <p className="text-gray-500">DTDC: <span className="text-gray-800 font-medium">{dispatchMeta.dispatchedDTDC}</span></p>
                <p className="text-gray-500">India Post: <span className="text-gray-800 font-medium">{dispatchMeta.dispatchedIndiaPost}</span></p>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Alerts */}
      {(stats?.pendingGownDeposit || 0) > 0 && (
        <div className="p-4 mb-8 border border-amber-200 bg-amber-50 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-700">Pending Gown Returns</p>
              <p className="text-sm text-amber-600">
                {stats?.pendingGownDeposit} graduates have pending gown returns (₹
                {(stats?.pendingGownDeposit || 0) * 500} refundable deposits)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Station Progress - Material Dashboard Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          { id: 'packing', name: 'Packing', icon: Package, gradient: 'from-gray-500 to-gray-600', color: '#6b7280' },
          { id: 'dispatch-venue', name: 'Dispatch to Venue', icon: Truck, gradient: 'from-purple-500 to-purple-600', color: '#a855f7' },
          { id: 'registration', name: 'Registration', icon: UserCheck, gradient: 'from-cyan-500 to-cyan-600', color: '#06b6d4' },
          { id: 'gown-issue', name: 'Gown Issue', icon: Shirt, gradient: 'from-orange-500 to-orange-600', color: '#f97316' },
          { id: 'gown-return', name: 'Gown Return', icon: Undo2, gradient: 'from-amber-500 to-amber-600', color: '#f59e0b' },
          { id: 'certificate-collection', name: 'Certificate Collection', icon: Award, gradient: 'from-green-500 to-green-600', color: '#22c55e' },
        ].map((station) => {
          const count = (() => {
            switch (station.id) {
              case 'packing': return stats?.packed || 0;
              case 'dispatch-venue': return stats?.dispatchedToVenue || 0;
              case 'registration': return stats?.registered || 0;
              case 'gown-issue': return stats?.gownIssued || 0;
              case 'gown-return': return stats?.gownReturned || 0;
              case 'certificate-collection': return stats?.certificateCollected || 0;
              default: return 0;
            }
          })();
          const total = stats?.totalGraduates || 1;
          const percentage = Math.round((count / total) * 100);
          const Icon = station.icon;

          return (
            <div key={station.id} className="relative">
              <GlassCard className="pt-10 pb-6 px-6">
                {/* Floating Icon Badge */}
                <div className={`absolute -top-5 left-6 w-16 h-16 rounded-xl bg-gradient-to-br ${station.gradient} shadow-lg flex items-center justify-center`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Stats */}
                <div className="flex justify-end mb-4">
                  <div className="text-right">
                    <p className="text-gray-500 text-sm">{station.name}</p>
                    <p className="text-2xl font-bold text-gray-800">{count}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100 mb-4" />

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium" style={{ color: station.color }}>{percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${station.gradient} transition-all duration-700 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right">{count} of {total}</p>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>

      {/* Station Links - Shareable URLs */}
      <GlassCard className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Station Links</h2>
          <p className="text-xs text-gray-400">Share with staff for multi-device check-in</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stations.map((station) => {
            const Icon = stationIconMap[station.icon] || Package;
            const stationUrl = `${baseUrl}/stations/${station.id}`;
            const checkinList = checkinLists.find(l => {
              const mapping: Record<string, string> = {
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
              return l.title === mapping[station.id];
            });

            return (
              <div
                key={station.id}
                className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{station.name}</p>
                    {checkinList && (
                      <p className="text-xs text-gray-400">
                        {checkinList.checked_in}/{checkinList.total}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyStationUrl(station.id)}
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    title="Copy link"
                  >
                    {copiedStation === station.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setShowQRModal(station.id)}
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    title="Show QR code"
                  >
                    <QrCode className="w-4 h-4 text-gray-400" />
                  </button>
                  <a
                    href={`/stations/${station.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded hover:bg-gray-200 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Scan to Open</h3>
              <button onClick={() => setShowQRModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white border-2 border-gray-100 rounded-xl">
                <QRCode value={`${baseUrl}/stations/${showQRModal}`} size={200} />
              </div>
            </div>
            <p className="text-center text-gray-600 text-sm mb-4">
              {stations.find(s => s.id === showQRModal)?.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => copyStationUrl(showQRModal)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                {copiedStation === showQRModal ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedStation === showQRModal ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-center text-gray-400 text-xs mt-4 break-all">
              {baseUrl}/stations/{showQRModal}
            </p>
          </div>
        </div>
      )}

      {/* Graduate Detail Modal */}
      {selectedGraduate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start justify-end z-50 p-4"
          onClick={closeGraduateDetail}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-start justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Dr. {selectedGraduate.name}</h2>
                  <p className="text-gray-500 text-sm">{selectedGraduate.course}</p>
                </div>
              </div>
              <button
                onClick={closeGraduateDetail}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Graduate Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Graduate Info
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  {selectedGraduate.convocationNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Conv. No.</span>
                      <span className="font-mono font-bold text-blue-600">{selectedGraduate.convocationNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Course</span>
                    <span className="text-gray-800">{selectedGraduate.course}</span>
                  </div>
                  {selectedGraduate.email && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        Email
                      </span>
                      <span className="text-gray-800 text-sm">{selectedGraduate.email}</span>
                    </div>
                  )}
                  {selectedGraduate.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        Phone
                      </span>
                      <span className="text-gray-800">{selectedGraduate.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping Address
                </h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  {addressLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  ) : graduateAddress && graduateAddress.line1 ? (
                    <div className="space-y-1 text-gray-600">
                      <p>{graduateAddress.line1}</p>
                      {graduateAddress.line2 && <p>{graduateAddress.line2}</p>}
                      <p>{graduateAddress.city}, {graduateAddress.state}</p>
                      <p className="font-bold text-gray-800">{graduateAddress.pincode}</p>
                      <p>{graduateAddress.country}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-2">Address not available</p>
                  )}
                </div>
              </div>

              {/* Current Status */}
              {(() => {
                const status = getGraduateCurrentStatus(selectedGraduate);
                const StatusIcon = status.icon;
                return (
                  <div className={`p-4 rounded-xl border-2 ${
                    status.color === 'green' ? 'border-green-200 bg-green-50' :
                    status.color === 'indigo' ? 'border-indigo-200 bg-indigo-50' :
                    status.color === 'blue' ? 'border-blue-200 bg-blue-50' :
                    status.color === 'yellow' ? 'border-yellow-200 bg-yellow-50' :
                    status.color === 'amber' ? 'border-amber-200 bg-amber-50' :
                    status.color === 'orange' ? 'border-orange-200 bg-orange-50' :
                    status.color === 'cyan' ? 'border-cyan-200 bg-cyan-50' :
                    status.color === 'purple' ? 'border-purple-200 bg-purple-50' :
                    'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`w-6 h-6 ${
                        status.color === 'green' ? 'text-green-600' :
                        status.color === 'indigo' ? 'text-indigo-600' :
                        status.color === 'blue' ? 'text-blue-600' :
                        status.color === 'yellow' ? 'text-yellow-600' :
                        status.color === 'amber' ? 'text-amber-600' :
                        status.color === 'orange' ? 'text-orange-600' :
                        status.color === 'cyan' ? 'text-cyan-600' :
                        status.color === 'purple' ? 'text-purple-600' :
                        'text-gray-500'
                      }`} />
                      <div>
                        <p className="text-gray-500 text-xs uppercase">Current Status</p>
                        <p className={`font-semibold ${
                          status.color === 'green' ? 'text-green-700' :
                          status.color === 'indigo' ? 'text-indigo-700' :
                          status.color === 'blue' ? 'text-blue-700' :
                          status.color === 'yellow' ? 'text-yellow-700' :
                          status.color === 'amber' ? 'text-amber-700' :
                          status.color === 'orange' ? 'text-orange-700' :
                          status.color === 'cyan' ? 'text-cyan-700' :
                          status.color === 'purple' ? 'text-purple-700' :
                          'text-gray-700'
                        }`}>{status.text}</p>
                      </div>
                    </div>
                    {/* Show tracking info if dispatched */}
                    {selectedGraduate.status.finalDispatched && selectedGraduate.trackingNumber && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-gray-500 text-sm">
                          {selectedGraduate.dispatchMethod}: <span className="font-mono text-gray-800">{selectedGraduate.trackingNumber}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Certificate Journey Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Certificate Journey
                </h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                    <div className="space-y-4">
                      {stations.map((station, index) => {
                        const Icon = stationIconMap[station.icon] || Package;
                        const isCompleted = isStationCompleted(selectedGraduate, station.id);
                        const scanTime = getScanTime(selectedGraduate, station.id);

                        return (
                          <div key={station.id} className="relative flex items-start gap-3 pl-1">
                            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              isCompleted ? 'bg-green-500' : 'bg-gray-200'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-white" />
                              ) : (
                                <span className="text-xs text-gray-400">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${isCompleted ? 'text-green-500' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                  {station.name}
                                </span>
                              </div>
                              {scanTime ? (
                                <p className="text-xs text-green-600 mt-0.5 ml-6">{scanTime}</p>
                              ) : (
                                <p className="text-xs text-gray-300 mt-0.5 ml-6">Pending</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {selectedGraduate.convocationNumber && (
                  <a
                    href={`/api/badge/${selectedGraduate.convocationNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium"
                  >
                    <Printer className="w-4 h-4" />
                    Print Badge
                  </a>
                )}
                {selectedGraduate.convocationNumber && (
                  <a
                    href={`/api/badge/${selectedGraduate.convocationNumber}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors text-sm font-medium"
                  >
                    <MapPin className="w-4 h-4" />
                    Print Label
                  </a>
                )}
                {selectedGraduate.email && (
                  <div className="relative">
                    <button
                      onClick={() => setShowEmailModal(!showEmailModal)}
                      disabled={emailSending}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-xl transition-colors text-sm font-medium"
                    >
                      {emailSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {emailSending ? 'Sending...' : 'Send Email'}
                    </button>
                    {/* Email Template Dropdown */}
                    {showEmailModal && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20">
                        <div className="p-2 border-b border-gray-100">
                          <p className="text-xs text-gray-500 px-2">Select Email Template</p>
                        </div>
                        <button
                          onClick={() => sendEmailToGraduate('CERTIFICATE_READY_ATTENDING')}
                          className="w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
                        >
                          <p className="text-sm font-medium text-gray-800">Certificate Ready (Attending)</p>
                          <p className="text-xs text-gray-500">For graduates attending convocation</p>
                        </button>
                        <button
                          onClick={() => sendEmailToGraduate('CERTIFICATE_READY_NOT_ATTENDING')}
                          className="w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100"
                        >
                          <p className="text-sm font-medium text-gray-800">Certificate Ready (Not Attending)</p>
                          <p className="text-xs text-gray-500">For graduates receiving by courier</p>
                        </button>
                        <button
                          onClick={() => sendEmailToGraduate('DISPATCHED_COURIER')}
                          className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-800">Dispatched via Courier</p>
                          <p className="text-xs text-gray-500">With tracking information</p>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email Result Feedback */}
              {emailResult && (
                <div className={`p-3 rounded-xl text-sm ${
                  emailResult.success
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {emailResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <p>{emailResult.message}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graduates List */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Graduates</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, conv. no, email, mobile..."
                className="pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full sm:w-80"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="collected">Collected</option>
              <option value="dispatched">Dispatched</option>
              <option value="uncollected">Uncollected</option>
              <option value="pending-gown">Pending Gown</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Conv. No.</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Name</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm hidden md:table-cell">Contact</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Course</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && graduates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center gap-2 text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Loading {stats?.totalGraduates || ''} graduates from Tito...</span>
                      <span className="text-xs">This may take a moment for large datasets</span>
                    </div>
                  </td>
                </tr>
              ) : filteredGraduates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <div className="text-gray-400 space-y-2">
                      <p className="font-medium">No graduates found</p>
                      {searchQuery && (
                        <div className="text-sm space-y-1">
                          <p>Try searching by:</p>
                          <ul className="text-gray-400">
                            <li>Name (e.g., &quot;Sanjay&quot;)</li>
                            <li>Convocation Number (e.g., &quot;118AEC&quot;)</li>
                            <li>Mobile Number (e.g., &quot;98765&quot;)</li>
                            <li>Email (e.g., &quot;gmail&quot;)</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGraduates.map((graduate) => (
                  <tr
                    key={graduate.id}
                    onClick={() => openGraduateDetail(graduate)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="text-gray-800 font-mono text-sm">
                        {graduate.convocationNumber || '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-800">{graduate.name}</div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <div className="text-gray-500 text-xs">{graduate.email}</div>
                      {graduate.phone && (
                        <div className="text-gray-400 text-xs">{graduate.phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{graduate.course}</td>
                    <td className="py-3 px-4">
                      {graduate.status.certificateCollected ? (
                        <StatusBadge status="completed" label="Collected" />
                      ) : graduate.status.finalDispatched ? (
                        <StatusBadge status="completed" label="Dispatched" />
                      ) : graduate.status.gownIssued && !graduate.status.gownReturned ? (
                        <StatusBadge status="in-progress" label="Pending Gown" />
                      ) : (
                        <StatusBadge status="pending" label="Pending" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
          <span>
            Showing {filteredGraduates.length} of {graduates.length} graduates
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          {loading && graduates.length > 0 && (
            <span className="flex items-center gap-2 text-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing...
            </span>
          )}
        </div>
      </GlassCard>
    </div>
    </div>
  );
}
