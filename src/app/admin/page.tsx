'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import StatusBadge from '@/components/StatusBadge';
import CircularProgress from '@/components/CircularProgress';
import { DashboardStats, Graduate, Address } from '@/types';
import { stations } from '@/lib/stations';
import { ArrowRight, CheckCircle2, Clock, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, LayoutDashboard, Users as UsersIcon, BarChart3, Settings, Bell, Menu, GraduationCap, List, ArrowUpDown, Sun, Moon } from 'lucide-react';
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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
  { id: 'graduates', label: 'Graduates', icon: UsersIcon, shortcut: 'G' },
  { id: 'stations', label: 'Stations', icon: BarChart3, shortcut: 'S' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: null },
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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Escape to blur input
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // "/" to focus search
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (activeNav !== 'graduates') {
          setActiveNav('graduates');
        }
      }

      // "d" for dashboard
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        setActiveNav('dashboard');
      }

      // "g" for graduates
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        setActiveNav('graduates');
      }

      // "s" for stations
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        setActiveNav('stations');
      }

      // "r" to refresh
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        fetchData();
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setSelectedGraduate(null);
        setShowQRModal(null);
        setShowEmailModal(false);
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeNav]);

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

  // Theme-aware class helper
  const themeClasses = {
    bg: theme === 'dark' ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gray-100',
    sidebar: theme === 'dark' ? 'bg-slate-900/95 border-slate-700/50' : 'bg-white border-gray-200',
    header: theme === 'dark' ? 'bg-slate-900/80 border-slate-700/50' : 'bg-white/80 border-gray-200',
    card: theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm',
    cardInner: theme === 'dark' ? 'bg-slate-700/30' : 'bg-gray-50',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-slate-400' : 'text-gray-500',
    textSubtle: theme === 'dark' ? 'text-slate-500' : 'text-gray-400',
    navItem: theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    navActive: theme === 'dark' ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white' : 'bg-blue-50 text-blue-600',
    input: theme === 'dark' ? 'bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400',
    tableHeader: theme === 'dark' ? 'border-slate-700/50 text-slate-400' : 'border-gray-200 text-gray-500',
    tableRow: theme === 'dark' ? 'border-slate-700/30 hover:bg-slate-700/30' : 'border-gray-100 hover:bg-gray-50',
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} flex transition-colors duration-300`}>
      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-40 h-screen backdrop-blur-xl border-r transition-all duration-300 ease-in-out flex flex-col ${themeClasses.sidebar} ${
          sidebarCollapsed ? 'w-20' : 'w-72'
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
        <nav className="p-3 space-y-1.5">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
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
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-purple-500 rounded-r-full" />
                )}

                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${isActive ? 'text-blue-400' : 'group-hover:scale-110'}`} />
                  {!sidebarCollapsed && (
                    <span className="relative z-10 font-medium text-sm">{item.label}</span>
                  )}
                </div>
                {!sidebarCollapsed && item.shortcut && (
                  <span className="kbd relative z-10">{item.shortcut}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Certificate Pipeline in Sidebar */}
        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-cyan-400" />
                Pipeline
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: 'Packed', value: stats?.packed || 0, color: 'gray', icon: Package },
                  { label: 'At Venue', value: stats?.dispatchedToVenue || 0, color: 'purple', icon: Truck },
                  { label: 'Registered', value: stats?.registered || 0, color: 'cyan', icon: UserCheck },
                  { label: 'Gown Issued', value: stats?.gownIssued || 0, color: 'orange', icon: Shirt },
                  { label: 'Gown Return', value: stats?.gownReturned || 0, color: 'amber', icon: Undo2 },
                  { label: 'Collected', value: stats?.certificateCollected || 0, color: 'green', icon: Award },
                ].map((step) => {
                  const percentage = stats?.totalGraduates ? Math.round((step.value / stats.totalGraduates) * 100) : 0;
                  const Icon = step.icon;
                  return (
                    <div key={step.label} className={`flex items-center justify-between p-2 rounded-lg bg-slate-700/20 hover:bg-slate-700/40 transition-all duration-200 group card-side-accent accent-${step.color}`}>
                      <div className="flex items-center gap-2 relative z-10">
                        <div className={`w-6 h-6 rounded-md bg-${step.color}-500/20 flex items-center justify-center`}>
                          <Icon className={`w-3 h-3 text-${step.color}-400`} />
                        </div>
                        <div>
                          <p className="text-[11px] text-white font-medium leading-tight">{step.label}</p>
                          <p className="text-[9px] text-slate-500">{percentage}%</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold text-${step.color}-400 relative z-10`}>{step.value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Post-event section */}
              <div className="mt-3 pt-3 border-t border-slate-600/30">
                <p className="text-[10px] text-slate-500 font-medium mb-2">Post-Event</p>
                <div className="space-y-1">
                  {[
                    { label: 'At HO', value: stats?.returnedToHO || 0, color: 'yellow', icon: Building2 },
                    { label: 'Labeled', value: 0, color: 'blue', icon: MapPin },
                    { label: 'Dispatched', value: stats?.finalDispatched || 0, color: 'indigo', icon: Send },
                  ].map((step) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.label} className={`flex items-center justify-between p-1.5 rounded-md bg-slate-700/20 hover:bg-slate-700/40 transition-all duration-200 group card-side-accent accent-${step.color}`}>
                        <div className="flex items-center gap-2 relative z-10">
                          <div className={`w-5 h-5 rounded bg-${step.color}-500/20 flex items-center justify-center`}>
                            <Icon className={`w-2.5 h-2.5 text-${step.color}-400`} />
                          </div>
                          <p className="text-[10px] text-slate-300">{step.label}</p>
                        </div>
                        <span className={`text-xs font-bold text-${step.color}-400 relative z-10`}>{step.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Total Progress Mini Card */}
            <div className="mt-3 p-3 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 mb-0.5">Completed</p>
                  <p className="text-xl font-bold text-white">
                    {stats ? Math.round(((stats.certificateCollected + stats.finalDispatched) / stats.totalGraduates) * 100) : 0}%
                  </p>
                </div>
                <div className="w-12 h-12">
                  <CircularProgress
                    value={(stats?.certificateCollected || 0) + (stats?.finalDispatched || 0)}
                    max={stats?.totalGraduates || 1}
                    size={48}
                    strokeWidth={5}
                    color="#3b82f6"
                    bgColor="rgba(255,255,255,0.1)"
                    showPercentage={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden transition-all duration-300 ${
          mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      >
        {/* Tap to close hint */}
        <div className={`absolute top-4 right-4 flex items-center gap-2 text-white/60 text-sm transition-all duration-300 ${
          mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}>
          <span>Tap to close</span>
          <X className="w-4 h-4" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className={`sticky top-0 z-20 h-16 backdrop-blur-xl border-b flex items-center justify-between px-4 lg:px-8 transition-colors duration-300 ${themeClasses.header}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className={`text-xl font-bold capitalize ${themeClasses.text}`}>{activeNav}</h1>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                {lastRefresh && `Last sync: ${lastRefresh.toLocaleTimeString()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                theme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
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
              className={`p-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 group ${
                theme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Export CSV"
            >
              <Download className={`w-5 h-5 transition-colors ${
                theme === 'dark' ? 'text-slate-400 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-800'
              }`} />
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
        <div className="p-4 sm:p-6 lg:p-8 pb-8 sm:pb-12 lg:pb-16 space-y-4 sm:space-y-5 lg:space-y-6 mesh-gradient min-h-[calc(100vh-4rem)]">
          {/* Conditionally render based on activeNav */}
          {activeNav === 'dashboard' && (
            <>
          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {loading ? (
              // Skeleton loading state
              [...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="skeleton-card p-4 sm:p-5 lg:p-6"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="skeleton w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl" />
                  </div>
                  <div className="skeleton skeleton-text w-24 mb-2" />
                  <div className="skeleton skeleton-text w-16 h-8" />
                </div>
              ))
            ) : (
              [{
                label: 'Total Graduates',
                value: stats?.totalGraduates || 0,
                icon: Users,
                gradient: 'from-blue-500 to-blue-600',
                shadow: 'shadow-blue-500/20',
                glow: 'glow-blue',
                tooltip: 'Total number of graduates registered for convocation'
              }, {
                label: 'Collected',
                value: stats?.certificateCollected || 0,
                icon: Award,
                gradient: 'from-green-500 to-green-600',
                shadow: 'shadow-green-500/20',
                glow: 'glow-green',
                tooltip: 'Certificates collected in person at the venue'
              }, {
                label: 'Dispatched',
                value: stats?.finalDispatched || 0,
                icon: Send,
                gradient: 'from-purple-500 to-purple-600',
                shadow: 'shadow-purple-500/20',
                glow: 'glow-purple',
                tooltip: 'Certificates dispatched via courier (DTDC/India Post)'
              }, {
                label: 'Pending',
                value: (stats?.totalGraduates || 0) - (stats?.certificateCollected || 0) - (stats?.finalDispatched || 0),
                icon: Clock,
                gradient: 'from-amber-500 to-amber-600',
                shadow: 'shadow-amber-500/20',
                glow: 'glow-amber',
                tooltip: 'Certificates not yet collected or dispatched'
              }].map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`relative group overflow-hidden bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 transition-all duration-500 cursor-pointer animate-fade-in-up card-3d card-shine ${stat.glow}`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    data-tooltip={stat.tooltip}
                    data-tooltip-pos="bottom"
                  >
                    {/* Gradient background on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

                    {/* Floating decorative circle */}
                    <div className={`absolute -top-4 -right-4 w-16 sm:w-20 lg:w-24 h-16 sm:h-20 lg:h-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 group-hover:opacity-20 transition-all duration-500 group-hover:scale-125`} />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3 sm:mb-4">
                        <div className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.shadow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                          <Icon className="w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                        </div>
                      </div>
                      <p className="text-slate-300 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{stat.label}</p>
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white group-hover:scale-105 transition-transform duration-300 origin-left">{stat.value}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Progress Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {/* Circular Progress Card */}
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                Overall Progress
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
              <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                Quick Stats
              </h2>
              <div className="space-y-2 sm:space-y-3">
                {[
                  { label: 'Total Graduates', value: stats?.totalGraduates || 0, icon: Users, color: 'blue', indicatorColor: '#3b82f6' },
                  { label: 'Completed', value: (stats?.certificateCollected || 0) + (stats?.finalDispatched || 0), icon: CheckCircle2, color: 'green', indicatorColor: '#22c55e' },
                  { label: 'Pending', value: (stats?.totalGraduates || 0) - (stats?.certificateCollected || 0) - (stats?.finalDispatched || 0), icon: Clock, color: 'amber', indicatorColor: '#f59e0b' },
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-300 cursor-pointer group slide-indicator"
                      style={{ animationDelay: `${350 + index * 50}ms`, '--indicator-color': item.indicatorColor } as React.CSSProperties}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 text-${item.color}-400 group-hover:scale-110 transition-transform duration-300`} />
                        <span className="text-slate-300 text-xs sm:text-sm">{item.label}</span>
                      </div>
                      <span className={`text-base sm:text-lg font-bold text-${item.color}-400`}>{item.value}</span>
                    </div>
                  );
                })}

                {(stats?.pendingGownDeposit || 0) > 0 && (
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all duration-300 hover:translate-x-1 cursor-pointer group animate-pulse-soft">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Shirt className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-amber-300 text-xs sm:text-sm">Gown Returns</span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-amber-400">{stats?.pendingGownDeposit || 0}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {(stats?.pendingGownDeposit || 0) > 0 && (
            <div className="p-3 sm:p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg sm:rounded-xl animate-fade-in-up animate-attention-pulse flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:animate-none transition-all duration-300 cursor-pointer group">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-300 shrink-0">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-300 text-sm sm:text-base">Pending Gown Returns</p>
                  <p className="text-xs sm:text-sm text-amber-400/80 line-clamp-2 sm:line-clamp-none">
                    {stats?.pendingGownDeposit} graduates have pending gown returns (₹{(stats?.pendingGownDeposit || 0) * 500} refundable deposits)
                  </p>
                </div>
              </div>
              <button className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-xs sm:text-sm transition-all duration-300 hover:scale-105 active:scale-95 btn-ripple shrink-0">
                View Details
              </button>
            </div>
          )}

          {/* Station Progress Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mt-6">
            {[
              { id: 'packing', name: 'Packing', icon: Package, gradient: 'from-slate-500 to-slate-600', color: '#64748b', accent: 'accent-slate' },
              { id: 'dispatch-venue', name: 'Dispatch to Venue', icon: Truck, gradient: 'from-purple-500 to-purple-600', color: '#a855f7', accent: 'accent-purple' },
              { id: 'registration', name: 'Registration', icon: UserCheck, gradient: 'from-cyan-500 to-cyan-600', color: '#06b6d4', accent: 'accent-cyan' },
              { id: 'gown-issue', name: 'Gown Issue', icon: Shirt, gradient: 'from-orange-500 to-orange-600', color: '#f97316', accent: 'accent-orange' },
              { id: 'gown-return', name: 'Gown Return', icon: Undo2, gradient: 'from-amber-500 to-amber-600', color: '#f59e0b', accent: 'accent-amber' },
              { id: 'certificate-collection', name: 'Certificate Collection', icon: Award, gradient: 'from-green-500 to-green-600', color: '#22c55e', accent: 'accent-green' },
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
                  <div className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-slate-700/50 transition-all duration-500 hover:scale-[1.02] cursor-pointer card-side-accent h-full ${station.accent}`}>
                    {/* Side accent bar (handled by CSS) */}

                    {/* Header with icon and stats */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4 relative z-10">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${station.gradient} shadow-lg flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-xs font-medium">{station.name}</p>
                        <p className="text-2xl sm:text-3xl font-bold text-white group-hover:scale-105 transition-transform duration-300 origin-right">{count}</p>
                      </div>
                    </div>

                    {/* Hover glow background */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${station.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                    {/* Progress */}
                    <div className="space-y-1.5 sm:space-y-2 relative z-10">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-semibold" style={{ color: station.color }}>{percentage}%</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${station.gradient} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-[10px] sm:text-xs text-slate-500 text-right">{count} of {total}</p>
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
          <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
            {/* View Toggle Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setGraduatesView('all')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 ${
                  graduatesView === 'all'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                All Graduates
              </button>
              <button
                onClick={() => setGraduatesView('by-course')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium text-xs sm:text-sm transition-all duration-300 ${
                  graduatesView === 'by-course'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                By Course
              </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 hover:border-slate-600 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                {graduatesView === 'all' ? 'All Graduates' : 'Graduates by Course'}
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, conv. no, email..."
                    className="pl-8 sm:pl-10 pr-12 sm:pr-14 py-1.5 sm:py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 w-full sm:w-72 lg:w-80"
                  />
                  {!searchQuery && (
                    <span className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 kbd hidden sm:inline-flex">/</span>
                  )}
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg sm:rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 cursor-pointer"
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
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  Station Links
                </h2>
                <p className="text-[10px] sm:text-xs text-slate-400">Share with staff for multi-device check-in</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
                      className="flex items-center justify-between p-3 sm:p-4 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg sm:rounded-xl border border-slate-600/30 hover:border-slate-500/50 transition-all duration-300 hover:translate-x-1 group"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium text-white truncate">{station.name}</p>
                          {checkinList && (
                            <p className="text-[10px] sm:text-xs text-slate-400">
                              {checkinList.checked_in}/{checkinList.total} checked in
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                        <button
                          onClick={() => copyStationUrl(station.id)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Copy link"
                        >
                          {copiedStation === station.id ? (
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hover:text-white" />
                          )}
                        </button>
                        <button
                          onClick={() => setShowQRModal(station.id)}
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Show QR code"
                        >
                          <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hover:text-white" />
                        </button>
                        <a
                          href={`/stations/${station.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-600/50 transition-all duration-200 hover:scale-110"
                          title="Open in new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hover:text-white" />
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
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 border border-slate-700/50 animate-fade-in-up">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                Settings
              </h2>
              <p className="text-sm sm:text-base text-slate-400">Settings and configuration coming soon...</p>
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
        /* Base Animations */
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
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

        /* Floating Animation for Icons */
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* Pulse Glow Effect */
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(59, 130, 246, 0);
          }
        }

        @keyframes pulse-glow-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(34, 197, 94, 0); }
        }

        @keyframes pulse-glow-purple {
          0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(168, 85, 247, 0); }
        }

        @keyframes pulse-glow-amber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 20px 10px rgba(245, 158, 11, 0); }
        }

        /* Attention Pulse for Alerts */
        @keyframes attention-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
          }
        }

        /* Shine Effect */
        @keyframes shine {
          from { left: -100%; }
          to { left: 100%; }
        }

        /* Draw Circle Animation */
        @keyframes draw-circle {
          from { stroke-dashoffset: 264; }
          to { stroke-dashoffset: var(--progress-offset, 0); }
        }

        /* Fill Progress Bar */
        @keyframes fill-progress {
          from { width: 0; }
          to { width: var(--target-width, 0%); }
        }

        /* Gradient Border Rotation */
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Ripple Effect */
        @keyframes ripple {
          0% {
            width: 0;
            height: 0;
            opacity: 0.5;
          }
          100% {
            width: 300px;
            height: 300px;
            opacity: 0;
          }
        }

        /* Base Animation Classes */
        .animate-fade-in {
          animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-attention-pulse {
          animation: attention-pulse 2s ease-in-out infinite;
        }

        /* 3D Card Effect */
        .card-3d {
          transform-style: preserve-3d;
          perspective: 1000px;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .card-3d:hover {
          transform: translateY(-8px) rotateX(5deg) rotateY(-5deg);
        }

        /* Shine Effect on Cards */
        .card-shine {
          position: relative;
          overflow: hidden;
        }

        .card-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.15),
            transparent
          );
          transition: left 0.5s ease;
          pointer-events: none;
        }

        .card-shine:hover::after {
          left: 100%;
        }

        /* Station Card Glow Effects */
        .glow-blue:hover {
          box-shadow: 0 10px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2);
        }

        .glow-purple:hover {
          box-shadow: 0 10px 40px rgba(168, 85, 247, 0.3), 0 0 0 1px rgba(168, 85, 247, 0.2);
        }

        .glow-cyan:hover {
          box-shadow: 0 10px 40px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2);
        }

        .glow-orange:hover {
          box-shadow: 0 10px 40px rgba(249, 115, 22, 0.3), 0 0 0 1px rgba(249, 115, 22, 0.2);
        }

        .glow-amber:hover {
          box-shadow: 0 10px 40px rgba(245, 158, 11, 0.3), 0 0 0 1px rgba(245, 158, 11, 0.2);
        }

        .glow-green:hover {
          box-shadow: 0 10px 40px rgba(34, 197, 94, 0.3), 0 0 0 1px rgba(34, 197, 94, 0.2);
        }

        /* Slide Indicator Effect */
        .slide-indicator {
          position: relative;
          overflow: hidden;
        }

        .slide-indicator::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: var(--indicator-color, #3b82f6);
          transform: scaleY(0);
          transition: transform 0.3s ease;
          border-radius: 0 4px 4px 0;
        }

        .slide-indicator:hover::before {
          transform: scaleY(1);
        }

        .slide-indicator:hover {
          transform: translateX(8px);
        }

        /* Gradient Border Animation */
        .gradient-border-animated {
          position: relative;
        }

        .gradient-border-animated::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(
            45deg,
            #3b82f6,
            #8b5cf6,
            #ec4899,
            #3b82f6
          );
          background-size: 300% 300%;
          animation: gradient-rotate 4s linear infinite;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .gradient-border-animated:hover::before {
          opacity: 1;
        }

        /* Button Ripple Effect */
        .btn-ripple {
          position: relative;
          overflow: hidden;
        }

        .btn-ripple .ripple {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.4);
          transform: translate(-50%, -50%) scale(0);
          animation: ripple 0.6s ease-out;
          pointer-events: none;
        }

        /* Icon Bounce on Hover */
        .icon-bounce:hover {
          animation: bounce-soft 0.5s ease;
        }

        /* Progress Circle Draw */
        .progress-draw {
          stroke-dasharray: 264;
          stroke-dashoffset: 264;
          animation: draw-circle 1.5s ease-out forwards;
        }

        /* Number Counter Smooth */
        .counter-animate {
          transition: all 0.3s ease;
        }

        /* Tooltip Styles */
        .tooltip-hover {
          position: relative;
        }

        .tooltip-hover::before {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-8px);
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 100;
          color: white;
        }

        .tooltip-hover:hover::before {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }

        /* Mesh Gradient Background */
        .mesh-gradient {
          background:
            radial-gradient(at 40% 20%, rgba(59, 130, 246, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(168, 85, 247, 0.06) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(6, 182, 212, 0.06) 0px, transparent 50%),
            radial-gradient(at 80% 50%, rgba(236, 72, 153, 0.05) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(34, 197, 94, 0.06) 0px, transparent 50%);
        }

        /* Skeleton Loading */
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05) 25%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0.05) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
