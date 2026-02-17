'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Radio,
  LayoutDashboard,
  Tag,
  Box,
  CheckCircle,
  XCircle,
  Package,
  Truck,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ScanLine,
  Pencil,
  AlertTriangle,
  Send,
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';

interface DashboardStats {
  totalTags: number;
  graduateTags: number;
  boxTags: number;
  encoded: number;
  scanned: number;
  dispatched: number;
  delivered: number;
  returned: number;
  void: number;
  stationBreakdown: Record<string, number>;
  recentScans: Array<{
    station: string;
    timestamp: string;
    scannedBy: string;
    action: string;
    epc?: string;
    notes?: string;
  }>;
  boxSummary: {
    totalBoxes: number;
    itemsInBoxes: number;
  };
}

interface VerifyResult {
  found: boolean;
  tag?: {
    epc: string;
    type: string;
    convocationNumber?: string;
    boxId?: string;
    graduateName?: string;
    status: string;
    currentStation: string;
    encodedAt: string;
    encodedBy: string;
    lastScanAt?: string;
    lastScanBy?: string;
    scanHistory: Array<{
      station: string;
      timestamp: string;
      scannedBy: string;
      action: string;
    }>;
    boxContents?: string[];
    boxLabel?: string;
  };
  boxItems?: Array<{
    epc: string;
    type: string;
    graduateName?: string;
    status: string;
  }>;
}

// Dispatch dialog state
interface DispatchDialogState {
  open: boolean;
  mode: 'dispatch' | 'handover';
}

const STATION_LABELS: Record<string, string> = {
  encoding: 'Encoding',
  packing: 'Packing',
  'dispatch-venue': 'Dispatch to Venue',
  registration: 'Registration',
  'gown-issue': 'Gown Issue',
  'gown-return': 'Gown Return',
  'certificate-collection': 'Certificate Collection',
  'return-ho': 'Return to HO',
  'address-label': 'Address Label',
  'final-dispatch': 'Final Dispatch',
  handover: 'Handover',
};

const STATUS_COLORS: Record<string, string> = {
  encoded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scanned: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  dispatched: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  returned: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  void: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function RfidDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify section
  const [verifyEpc, setVerifyEpc] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Dispatch/Handover dialog
  const [dispatchDialog, setDispatchDialog] = useState<DispatchDialogState>({
    open: false,
    mode: 'dispatch',
  });
  const [dispatchEpcs, setDispatchEpcs] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState<string>('DTDC');
  const [handoverTo, setHandoverTo] = useState('');
  const [operatorName, setOperatorName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_operator') || '';
    }
    return '';
  });
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    successful: number;
    failed: number;
  } | null>(null);
  const [showConfirmDispatch, setShowConfirmDispatch] = useState(false);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = isRefresh ? '/api/rfid/dashboard' : '/api/rfid/dashboard';
      const options: RequestInit = isRefresh
        ? { method: 'POST' }
        : { method: 'GET' };

      const response = await fetch(url, options);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch dashboard data');
        return;
      }

      setStats(data.data);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Verify tag
  const handleVerify = async () => {
    if (!verifyEpc.trim()) return;
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);

    try {
      const response = await fetch(
        `/api/rfid/verify?epc=${encodeURIComponent(verifyEpc.toUpperCase().trim())}`
      );
      const data = await response.json();

      if (!data.success) {
        setVerifyError(data.error || 'Verification failed');
        return;
      }

      setVerifyResult({
        found: data.found,
        tag: data.data?.tag,
        boxItems: data.data?.boxItems,
      });
    } catch (err) {
      setVerifyError(
        `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setVerifying(false);
    }
  };

  // Dispatch/Handover
  const handleDispatchOrHandover = async () => {
    setShowConfirmDispatch(false);
    setDispatchLoading(true);
    setDispatchResult(null);

    localStorage.setItem('rfid_operator', operatorName);

    const epcs = dispatchEpcs
      .split(/[\n,]+/)
      .map(e => e.trim().toUpperCase())
      .filter(Boolean);

    if (epcs.length === 0) return;

    try {
      const url =
        dispatchDialog.mode === 'dispatch'
          ? '/api/rfid/dispatch'
          : '/api/rfid/handover';

      const body =
        dispatchDialog.mode === 'dispatch'
          ? {
              epcs,
              trackingNumber: trackingNumber.trim() || undefined,
              dispatchMethod,
              dispatchedBy: operatorName.trim(),
              notes: dispatchNotes.trim() || undefined,
            }
          : {
              epcs,
              handoverTo: handoverTo.trim(),
              handoverBy: operatorName.trim(),
              notes: dispatchNotes.trim() || undefined,
            };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Operation failed');
        return;
      }

      setDispatchResult({
        successful: data.data.successful,
        failed: data.data.failed,
      });

      // Refresh stats after dispatch
      fetchStats(true);
    } catch (err) {
      setError(
        `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setDispatchLoading(false);
    }
  };

  const prepareDispatch = (mode: 'dispatch' | 'handover') => {
    setDispatchDialog({ open: true, mode });
    setDispatchResult(null);
    setDispatchEpcs('');
    setTrackingNumber('');
    setHandoverTo('');
    setDispatchNotes('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1222] text-[#f1f5f9] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-slate-400">Loading RFID Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1222] text-[#f1f5f9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/stations"
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <LayoutDashboard className="w-7 h-7 text-cyan-400" />
                RFID Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Real-time UHF RFID tracking overview
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/staff/rfid/guide"
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <HelpCircle className="w-4 h-4" />
              Guide
            </Link>
            <Link
              href="/staff/rfid/encode"
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <Pencil className="w-4 h-4" />
              Encode
            </Link>
            <Link
              href="/staff/rfid/scan"
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <ScanLine className="w-4 h-4" />
              Scanner
            </Link>
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {stats && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
              <StatCard label="Total Tags" value={stats.totalTags} icon={<Radio className="w-5 h-5" />} color="text-slate-300" />
              <StatCard label="Graduate" value={stats.graduateTags} icon={<Tag className="w-5 h-5" />} color="text-blue-400" />
              <StatCard label="Boxes" value={stats.boxTags} icon={<Box className="w-5 h-5" />} color="text-amber-400" />
              <StatCard label="Encoded" value={stats.encoded} icon={<Pencil className="w-5 h-5" />} color="text-cyan-400" />
              <StatCard label="Dispatched" value={stats.dispatched} icon={<Truck className="w-5 h-5" />} color="text-purple-400" />
              <StatCard label="Delivered" value={stats.delivered} icon={<CheckCircle className="w-5 h-5" />} color="text-green-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Station Breakdown */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  Station Breakdown
                </h3>
                <div className="space-y-2">
                  {Object.entries(stats.stationBreakdown)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([station, count]) => (
                      <div
                        key={station}
                        className="flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg"
                      >
                        <span className="text-sm text-slate-300">
                          {STATION_LABELS[station] || station}
                        </span>
                        <span className="text-sm font-medium text-cyan-400">{count}</span>
                      </div>
                    ))}
                  {Object.values(stats.stationBreakdown).every(v => v === 0) && (
                    <p className="text-sm text-slate-500 text-center py-4">No station data yet</p>
                  )}
                </div>
              </div>

              {/* Box Summary */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Box className="w-5 h-5 text-amber-400" />
                  Box Summary
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-900/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-400">{stats.boxSummary.totalBoxes}</p>
                      <p className="text-xs text-slate-400">Total Boxes</p>
                    </div>
                    <div className="p-3 bg-slate-900/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-400">{stats.boxSummary.itemsInBoxes}</p>
                      <p className="text-xs text-slate-400">Items in Boxes</p>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => prepareDispatch('dispatch')}
                      className="w-full py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      Dispatch Tags
                    </button>
                    <button
                      onClick={() => prepareDispatch('handover')}
                      className="w-full py-2.5 px-4 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-sm text-green-300 transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Handover Tags
                    </button>
                  </div>
                </div>
              </div>

              {/* Verify Tag */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-green-400" />
                  Verify Tag
                </h3>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={verifyEpc}
                    onChange={e => setVerifyEpc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleVerify()}
                    placeholder="Enter EPC"
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-green-500 font-mono uppercase text-sm"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={verifying || !verifyEpc.trim()}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 rounded-lg transition-colors"
                  >
                    {verifying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {verifyError && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                    <p className="text-xs text-red-300">{verifyError}</p>
                  </div>
                )}

                {verifyResult && !verifyResult.found && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <p className="text-sm text-amber-300">Tag not found in system</p>
                    </div>
                  </div>
                )}

                {verifyResult && verifyResult.found && verifyResult.tag && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-900/30 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{verifyResult.tag.epc}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_COLORS[verifyResult.tag.status] || STATUS_COLORS.encoded
                          }`}
                        >
                          {verifyResult.tag.status}
                        </span>
                      </div>
                      {verifyResult.tag.graduateName && (
                        <p className="text-sm text-slate-300">{verifyResult.tag.graduateName}</p>
                      )}
                      {verifyResult.tag.convocationNumber && (
                        <p className="text-xs text-slate-500 font-mono">
                          Conv: {verifyResult.tag.convocationNumber}
                        </p>
                      )}
                      {verifyResult.tag.boxLabel && (
                        <p className="text-xs text-amber-400">{verifyResult.tag.boxLabel}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        Station: {STATION_LABELS[verifyResult.tag.currentStation] || verifyResult.tag.currentStation}
                      </p>
                      {verifyResult.tag.lastScanAt && (
                        <p className="text-xs text-slate-500">
                          Last scan: {new Date(verifyResult.tag.lastScanAt).toLocaleString()} by{' '}
                          {verifyResult.tag.lastScanBy}
                        </p>
                      )}
                    </div>

                    {/* Box contents */}
                    {verifyResult.boxItems && verifyResult.boxItems.length > 0 && (
                      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <p className="text-xs font-medium text-amber-400 mb-2">
                          Box Contents ({verifyResult.boxItems.length})
                        </p>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {verifyResult.boxItems.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-slate-400">{item.epc}</span>
                              <span className="text-slate-500">{item.graduateName || item.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scan history toggle */}
                    {verifyResult.tag.scanHistory.length > 0 && (
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg text-xs text-slate-400 hover:text-slate-300"
                      >
                        <span>Scan History ({verifyResult.tag.scanHistory.length})</span>
                        {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {showHistory && verifyResult.tag.scanHistory.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {[...verifyResult.tag.scanHistory].reverse().map((scan, i) => (
                          <div key={i} className="px-3 py-1.5 bg-slate-900/20 rounded text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">
                                {STATION_LABELS[scan.station] || scan.station}
                              </span>
                              <span className="text-slate-500">
                                {new Date(scan.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-500">{scan.action} - {scan.scannedBy}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-cyan-400" />
                Recent Scans
              </h3>
              {stats.recentScans.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No scans recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700/50">
                        <th className="text-left py-2 px-3 font-medium">EPC</th>
                        <th className="text-left py-2 px-3 font-medium">Station</th>
                        <th className="text-left py-2 px-3 font-medium">Action</th>
                        <th className="text-left py-2 px-3 font-medium">By</th>
                        <th className="text-left py-2 px-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentScans.slice(0, 20).map((scan, i) => (
                        <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                          <td className="py-2 px-3 font-mono text-xs">
                            {(scan as { epc?: string }).epc || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {STATION_LABELS[scan.station] || scan.station}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{scan.action}</td>
                          <td className="py-2 px-3 text-slate-400">{scan.scannedBy}</td>
                          <td className="py-2 px-3 text-slate-500 text-xs">
                            {new Date(scan.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dispatch/Handover Dialog */}
      {dispatchDialog.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {dispatchDialog.mode === 'dispatch' ? (
                <>
                  <Truck className="w-5 h-5 text-purple-400" />
                  Dispatch Tags
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-green-400" />
                  Handover Tags
                </>
              )}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  EPCs (one per line or comma-separated)
                </label>
                <textarea
                  value={dispatchEpcs}
                  onChange={e => setDispatchEpcs(e.target.value)}
                  rows={4}
                  placeholder="118AEC1001&#10;BOX-001&#10;118AEC1002"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {dispatchDialog.mode === 'dispatch' ? 'Dispatched By' : 'Handover By'}
                </label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {dispatchDialog.mode === 'dispatch' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Dispatch Method
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['DTDC', 'India Post', 'Hand Delivery'].map(method => (
                        <button
                          key={method}
                          onClick={() => setDispatchMethod(method)}
                          className={`py-2 px-3 rounded-lg text-sm border transition-all ${
                            dispatchMethod === method
                              ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                              : 'border-slate-600 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={e => setTrackingNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              {dispatchDialog.mode === 'handover' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Handover To
                  </label>
                  <input
                    type="text"
                    value={handoverTo}
                    onChange={e => setHandoverTo(e.target.value)}
                    placeholder="Recipient name"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  value={dispatchNotes}
                  onChange={e => setDispatchNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {dispatchResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    dispatchResult.failed > 0
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-green-500/10 border-green-500/30'
                  }`}
                >
                  <p className="text-sm">
                    <span className="text-green-400">{dispatchResult.successful} successful</span>
                    {dispatchResult.failed > 0 && (
                      <span className="text-red-400 ml-2">{dispatchResult.failed} failed</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDispatchDialog({ open: false, mode: 'dispatch' })}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const epcs = dispatchEpcs
                    .split(/[\n,]+/)
                    .map(e => e.trim())
                    .filter(Boolean);
                  if (epcs.length === 0 || !operatorName.trim()) {
                    setError('EPCs and operator name are required');
                    return;
                  }
                  if (dispatchDialog.mode === 'handover' && !handoverTo.trim()) {
                    setError('Handover recipient is required');
                    return;
                  }
                  setShowConfirmDispatch(true);
                }}
                disabled={dispatchLoading}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  dispatchDialog.mode === 'dispatch'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {dispatchLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : dispatchDialog.mode === 'dispatch' ? (
                  'Process Dispatch'
                ) : (
                  'Process Handover'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dispatch/Handover Dialog */}
      {showConfirmDispatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold">
                Confirm {dispatchDialog.mode === 'dispatch' ? 'Dispatch' : 'Handover'}
              </h3>
            </div>

            <div className="p-3 bg-slate-900/50 rounded-lg mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Tags:</span>
                <span>
                  {
                    dispatchEpcs
                      .split(/[\n,]+/)
                      .map(e => e.trim())
                      .filter(Boolean).length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">By:</span>
                <span>{operatorName}</span>
              </div>
              {dispatchDialog.mode === 'dispatch' && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span>{dispatchMethod}</span>
                </div>
              )}
              {dispatchDialog.mode === 'handover' && (
                <div className="flex justify-between">
                  <span className="text-slate-400">To:</span>
                  <span>{handoverTo}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-400 mb-6">
              This will update all listed tags and trigger Tito check-ins for graduate
              tags. Box EPCs will also process their contents.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDispatch(false)}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmDispatch(false);
                  handleDispatchOrHandover();
                }}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                  dispatchDialog.mode === 'dispatch'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
