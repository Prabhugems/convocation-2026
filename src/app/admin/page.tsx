'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import StatusBadge from '@/components/StatusBadge';
import CircularProgress from '@/components/CircularProgress';
import { DashboardStats, Graduate, Address } from '@/types';
import { stations } from '@/lib/stations';
import { ArrowRight, CheckCircle2, Clock, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutDashboard, Users as UsersIcon, BarChart3, Settings, Bell, Menu, GraduationCap, List, ArrowUpDown } from 'lucide-react';
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

// Sidebar navigation items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'graduates', label: 'Graduates', icon: UsersIcon },
  { id: 'stations', label: 'Stations', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [graduatesView, setGraduatesView] = useState<'all' | 'by-course'>('all');
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'convocationNumber' | 'course' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
      if (g.convocationNumber?.toLowerCase().includes(searchTerm)) return true;
      if (g.registrationNumber.toLowerCase().includes(searchTerm)) return true;
      if (g.name.toLowerCase().includes(searchTerm)) return true;
      if (g.email.toLowerCase().includes(searchTerm)) return true;
      const cleanPhone = g.phone?.replace(/[\s\-\+]/g, '') || '';
      const cleanQuery = searchTerm.replace(/[\s\-\+]/g, '');
      if (cleanPhone.includes(cleanQuery)) return true;
      if (g.course.toLowerCase().includes(searchTerm)) return true;
      if (g.ticketSlug?.toLowerCase().includes(searchTerm)) return true;
      return false;
    });
  }, []);

  // Memoized filtered graduates
  const filteredGraduates = useMemo(() => {
    let result = searchGraduates(graduates, searchQuery);

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

    if (searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase();
      result.sort((a, b) => {
        const aExactConv = a.convocationNumber?.toLowerCase() === searchTerm;
        const bExactConv = b.convocationNumber?.toLowerCase() === searchTerm;
        if (aExactConv && !bExactConv) return -1;
        if (bExactConv && !aExactConv) return 1;
        const aExactRef = a.registrationNumber.toLowerCase() === searchTerm;
        const bExactRef = b.registrationNumber.toLowerCase() === searchTerm;
        if (aExactRef && !bExactRef) return -1;
        if (bExactRef && !aExactRef) return 1;
        const aNameStarts = a.name.toLowerCase().startsWith(searchTerm);
        const bNameStarts = b.name.toLowerCase().startsWith(searchTerm);
        if (aNameStarts && !bNameStarts) return -1;
        if (bNameStarts && !aNameStarts) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    return result;
  }, [graduates, searchQuery, filterStatus, searchGraduates]);

  // Group graduates by course
  const graduatesByCourse = useMemo(() => {
    const grouped: Record<string, Graduate[]> = {};
    filteredGraduates.forEach((g) => {
      const course = g.course || 'Unknown';
      if (!grouped[course]) {
        grouped[course] = [];
      }
      grouped[course].push(g);
    });
    // Sort courses alphabetically
    const sortedEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    return sortedEntries;
  }, [filteredGraduates]);

  // Toggle course expansion
  const toggleCourseExpansion = (course: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(course)) {
        next.delete(course);
      } else {
        next.add(course);
      }
      return next;
    });
  };

  // Sort graduates
  const sortedGraduates = useMemo(() => {
    const sorted = [...filteredGraduates];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'convocationNumber':
          comparison = (a.convocationNumber || '').localeCompare(b.convocationNumber || '');
          break;
        case 'course':
          comparison = a.course.localeCompare(b.course);
          break;
        case 'status':
          const getStatusPriority = (g: Graduate) => {
            if (g.status.certificateCollected) return 1;
            if (g.status.finalDispatched) return 2;
            if (g.status.gownIssued && !g.status.gownReturned) return 3;
            return 4;
          };
          comparison = getStatusPriority(a) - getStatusPriority(b);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredGraduates, sortField, sortOrder]);

  // Handle sort click
  const handleSort = (field: 'name' | 'convocationNumber' | 'course' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Get sort icon for column
  const getSortIcon = (field: 'name' | 'convocationNumber' | 'course' | 'status') => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-500" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

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
    if (g.status.certificateCollected) return { text: 'Certificate Collected', color: 'green', icon: Award };
    if (g.status.finalDispatched) return { text: 'Dispatched via Courier', color: 'indigo', icon: Send };
    if (g.status.addressLabeled) return { text: 'Address Label Printed', color: 'blue', icon: MapPin };
    if (g.status.returnedToHO) return { text: 'At Head Office', color: 'yellow', icon: Building2 };
    if (g.status.gownReturned) return { text: 'Gown Returned - Ready for Collection', color: 'amber', icon: Undo2 };
    if (g.status.gownIssued) return { text: 'Gown Issued - Pending Return', color: 'orange', icon: Shirt };
    if (g.status.registered) return { text: 'Registered at Venue', color: 'cyan', icon: UserCheck };
    if (g.status.dispatchedToVenue) return { text: 'In Transit to Venue', color: 'purple', icon: Truck };
    if (g.status.packed) return { text: 'Packed - Ready for Dispatch', color: 'gray', icon: Package };
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-40 h-screen bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-700/50">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">AMASI</h1>
                <p className="text-xs text-slate-400">Admin Panel</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-all duration-200 hover:scale-105 active:scale-95 hidden lg:block"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Hover effect */}
                <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? 'opacity-100' : ''}`} />

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-400 to-purple-500 rounded-r-full" />
                )}

                <Icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${isActive ? 'text-blue-400' : 'group-hover:scale-110'}`} />
                {!sidebarCollapsed && (
                  <span className="relative z-10 font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Stats Mini Card */}
        {!sidebarCollapsed && (
          <div className="absolute bottom-4 left-4 right-4 p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-slate-700/50 animate-fade-in-up">
            <p className="text-xs text-slate-400 mb-2">Total Progress</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats ? Math.round(((stats.certificateCollected + stats.finalDispatched) / stats.totalGraduates) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-400">Completed</p>
              </div>
              <div className="w-16 h-16">
                <CircularProgress
                  value={(stats?.certificateCollected || 0) + (stats?.finalDispatched || 0)}
                  max={stats?.totalGraduates || 1}
                  size={64}
                  strokeWidth={6}
                  color="#3b82f6"
                  bgColor="rgba(255,255,255,0.1)"
                  showPercentage={false}
                />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white capitalize">{activeNav}</h1>
              <p className="text-xs text-slate-400">
                {lastRefresh && `Last sync: ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Syncing...' : 'Sync'}</span>
            </button>
            <button
              onClick={exportCSV}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 active:scale-95 group"
              title="Export CSV"
            >
              <Download className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
            <button className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all duration-300 hover:scale-105 active:scale-95 group">
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
              {(stats?.pendingGownDeposit || 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center animate-pulse">
                  {stats?.pendingGownDeposit}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-4 lg:p-8 space-y-6">
          {/* Conditionally render based on activeNav */}
          {activeNav === 'dashboard' && (
            <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Graduates', value: stats?.totalGraduates || 0, icon: Users, gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20' },
              { label: 'Collected', value: stats?.certificateCollected || 0, icon: Award, gradient: 'from-green-500 to-green-600', shadow: 'shadow-green-500/20' },
              { label: 'Dispatched', value: stats?.finalDispatched || 0, icon: Send, gradient: 'from-purple-500 to-purple-600', shadow: 'shadow-purple-500/20' },
              { label: 'Pending', value: (stats?.totalGraduates || 0) - (stats?.certificateCollected || 0) - (stats?.finalDispatched || 0), icon: Clock, gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-500/20' },
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`relative group overflow-hidden bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-500 hover:scale-[1.02] hover:shadow-xl ${stat.shadow} cursor-pointer animate-fade-in-up`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                  {/* Floating icon */}
                  <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:scale-110`} />

                  <div className="relative z-10">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-4 shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white group-hover:scale-105 transition-transform duration-300 origin-left">{stat.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Circular Progress Card */}
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Overall Progress
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { label: 'Collected', value: stats?.certificateCollected || 0, color: '#22c55e' },
                  { label: 'Dispatched', value: stats?.finalDispatched || 0, color: '#6366f1' },
                  { label: 'Completed', value: (stats?.certificateCollected || 0) + (stats?.finalDispatched || 0), color: '#3b82f6' },
                  { label: 'Registered', value: stats?.registered || 0, color: '#06b6d4' },
                ].map((item, index) => (
                  <div key={item.label} className="flex flex-col items-center group hover:scale-105 transition-transform duration-300" style={{ animationDelay: `${300 + index * 50}ms` }}>
                    <CircularProgress
                      value={item.value}
                      max={stats?.totalGraduates || 1}
                      color={item.color}
                      bgColor="rgba(255,255,255,0.1)"
                      label={item.label}
                      sublabel={`${item.value} of ${stats?.totalGraduates || 0}`}
                      dark
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Quick Stats
              </h2>
              <div className="space-y-3">
                {[
                  { label: 'Total Graduates', value: stats?.totalGraduates || 0, icon: Users, color: 'blue' },
                  { label: 'Completed', value: (stats?.certificateCollected || 0) + (stats?.finalDispatched || 0), icon: CheckCircle2, color: 'green' },
                  { label: 'Pending', value: (stats?.totalGraduates || 0) - (stats?.certificateCollected || 0) - (stats?.finalDispatched || 0), icon: Clock, color: 'amber' },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center justify-between p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-300 hover:translate-x-1 cursor-pointer group`}
                      style={{ animationDelay: `${350 + index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 text-${item.color}-400 group-hover:scale-110 transition-transform duration-300`} />
                        <span className="text-slate-300 text-sm">{item.label}</span>
                      </div>
                      <span className={`text-lg font-bold text-${item.color}-400`}>{item.value}</span>
                    </div>
                  );
                })}

                {(stats?.pendingGownDeposit || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all duration-300 hover:translate-x-1 cursor-pointer group animate-pulse-soft">
                    <div className="flex items-center gap-3">
                      <Shirt className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-amber-300 text-sm">Gown Returns</span>
                    </div>
                    <span className="text-lg font-bold text-amber-400">{stats?.pendingGownDeposit || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Certificate Pipeline */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Certificate Pipeline
            </h2>
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between min-w-[800px] gap-2">
                {[
                  { label: 'Packed', value: stats?.packed || 0, color: 'gray', icon: Package },
                  { label: 'At Venue', value: stats?.dispatchedToVenue || 0, color: 'purple', icon: Truck },
                  { label: 'Registered', value: stats?.registered || 0, color: 'cyan', icon: UserCheck },
                  { label: 'Gown Issued', value: stats?.gownIssued || 0, color: 'orange', icon: Shirt },
                  { label: 'Gown Return', value: stats?.gownReturned || 0, color: 'amber', icon: Shirt },
                  { label: 'Collected', value: stats?.certificateCollected || 0, color: 'green', icon: Award },
                ].map((step, index, arr) => {
                  const percentage = stats?.totalGraduates ? Math.round((step.value / stats.totalGraduates) * 100) : 0;
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex items-center flex-1 group">
                      <div className="flex-1 text-center">
                        <div className={`w-16 h-16 mx-auto rounded-2xl bg-${step.color}-500/20 flex items-center justify-center mb-3 relative group-hover:scale-110 transition-transform duration-300 cursor-pointer`}>
                          <Icon className={`w-7 h-7 text-${step.color}-400`} />
                          <div className="absolute -bottom-1 -right-1 bg-slate-900 border border-slate-700 rounded-full px-1.5 py-0.5 shadow-lg">
                            <span className="text-xs font-bold text-slate-300">{percentage}%</span>
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-white group-hover:scale-110 transition-transform duration-300">{step.value}</p>
                        <p className="text-xs text-slate-400">{step.label}</p>
                      </div>
                      {index < arr.length - 1 && (
                        <ArrowRight className="w-5 h-5 text-slate-600 shrink-0 mx-1 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Post-event pipeline */}
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-sm text-slate-400 mb-4">Post-Event Dispatch</p>
              <div className="flex items-center justify-start gap-4 flex-wrap">
                {[
                  { label: 'At Head Office', value: stats?.returnedToHO || 0, color: 'yellow', icon: Building2 },
                  { label: 'Address Labeled', value: 0, color: 'blue', icon: MapPin },
                  { label: 'Dispatched', value: stats?.finalDispatched || 0, color: 'indigo', icon: Send },
                ].map((step, index, arr) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className="flex items-center group">
                      <div className="text-center min-w-[100px]">
                        <div className={`w-12 h-12 mx-auto rounded-xl bg-${step.color}-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300 cursor-pointer`}>
                          <Icon className={`w-5 h-5 text-${step.color}-400`} />
                        </div>
                        <p className="text-lg font-bold text-white">{step.value}</p>
                        <p className="text-xs text-slate-400">{step.label}</p>
                      </div>
                      {index < arr.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 mx-2" />
                      )}
                    </div>
                  );
                })}
                {dispatchMeta && (stats?.finalDispatched || 0) > 0 && (
                  <div className="ml-4 pl-4 border-l border-slate-700 text-sm">
                    <p className="text-slate-400">DTDC: <span className="text-white font-medium">{dispatchMeta.dispatchedDTDC}</span></p>
                    <p className="text-slate-400">India Post: <span className="text-white font-medium">{dispatchMeta.dispatchedIndiaPost}</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {(stats?.pendingGownDeposit || 0) > 0 && (
            <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-xl animate-fade-in-up flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center animate-bounce-soft">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-amber-300">Pending Gown Returns</p>
                <p className="text-sm text-amber-400/80">
                  {stats?.pendingGownDeposit} graduates have pending gown returns (₹{(stats?.pendingGownDeposit || 0) * 500} refundable deposits)
                </p>
              </div>
            </div>
          )}

          {/* Station Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'packing', name: 'Packing', icon: Package, gradient: 'from-slate-500 to-slate-600', color: '#64748b' },
              { id: 'dispatch-venue', name: 'Dispatch to Venue', icon: Truck, gradient: 'from-purple-500 to-purple-600', color: '#a855f7' },
              { id: 'registration', name: 'Registration', icon: UserCheck, gradient: 'from-cyan-500 to-cyan-600', color: '#06b6d4' },
              { id: 'gown-issue', name: 'Gown Issue', icon: Shirt, gradient: 'from-orange-500 to-orange-600', color: '#f97316' },
              { id: 'gown-return', name: 'Gown Return', icon: Undo2, gradient: 'from-amber-500 to-amber-600', color: '#f59e0b' },
              { id: 'certificate-collection', name: 'Certificate Collection', icon: Award, gradient: 'from-green-500 to-green-600', color: '#22c55e' },
            ].map((station, index) => {
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
                <div
                  key={station.id}
                  className="relative group animate-fade-in-up"
                  style={{ animationDelay: `${400 + index * 50}ms` }}
                >
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl pt-10 pb-6 px-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-500 hover:scale-[1.02] hover:shadow-xl cursor-pointer">
                    {/* Floating Icon Badge */}
                    <div className={`absolute -top-5 left-6 w-16 h-16 rounded-xl bg-gradient-to-br ${station.gradient} shadow-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    {/* Hover glow */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${station.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                    {/* Stats */}
                    <div className="flex justify-end mb-4 relative z-10">
                      <div className="text-right">
                        <p className="text-slate-400 text-sm">{station.name}</p>
                        <p className="text-2xl font-bold text-white group-hover:scale-105 transition-transform duration-300 origin-right">{count}</p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-700/50 mb-4" />

                    {/* Progress */}
                    <div className="space-y-2 relative z-10">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-medium" style={{ color: station.color }}>{percentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${station.gradient} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 text-right">{count} of {total}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

            </>
          )}

          {/* Graduates View - Only shown when Graduates is selected in sidebar */}
          {activeNav === 'graduates' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* View Toggle Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGraduatesView('all')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                  graduatesView === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <List className="w-4 h-4" />
                All Graduates
              </button>
              <button
                onClick={() => setGraduatesView('by-course')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                  graduatesView === 'by-course'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                By Course
              </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-indigo-400" />
                {graduatesView === 'all' ? 'All Graduates' : 'Graduates by Course'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, conv. no, email, mobile..."
                    className="pl-10 pr-10 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 w-full sm:w-80"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="collected">Collected</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="uncollected">Uncollected</option>
                  <option value="pending-gown">Pending Gown</option>
                </select>
              </div>
            </div>

            {/* All Graduates Table View */}
            {graduatesView === 'all' && (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th
                      className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors group"
                      onClick={() => handleSort('convocationNumber')}
                    >
                      <div className="flex items-center gap-2">
                        Conv. No.
                        {getSortIcon('convocationNumber')}
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm hidden md:table-cell">Contact</th>
                    <th
                      className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('course')}
                    >
                      <div className="flex items-center gap-2">
                        Course
                        {getSortIcon('course')}
                      </div>
                    </th>
                    <th
                      className="text-left py-3 px-4 text-slate-400 font-medium text-sm cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && graduates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                          <span className="text-slate-400">Loading {stats?.totalGraduates || ''} graduates from Tito...</span>
                          <span className="text-xs text-slate-500">This may take a moment for large datasets</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedGraduates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <div className="text-slate-400 space-y-2">
                          <p className="font-medium">No graduates found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedGraduates.slice(0, 50).map((graduate, index) => (
                      <tr
                        key={graduate.id}
                        onClick={() => openGraduateDetail(graduate)}
                        className="border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-all duration-200 group animate-fade-in"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td className="py-3 px-4">
                          <div className="text-white font-mono text-sm group-hover:text-blue-400 transition-colors">
                            {graduate.convocationNumber || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-white group-hover:text-blue-400 transition-colors">{graduate.name}</div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <div className="text-slate-400 text-xs">{graduate.email}</div>
                          {graduate.phone && (
                            <div className="text-slate-500 text-xs">{graduate.phone}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300 text-sm">{graduate.course}</td>
                        <td className="py-3 px-4">
                          {graduate.status.certificateCollected ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              <CheckCircle className="w-3 h-3" />
                              Collected
                            </span>
                          ) : graduate.status.finalDispatched ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                              <Send className="w-3 h-3" />
                              Dispatched
                            </span>
                          ) : graduate.status.gownIssued && !graduate.status.gownReturned ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Pending Gown
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                              <Circle className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                Showing {Math.min(sortedGraduates.length, 50)} of {graduates.length} graduates
                {searchQuery && ` matching "${searchQuery}"`}
                {sortField !== 'name' && ` • Sorted by ${sortField}`}
              </span>
              {loading && graduates.length > 0 && (
                <span className="flex items-center gap-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Refreshing...
                </span>
              )}
            </div>
            </>
            )}

            {/* Course-wise View */}
            {graduatesView === 'by-course' && (
            <div className="space-y-3">
              {graduatesByCourse.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p className="font-medium">No graduates found</p>
                </div>
              ) : (
                graduatesByCourse.map(([course, courseGraduates]) => {
                  const isExpanded = expandedCourses.has(course);
                  const collected = courseGraduates.filter(g => g.status.certificateCollected).length;
                  const dispatched = courseGraduates.filter(g => g.status.finalDispatched).length;
                  const pending = courseGraduates.length - collected - dispatched;

                  return (
                    <div key={course} className="border border-slate-700/50 rounded-xl overflow-hidden">
                      {/* Course Header */}
                      <button
                        onClick={() => toggleCourseExpansion(course)}
                        className="w-full flex items-center justify-between p-4 bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <GraduationCap className="w-5 h-5 text-purple-400" />
                          <div className="text-left">
                            <p className="font-medium text-white">{course}</p>
                            <p className="text-xs text-slate-400">{courseGraduates.length} graduates</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400">{collected} collected</span>
                            <span className="px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-400">{dispatched} dispatched</span>
                            <span className="px-2 py-1 rounded-full bg-slate-500/20 text-slate-400">{pending} pending</span>
                          </div>
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded Graduates List */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/50 animate-fade-in">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-700/30 bg-slate-800/30">
                                <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Conv. No.</th>
                                <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Name</th>
                                <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs hidden md:table-cell">Contact</th>
                                <th className="text-left py-2 px-4 text-slate-500 font-medium text-xs">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {courseGraduates.map((graduate) => (
                                <tr
                                  key={graduate.id}
                                  onClick={() => openGraduateDetail(graduate)}
                                  className="border-b border-slate-700/20 hover:bg-slate-700/20 cursor-pointer transition-colors group"
                                >
                                  <td className="py-2 px-4">
                                    <span className="text-white font-mono text-sm group-hover:text-blue-400 transition-colors">
                                      {graduate.convocationNumber || '-'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-4">
                                    <span className="text-white text-sm group-hover:text-blue-400 transition-colors">{graduate.name}</span>
                                  </td>
                                  <td className="py-2 px-4 hidden md:table-cell">
                                    <span className="text-slate-400 text-xs">{graduate.email}</span>
                                  </td>
                                  <td className="py-2 px-4">
                                    {graduate.status.certificateCollected ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                                        <CheckCircle className="w-3 h-3" />
                                        Collected
                                      </span>
                                    ) : graduate.status.finalDispatched ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-400">
                                        <Send className="w-3 h-3" />
                                        Dispatched
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400">
                                        <Circle className="w-3 h-3" />
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div className="mt-4 text-sm text-slate-400">
                <span>{graduatesByCourse.length} courses • {filteredGraduates.length} graduates total</span>
              </div>
            </div>
            )}
          </div>
          </div>
          )}

          {/* Stations View - Station Links */}
          {activeNav === 'stations' && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 animate-fade-in-up">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-green-400" />
                  Station Links
                </h2>
                <p className="text-xs text-slate-400">Share with staff for multi-device check-in</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stations.map((station, index) => {
                  const Icon = stationIconMap[station.icon] || Package;
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
                      className="flex items-center justify-between p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-xl border border-slate-600/30 hover:border-slate-500/50 transition-all duration-300 hover:translate-x-1 group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <Icon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{station.name}</p>
                          {checkinList && (
                            <p className="text-xs text-slate-400">
                              {checkinList.checked_in}/{checkinList.total} checked in
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => copyStationUrl(station.id)}
                          className="p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Copy link"
                        >
                          {copiedStation === station.id ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400 hover:text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => setShowQRModal(station.id)}
                          className="p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Show QR code"
                        >
                          <QrCode className="w-4 h-4 text-slate-400 hover:text-white" />
                        </button>
                        <a
                          href={`/stations/${station.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400 hover:text-white" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings View - Placeholder for future */}
          {activeNav === 'settings' && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 animate-fade-in-up">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Settings
              </h2>
              <p className="text-slate-400">Settings and configuration coming soon...</p>
            </div>
          )}
        </div>
      </main>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowQRModal(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Scan to Open</h3>
              <button onClick={() => setShowQRModal(null)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-xl">
                <QRCode value={`${baseUrl}/stations/${showQRModal}`} size={200} />
              </div>
            </div>
            <p className="text-center text-slate-300 text-sm mb-4">
              {stations.find(s => s.id === showQRModal)?.name}
            </p>
            <button
              onClick={() => copyStationUrl(showQRModal)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-300 hover:scale-[1.02]"
            >
              {copiedStation === showQRModal ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedStation === showQRModal ? 'Copied!' : 'Copy Link'}
            </button>
            <p className="text-center text-slate-500 text-xs mt-4 break-all">
              {baseUrl}/stations/{showQRModal}
            </p>
          </div>
        </div>
      )}

      {/* Graduate Detail Modal */}
      {selectedGraduate && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-end z-50 p-4 animate-fade-in"
          onClick={closeGraduateDetail}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-5 flex items-start justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Dr. {selectedGraduate.name}</h2>
                  <p className="text-slate-400 text-sm">{selectedGraduate.course}</p>
                </div>
              </div>
              <button
                onClick={closeGraduateDetail}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Graduate Info */}
              <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Graduate Info
                </h3>
                <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                  {selectedGraduate.convocationNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Conv. No.</span>
                      <span className="font-mono font-bold text-blue-400">{selectedGraduate.convocationNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Course</span>
                    <span className="text-white">{selectedGraduate.course}</span>
                  </div>
                  {selectedGraduate.email && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        Email
                      </span>
                      <span className="text-white text-sm">{selectedGraduate.email}</span>
                    </div>
                  )}
                  {selectedGraduate.phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        Phone
                      </span>
                      <span className="text-white">{selectedGraduate.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Shipping Address
                </h3>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  {addressLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    </div>
                  ) : graduateAddress && graduateAddress.line1 ? (
                    <div className="space-y-1 text-slate-300">
                      <p>{graduateAddress.line1}</p>
                      {graduateAddress.line2 && <p>{graduateAddress.line2}</p>}
                      <p>{graduateAddress.city}, {graduateAddress.state}</p>
                      <p className="font-bold text-white">{graduateAddress.pincode}</p>
                      <p>{graduateAddress.country}</p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-2">Address not available</p>
                  )}
                </div>
              </div>

              {/* Current Status */}
              <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                {(() => {
                  const status = getGraduateCurrentStatus(selectedGraduate);
                  const StatusIcon = status.icon;
                  const colorClasses: Record<string, string> = {
                    green: 'border-green-500/30 bg-green-500/10 text-green-400',
                    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
                    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
                    yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
                    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
                    orange: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
                    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
                    purple: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
                    gray: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
                  };
                  return (
                    <div className={`p-4 rounded-xl border ${colorClasses[status.color] || colorClasses.gray}`}>
                      <div className="flex items-center gap-3">
                        <StatusIcon className="w-6 h-6" />
                        <div>
                          <p className="text-slate-400 text-xs uppercase">Current Status</p>
                          <p className="font-semibold">{status.text}</p>
                        </div>
                      </div>
                      {selectedGraduate.status.finalDispatched && selectedGraduate.trackingNumber && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-slate-400 text-sm">
                            {selectedGraduate.dispatchMethod}: <span className="font-mono text-white">{selectedGraduate.trackingNumber}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Certificate Journey Timeline */}
              <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Certificate Journey
                </h3>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-600" />
                    <div className="space-y-4">
                      {stations.map((station, index) => {
                        const Icon = stationIconMap[station.icon] || Package;
                        const isCompleted = isStationCompleted(selectedGraduate, station.id);
                        const scanTime = getScanTime(selectedGraduate, station.id);

                        return (
                          <div key={station.id} className="relative flex items-start gap-3 pl-1 group">
                            <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                              isCompleted ? 'bg-green-500 group-hover:scale-110' : 'bg-slate-600'
                            }`}>
                              {isCompleted ? (
                                <CheckCircle className="w-4 h-4 text-white" />
                              ) : (
                                <span className="text-xs text-slate-400">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 transition-colors ${isCompleted ? 'text-green-400' : 'text-slate-500'}`} />
                                <span className={`text-sm font-medium transition-colors ${isCompleted ? 'text-white' : 'text-slate-500'}`}>
                                  {station.name}
                                </span>
                              </div>
                              {scanTime ? (
                                <p className="text-xs text-green-400 mt-0.5 ml-6">{scanTime}</p>
                              ) : (
                                <p className="text-xs text-slate-600 mt-0.5 ml-6">Pending</p>
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
              <div className="grid grid-cols-2 gap-3 pt-2 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
                {selectedGraduate.convocationNumber && (
                  <a
                    href={`/api/badge/${selectedGraduate.convocationNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl transition-all duration-300 text-sm font-medium hover:scale-[1.02]"
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
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl transition-all duration-300 text-sm font-medium hover:scale-[1.02]"
                  >
                    <MapPin className="w-4 h-4" />
                    Print Label
                  </a>
                )}
                {selectedGraduate.email && (
                  <div className="relative col-span-2">
                    <button
                      onClick={() => setShowEmailModal(!showEmailModal)}
                      disabled={emailSending}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl transition-all duration-300 text-sm font-medium hover:scale-[1.02]"
                    >
                      {emailSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      {emailSending ? 'Sending...' : 'Send Email'}
                    </button>
                    {showEmailModal && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-700 border border-slate-600 rounded-xl shadow-xl overflow-hidden z-20 animate-fade-in-up">
                        <div className="p-2 border-b border-slate-600">
                          <p className="text-xs text-slate-400 px-2">Select Email Template</p>
                        </div>
                        <button
                          onClick={() => sendEmailToGraduate('CERTIFICATE_READY_ATTENDING')}
                          className="w-full p-3 text-left hover:bg-slate-600/50 transition-colors border-b border-slate-600"
                        >
                          <p className="text-sm font-medium text-white">Certificate Ready (Attending)</p>
                          <p className="text-xs text-slate-400">For graduates attending convocation</p>
                        </button>
                        <button
                          onClick={() => sendEmailToGraduate('CERTIFICATE_READY_NOT_ATTENDING')}
                          className="w-full p-3 text-left hover:bg-slate-600/50 transition-colors border-b border-slate-600"
                        >
                          <p className="text-sm font-medium text-white">Certificate Ready (Not Attending)</p>
                          <p className="text-xs text-slate-400">For graduates receiving by courier</p>
                        </button>
                        <button
                          onClick={() => sendEmailToGraduate('DISPATCHED_COURIER')}
                          className="w-full p-3 text-left hover:bg-slate-600/50 transition-colors"
                        >
                          <p className="text-sm font-medium text-white">Dispatched via Courier</p>
                          <p className="text-xs text-slate-400">With tracking information</p>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Email Result Feedback */}
              {emailResult && (
                <div className={`p-3 rounded-xl text-sm animate-fade-in ${
                  emailResult.success
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
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

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slide-in-right {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes bounce-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }

        .animate-bounce-soft {
          animation: bounce-soft 2s ease-in-out infinite;
        }

        .animate-pulse-soft {
          animation: pulse-soft 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
