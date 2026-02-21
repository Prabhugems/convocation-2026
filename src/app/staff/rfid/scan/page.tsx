'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Radio,
  ScanLine,
  Tag,
  Box,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Send,
  LayoutDashboard,
  Pencil,
  Package,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Play,
  Square,
} from 'lucide-react';

type RfidStation =
  | 'packing'
  | 'dispatch-venue'
  | 'registration'
  | 'gown-issue'
  | 'gown-return'
  | 'certificate-collection'
  | 'return-ho'
  | 'address-label'
  | 'final-dispatch'
  | 'handover';

interface ScanResult {
  epc: string;
  success: boolean;
  graduateName?: string;
  type?: string;
  error?: string;
  titoCheckin?: { success: boolean; error?: string };
}

const STATION_OPTIONS: { id: RfidStation; label: string; icon: string }[] = [
  { id: 'packing', label: 'Packing', icon: '📦' },
  { id: 'dispatch-venue', label: 'Dispatch to Venue', icon: '🚚' },
  { id: 'registration', label: 'Registration', icon: '📝' },
  { id: 'gown-issue', label: 'Gown Issue', icon: '👗' },
  { id: 'gown-return', label: 'Gown Return', icon: '🔄' },
  { id: 'certificate-collection', label: 'Certificate Collection', icon: '📜' },
  { id: 'return-ho', label: 'Return to HO', icon: '🏢' },
  { id: 'address-label', label: 'Address Label', icon: '🏷️' },
  { id: 'final-dispatch', label: 'Final Dispatch', icon: '✈️' },
  { id: 'handover', label: 'Handover', icon: '🤝' },
];

function getBridgeUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('rfid_bridge_url') || 'http://localhost:8080';
  }
  return 'http://localhost:8080';
}

export default function RfidScanPage() {
  const [bridgeUrl, setBridgeUrl] = useState(getBridgeUrl);
  const [showBridgeSettings, setShowBridgeSettings] = useState(false);
  const [bridgeInput, setBridgeInput] = useState('');
  const [station, setStation] = useState<RfidStation>('registration');
  const [scannedBy, setScannedBy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_scanned_by') || '';
    }
    return '';
  });
  const [epcInput, setEpcInput] = useState('');
  const [pendingEpcs, setPendingEpcs] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTagDetails, setPendingTagDetails] = useState<Record<string, { found: boolean; graduateName?: string; convocationNumber?: string; type?: string }>>({});
  const [showResultsExpanded, setShowResultsExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [readerStatus, setReaderStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check RFID reader bridge connection
  const checkReaderStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${bridgeUrl}/api/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setReaderStatus(data.connected ? 'connected' : 'disconnected');
      } else {
        setReaderStatus('disconnected');
      }
    } catch {
      setReaderStatus('disconnected');
    }
  }, [bridgeUrl]);

  // Poll reader status every 10s
  useEffect(() => {
    checkReaderStatus();
    const interval = setInterval(checkReaderStatus, 10000);
    return () => clearInterval(interval);
  }, [checkReaderStatus]);

  // Auto-lookup tag details when new EPCs are added to pending list
  useEffect(() => {
    const unknownEpcs = pendingEpcs.filter(epc => !(epc in pendingTagDetails));
    if (unknownEpcs.length === 0) return;
    const controller = new AbortController();
    fetch('/api/rfid/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ epcs: unknownEpcs }),
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPendingTagDetails(prev => {
            const updated = { ...prev };
            for (const r of data.data.results) {
              updated[r.epc] = {
                found: r.found,
                graduateName: r.tag?.graduateName,
                convocationNumber: r.tag?.convocationNumber,
                type: r.tag?.type,
              };
            }
            return updated;
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pendingEpcs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Start hardware scan
  const handleStartScan = async () => {
    if (!scannedBy.trim()) {
      setError('Please enter your name (Scanned By) before scanning');
      return;
    }
    try {
      const res = await fetch(`${bridgeUrl}/api/inventory/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start scan');
      setIsScanning(true);
      setScannedCount(0);
      setError(null);

      // Poll for new tags every 500ms
      pollIntervalRef.current = setInterval(async () => {
        try {
          const tagRes = await fetch(`${bridgeUrl}/api/inventory/tags`);
          if (!tagRes.ok) return;
          const { tags } = await tagRes.json() as { tags: { epc: string; rssi: number }[] };
          if (tags && tags.length > 0) {
            tags.forEach(({ epc }) => {
              const normalized = epc.toUpperCase().trim();
              if (!normalized) return;
              setPendingEpcs(prev => {
                if (prev.includes(normalized)) return prev;
                return [...prev, normalized];
              });
              setScannedCount(prev => prev + 1);
            });
          }
        } catch {
          // ignore polling errors
        }
      }, 500);
    } catch {
      setError('Failed to start hardware scan');
      setIsScanning(false);
    }
  };

  // Stop hardware scan
  const handleStopScan = async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsScanning(false);
    try {
      await fetch(`${bridgeUrl}/api/inventory/stop`, { method: 'POST' });
    } catch {
      // reader may already be stopped
    }
  };

  // Add EPC to pending list
  const addEpc = useCallback(() => {
    const normalized = epcInput.toUpperCase().trim();
    if (!normalized) return;
    if (pendingEpcs.includes(normalized)) {
      setError(`${normalized} is already in the list`);
      return;
    }
    setPendingEpcs(prev => [...prev, normalized]);
    setEpcInput('');
    setError(null);
    inputRef.current?.focus();
  }, [epcInput, pendingEpcs]);

  const removeEpc = (index: number) => {
    setPendingEpcs(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setPendingEpcs([]);
    setScanResults([]);
    setError(null);
  };

  // Prepare bulk scan (show confirmation with tag lookups)
  const handlePrepareScan = async () => {
    if (pendingEpcs.length === 0) {
      setError('Add at least one EPC to scan');
      return;
    }
    if (!scannedBy.trim()) {
      setError('Please enter your name (Scanned By)');
      return;
    }
    // Look up tag details for all pending EPCs
    setPendingTagDetails({});
    setShowConfirmDialog(true);
    try {
      const res = await fetch('/api/rfid/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epcs: pendingEpcs }),
      });
      const data = await res.json();
      if (data.success) {
        const details: Record<string, { found: boolean; graduateName?: string; convocationNumber?: string; type?: string }> = {};
        for (const r of data.data.results) {
          details[r.epc] = {
            found: r.found,
            graduateName: r.tag?.graduateName,
            convocationNumber: r.tag?.convocationNumber,
            type: r.tag?.type,
          };
        }
        setPendingTagDetails(details);
      }
    } catch {
      // Show dialog anyway without details
    }
  };

  // Execute bulk scan
  const handleConfirmScan = async () => {
    setShowConfirmDialog(false);
    setLoading(true);
    setError(null);
    setScanResults([]);

    localStorage.setItem('rfid_scanned_by', scannedBy);

    try {
      const response = await fetch('/api/rfid/bulk-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epcs: pendingEpcs,
          station,
          scannedBy: scannedBy.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Bulk scan failed');
        return;
      }

      const results: ScanResult[] = data.data.results.map(
        (r: { epc: string; success: boolean; tag?: { graduateName?: string; type?: string }; titoCheckin?: { success: boolean; error?: string }; error?: string }) => ({
          epc: r.epc,
          success: r.success,
          graduateName: r.tag?.graduateName,
          type: r.tag?.type,
          error: r.error,
          titoCheckin: r.titoCheckin,
        })
      );

      setScanResults(results);
      setPendingEpcs([]);
      setShowResultsExpanded(true);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Quick single scan
  const handleQuickScan = async (epc: string) => {
    if (!scannedBy.trim()) {
      setError('Please enter your name (Scanned By)');
      return;
    }

    setLoading(true);
    setError(null);

    localStorage.setItem('rfid_scanned_by', scannedBy);

    try {
      const response = await fetch('/api/rfid/bulk-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epcs: [epc.toUpperCase().trim()],
          station,
          scannedBy: scannedBy.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Scan failed');
        return;
      }

      const result = data.data.results[0];
      setScanResults(prev => [
        {
          epc: result.epc,
          success: result.success,
          graduateName: result.tag?.graduateName,
          type: result.tag?.type,
          error: result.error,
          titoCheckin: result.titoCheckin,
        },
        ...prev,
      ]);
      setEpcInput('');
      setShowResultsExpanded(true);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const successCount = scanResults.filter(r => r.success).length;
  const failCount = scanResults.filter(r => !r.success).length;
  const titoCount = scanResults.filter(r => r.titoCheckin?.success).length;

  return (
    <div className="min-h-screen bg-[#0c1222] text-[#f1f5f9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <ScanLine className="w-7 h-7 text-cyan-400" />
                RFID Bulk Scanner
              </h1>
              <p className="text-slate-400 mt-1">
                Scan RFID tags at stations with auto Tito check-in
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/staff/rfid/encode"
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <Pencil className="w-4 h-4" />
              Encode
            </Link>
            <Link
              href="/staff/rfid/dashboard"
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="space-y-4">
            {/* Station Selection */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Station</h3>
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {STATION_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setStation(opt.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                      station === opt.id
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                        : 'hover:bg-slate-700/50 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scanned By */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Scanned By
              </label>
              <input
                type="text"
                value={scannedBy}
                onChange={e => setScannedBy(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Center: Scan Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* RFID Reader Connection Banner */}
            {readerStatus === 'checking' && (
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-400">Checking RFID reader...</span>
              </div>
            )}
            {readerStatus === 'connected' && (
              <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/10 backdrop-blur-sm rounded-xl border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">RFID Reader Connected</span>
                </div>
                <div className="flex items-center gap-3">
                  {isScanning && (
                    <span className="text-xs text-emerald-400 font-mono">{scannedCount} reads</span>
                  )}
                  {isScanning ? (
                    <button
                      onClick={handleStopScan}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop Scan
                    </button>
                  ) : (
                    <button
                      onClick={handleStartScan}
                      disabled={!scannedBy.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Scan
                    </button>
                  )}
                </div>
              </div>
            )}
            {readerStatus === 'disconnected' && (
              <div className="flex items-center justify-between px-4 py-3 bg-amber-500/10 backdrop-blur-sm rounded-xl border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <WifiOff className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-amber-300">No RFID Reader — Manual Entry Mode</span>
                </div>
                <button
                  onClick={() => { setBridgeInput(bridgeUrl); setShowBridgeSettings(true); }}
                  className="text-xs px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 rounded-lg text-amber-300 transition-colors"
                >
                  Set Bridge IP
                </button>
              </div>
            )}

            {/* Bridge URL Settings Modal */}
            {showBridgeSettings && (
              <div className="px-4 py-3 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-cyan-300">RFID Bridge URL</span>
                  <button
                    onClick={() => setShowBridgeSettings(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bridgeInput}
                    onChange={e => setBridgeInput(e.target.value)}
                    placeholder="http://192.168.1.100:8080"
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => {
                      const url = bridgeInput.trim().replace(/\/$/, '');
                      if (url) {
                        setBridgeUrl(url);
                        localStorage.setItem('rfid_bridge_url', url);
                        setShowBridgeSettings(false);
                        setReaderStatus('checking');
                      }
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Connect
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  USB: http://localhost:8080 &nbsp;|&nbsp; WiFi: http://&lt;phone-ip&gt;:8080
                </p>
              </div>
            )}

            {/* EPC Input */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
              <div className="flex gap-2 mb-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={epcInput}
                  onChange={e => setEpcInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) {
                        // Quick single scan
                        handleQuickScan(epcInput);
                      } else {
                        addEpc();
                      }
                    }
                  }}
                  placeholder="Scan or type EPC (e.g., 118AEC1001 or BOX-001)"
                  className="flex-1 px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  autoFocus
                />
                <button
                  onClick={addEpc}
                  disabled={!epcInput.trim()}
                  className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors"
                  title="Add to batch"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleQuickScan(epcInput)}
                  disabled={!epcInput.trim() || loading}
                  className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors"
                  title="Quick single scan (Shift+Enter)"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Enter to add to batch | Shift+Enter for quick single scan
                {readerStatus === 'connected' && ' | Hardware scan auto-adds tags'}
              </p>
            </div>

            {/* Pending EPCs */}
            {pendingEpcs.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-300">
                    Pending Batch ({pendingEpcs.length})
                  </h3>
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
                  {pendingEpcs.map((epc, i) => {
                    const detail = pendingTagDetails[epc];
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 bg-slate-900/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {epc.startsWith('BOX-') ? (
                            <Box className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : (
                            <Tag className="w-4 h-4 text-blue-400 shrink-0" />
                          )}
                          <span className="font-mono text-sm truncate">{epc}</span>
                          {detail?.found && (
                            <span className="text-xs text-green-400 shrink-0">
                              — {detail.graduateName || detail.convocationNumber || 'Registered'}
                            </span>
                          )}
                          {detail && !detail.found && (
                            <span className="text-xs text-slate-500 shrink-0">— N/A</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeEpc(i)}
                          className="text-red-400 hover:text-red-300 shrink-0 ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handlePrepareScan}
                  disabled={loading}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-5 h-5" />
                      Scan {pendingEpcs.length} Tags at{' '}
                      {STATION_OPTIONS.find(s => s.id === station)?.label}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Scan Results */}
            {scanResults.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                <button
                  onClick={() => setShowResultsExpanded(!showResultsExpanded)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Scan Results
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-400">{successCount} OK</span>
                      {failCount > 0 && (
                        <span className="text-red-400">{failCount} Failed</span>
                      )}
                      {titoCount > 0 && (
                        <span className="text-blue-400">{titoCount} Tito</span>
                      )}
                    </div>
                    {showResultsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {showResultsExpanded && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {scanResults.map((result, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${
                          result.success
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="font-mono text-sm font-medium">{result.epc}</span>
                          {result.type === 'box' ? (
                            <Box className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Tag className="w-3.5 h-3.5 text-blue-400" />
                          )}
                          {result.titoCheckin?.success && (
                            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                              Tito ✓
                            </span>
                          )}
                        </div>
                        {result.graduateName && (
                          <p className="text-sm text-slate-400 ml-6 mt-1">
                            {result.graduateName}
                          </p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-400 ml-6 mt-1">{result.error}</p>
                        )}
                        {result.titoCheckin && !result.titoCheckin.success && result.titoCheckin.error && (
                          <p className="text-xs text-amber-400 ml-6 mt-1">
                            Tito: {result.titoCheckin.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold">Confirm Bulk Scan</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Station:</span>
                  <span className="font-medium">
                    {STATION_OPTIONS.find(s => s.id === station)?.icon}{' '}
                    {STATION_OPTIONS.find(s => s.id === station)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Tags:</span>
                  <span className="font-medium">{pendingEpcs.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Scanned By:</span>
                  <span>{scannedBy}</span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {pendingEpcs.map((epc, i) => {
                  const detail = pendingTagDetails[epc];
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        detail?.found ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-900/50 border border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {epc.startsWith('BOX-') ? (
                          <Box className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs truncate">{epc}</span>
                      </div>
                      <span className={`text-xs shrink-0 ml-2 ${
                        detail?.found ? 'text-green-400 font-medium' : 'text-slate-500'
                      }`}>
                        {!detail ? (
                          <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                        ) : detail.found ? (
                          detail.graduateName || detail.convocationNumber || detail.type || 'Registered'
                        ) : (
                          'N/A'
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6">
              This will scan all {pendingEpcs.length} tags at the selected station and
              auto-trigger Tito check-ins for graduate tags.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScan}
                className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-medium transition-colors"
              >
                Confirm Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
