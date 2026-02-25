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
  Printer,
  Settings,
  Search,
  Clock,
  MapPin,
  X,
} from 'lucide-react';

import { isWd01Format, convertWd01ToUhfEpc } from '@/types/rfid';

// Display EPC in clean 24-char format (convert 32-char WD01 if needed)
function displayEpc(epc: string): string {
  const upper = epc.toUpperCase().trim();
  if (isWd01Format(upper)) {
    return convertWd01ToUhfEpc(upper);
  }
  // If 32+ hex chars with TID suffix, truncate to 24
  if (/^[0-9A-F]{32,}$/.test(upper)) {
    return upper.slice(0, 24);
  }
  return upper;
}

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

interface PrintLogEntry {
  epc: string;
  name?: string;
  status: 'printed' | 'skipped' | 'error';
  time: string;
  error?: string;
  titoCheckin?: { success: boolean; error?: string };
}

// Station journey order for timeline display
const JOURNEY_STATIONS: { id: string; label: string; icon: string }[] = [
  { id: 'encoding', label: 'Encoded', icon: '🏷️' },
  { id: 'packing', label: 'Packing', icon: '📦' },
  { id: 'dispatch-venue', label: 'Dispatch to Venue', icon: '🚚' },
  { id: 'registration', label: 'Registration', icon: '📝' },
  { id: 'gown-issue', label: 'Gown Issue', icon: '👗' },
  { id: 'gown-return', label: 'Gown Return', icon: '🔄' },
  { id: 'certificate-collection', label: 'Certificate Collection', icon: '📜' },
  { id: 'return-ho', label: 'Return to HO', icon: '🏢' },
  { id: 'address-label', label: 'Address Label', icon: '🏷️' },
  { id: 'final-dispatch', label: 'Final Dispatch', icon: '✈️' },
];

interface LookupTag {
  epc: string;
  type: string;
  convocationNumber?: string;
  graduateName?: string;
  status: string;
  currentStation: string;
  encodedAt?: string;
  encodedBy?: string;
  lastScanAt?: string;
  lastScanBy?: string;
  lastScanStation?: string;
  scanHistory: { station: string; timestamp: string; scannedBy: string; action: string; notes?: string }[];
}

// Stations that support WD01 desktop reader + auto-print
const DESKTOP_PRINT_STATIONS: RfidStation[] = ['packing', 'address-label'];

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

  // Auto-print state
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_auto_print') === 'true';
    }
    return false;
  });
  const [printerIP, setPrinterIP] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_printer_ip') || '10.0.1.13';
    }
    return '10.0.1.13';
  });
  const [printServerUrl, setPrintServerUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_print_server') || '';
    }
    return '';
  });
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [printedEpcs, setPrintedEpcs] = useState<Set<string>>(new Set());
  const [printLog, setPrintLog] = useState<PrintLogEntry[]>([]);
  const [testingPrinter, setTestingPrinter] = useState(false);
  const printingRef = useRef<Set<string>>(new Set()); // tracks in-flight print requests

  // WD01 desktop reader detection
  const keyTimestamps = useRef<number[]>([]);
  const [wd01Detected, setWd01Detected] = useState(false);
  const wd01FadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convocation number lookup
  const [showLookup, setShowLookup] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupTag, setLookupTag] = useState<LookupTag | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookupInputRef = useRef<HTMLInputElement>(null);

  // Lookup a tag by convocation number / EPC
  const handleLookup = useCallback(async (query?: string) => {
    const q = (query || lookupQuery).toUpperCase().trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupTag(null);
    try {
      const res = await fetch(`/api/rfid/verify?epc=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.success) {
        setLookupError(data.error || 'Lookup failed');
      } else if (!data.found) {
        setLookupError(`"${q}" not found — tag is not registered`);
      } else {
        setLookupTag(data.data.tag as LookupTag);
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupQuery]);

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

  // Auto-print: trigger print when tag details arrive for found tags
  useEffect(() => {
    if (!autoPrintEnabled) return;

    for (const epc of pendingEpcs) {
      const detail = pendingTagDetails[epc];
      if (!detail || !detail.found) continue;
      if (printedEpcs.has(epc)) continue;
      if (printingRef.current.has(epc)) continue;

      // Mark as in-flight to prevent duplicate calls
      printingRef.current.add(epc);

      fetch(`${printServerUrl}/api/rfid/auto-print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epc, printerIP, station, scannedBy }),
      })
        .then(res => res.json())
        .then(data => {
          printingRef.current.delete(epc);
          if (data.printed) {
            setPrintedEpcs(prev => new Set(prev).add(epc));
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(epc),
              name: data.graduateName || detail.graduateName,
              status: 'printed',
              time: new Date().toLocaleTimeString(),
              titoCheckin: data.stationScan?.titoCheckin,
            }, ...prev]);
          } else if (data.reason === 'unregistered') {
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(epc),
              status: 'skipped',
              time: new Date().toLocaleTimeString(),
            }, ...prev]);
          } else {
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(epc),
              name: data.graduateName || detail.graduateName,
              status: 'error',
              error: data.error || 'Print failed',
              time: new Date().toLocaleTimeString(),
            }, ...prev]);
          }
        })
        .catch(err => {
          printingRef.current.delete(epc);
          setPrintLog(prev => [{
            epc,
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
            time: new Date().toLocaleTimeString(),
          }, ...prev]);
        });
    }
  }, [pendingEpcs, pendingTagDetails, autoPrintEnabled, printerIP, printedEpcs, printServerUrl]);

  // WD01 auto-print: watch epcInput for complete EPC and auto-trigger
  // Only active for desktop print stations (packing, address-label)
  useEffect(() => {
    if (!autoPrintEnabled || !DESKTOP_PRINT_STATIONS.includes(station)) return;
    const trimmed = epcInput.trim().toUpperCase();
    // Must be 32 hex chars (WD01 TID format) or match convocation pattern
    const isWd01 = /^[0-9A-F]{32}$/.test(trimmed);
    const isConvocation = /^\d+(?:AEC|WEC)\d+$/i.test(trimmed);
    if (!isWd01 && !isConvocation) return;
    if (trimmed.length < 10) return;
    // Skip duplicates
    if (printedEpcs.has(trimmed) || printingRef.current.has(trimmed)) return;

    const timer = setTimeout(() => {
      // Show WD01 badge
      setWd01Detected(true);
      if (wd01FadeTimer.current) clearTimeout(wd01FadeTimer.current);
      wd01FadeTimer.current = setTimeout(() => setWd01Detected(false), 5000);

      printingRef.current.add(trimmed);
      setEpcInput('');
      inputRef.current?.focus();

      fetch(`${printServerUrl}/api/rfid/auto-print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epc: trimmed, printerIP, station, scannedBy }),
      })
        .then(res => res.json())
        .then(data => {
          printingRef.current.delete(trimmed);
          if (data.printed) {
            setPrintedEpcs(prev => new Set(prev).add(trimmed));
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(trimmed),
              name: data.graduateName,
              status: 'printed',
              time: new Date().toLocaleTimeString(),
              titoCheckin: data.stationScan?.titoCheckin,
            }, ...prev]);
          } else if (data.reason === 'unregistered') {
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(trimmed),
              status: 'skipped',
              time: new Date().toLocaleTimeString(),
            }, ...prev]);
          } else {
            setPrintLog(prev => [{
              epc: data.epc || displayEpc(trimmed),
              status: 'error',
              error: data.error || 'Print failed',
              time: new Date().toLocaleTimeString(),
            }, ...prev]);
          }
        })
        .catch(err => {
          printingRef.current.delete(trimmed);
          setPrintLog(prev => [{
            epc: displayEpc(trimmed),
            status: 'error',
            error: err instanceof Error ? err.message : 'Network error',
            time: new Date().toLocaleTimeString(),
          }, ...prev]);
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [epcInput, autoPrintEnabled, printerIP, printedEpcs, station, printServerUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Test printer connection
  const handleTestPrint = async () => {
    setTestingPrinter(true);
    try {
      const res = await fetch(`${printServerUrl}/api/print/zpl?ip=${encodeURIComponent(printerIP)}&port=9100`);
      const data = await res.json();
      if (data.success) {
        setPrintLog(prev => [{ epc: 'TEST', status: 'printed', time: new Date().toLocaleTimeString(), name: 'Test Print OK' }, ...prev]);
      } else {
        setPrintLog(prev => [{ epc: 'TEST', status: 'error', time: new Date().toLocaleTimeString(), error: data.error || 'Connection failed' }, ...prev]);
      }
    } catch (err) {
      setPrintLog(prev => [{ epc: 'TEST', status: 'error', time: new Date().toLocaleTimeString(), error: err instanceof Error ? err.message : 'Network error' }, ...prev]);
    } finally {
      setTestingPrinter(false);
    }
  };

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

  // Execute bulk scan (only registered tags)
  const handleConfirmScan = async () => {
    // Filter to only registered EPCs
    const registeredEpcs = pendingEpcs.filter(epc => pendingTagDetails[epc]?.found);
    if (registeredEpcs.length === 0) {
      setError('No registered tags to process');
      setShowConfirmDialog(false);
      return;
    }
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
          epcs: registeredEpcs,
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

      // Auto-print on quick scan if enabled
      if (autoPrintEnabled && result.success) {
        const normalizedEpc = epc.toUpperCase().trim();
        if (!printedEpcs.has(normalizedEpc)) {
          fetch(`${printServerUrl}/api/rfid/auto-print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ epc: normalizedEpc, printerIP, station, scannedBy }),
          })
            .then(res => res.json())
            .then(printData => {
              if (printData.printed) {
                setPrintedEpcs(prev => new Set(prev).add(normalizedEpc));
                setPrintLog(prev => [{ epc: printData.epc || displayEpc(normalizedEpc), name: printData.graduateName || result.tag?.graduateName, status: 'printed', time: new Date().toLocaleTimeString(), titoCheckin: printData.stationScan?.titoCheckin }, ...prev]);
              } else {
                setPrintLog(prev => [{ epc: printData.epc || displayEpc(normalizedEpc), status: printData.reason === 'unregistered' ? 'skipped' : 'error', error: printData.error, time: new Date().toLocaleTimeString() }, ...prev]);
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const isDesktopPrintStation = DESKTOP_PRINT_STATIONS.includes(station);
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
            <button
              onClick={() => { setShowLookup(true); setTimeout(() => lookupInputRef.current?.focus(), 100); }}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg transition-colors text-sm text-cyan-300"
            >
              <Search className="w-4 h-4" />
              Track
            </button>
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
              <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl border border-emerald-500/30">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">RFID Reader Connected</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isScanning && (
                      <span className="text-xs text-emerald-400 font-mono">{scannedCount} reads</span>
                    )}
                    {/* Auto-Print Toggle — only for desktop print stations */}
                    {isDesktopPrintStation && (
                      <>
                        <button
                          onClick={() => {
                            const next = !autoPrintEnabled;
                            setAutoPrintEnabled(next);
                            localStorage.setItem('rfid_auto_print', String(next));
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            autoPrintEnabled
                              ? 'bg-purple-600/80 text-purple-100'
                              : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                          }`}
                          title="Auto-print packing labels on tag detect"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Auto-Print
                        </button>
                        <button
                          onClick={() => setShowPrinterSettings(prev => !prev)}
                          className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 transition-colors"
                          title="Printer settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </>
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
                {/* Auto-print stats bar */}
                {isDesktopPrintStation && autoPrintEnabled && printLog.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2 border-t border-emerald-500/20 text-xs">
                    <Printer className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 font-medium">
                      {printLog.filter(l => l.status === 'printed').length} printed
                    </span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">
                      {pendingEpcs.length} scanned
                    </span>
                    {printLog.some(l => l.status === 'error') && (
                      <span className="text-red-400">
                        {printLog.filter(l => l.status === 'error').length} errors
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {readerStatus === 'disconnected' && (
              <div className={`backdrop-blur-sm rounded-xl border ${wd01Detected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    {wd01Detected ? (
                      <>
                        <Radio className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-300">WD01 Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-5 h-5 text-amber-400" />
                        <span className="text-sm text-amber-300">Manual Entry Mode</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Auto-Print Toggle — only for desktop print stations */}
                    {isDesktopPrintStation && (
                      <>
                        <button
                          onClick={() => {
                            const next = !autoPrintEnabled;
                            setAutoPrintEnabled(next);
                            localStorage.setItem('rfid_auto_print', String(next));
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            autoPrintEnabled
                              ? 'bg-purple-600/80 text-purple-100'
                              : 'bg-slate-700/80 text-slate-400 hover:bg-slate-600/80'
                          }`}
                          title="Auto-print packing labels on tag detect"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Auto-Print
                        </button>
                        <button
                          onClick={() => setShowPrinterSettings(prev => !prev)}
                          className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 transition-colors"
                          title="Printer settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setBridgeInput(bridgeUrl); setShowBridgeSettings(true); }}
                      className="text-xs px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 rounded-lg text-amber-300 transition-colors"
                    >
                      Set Bridge IP
                    </button>
                  </div>
                </div>
                {/* Auto-print stats bar */}
                {isDesktopPrintStation && autoPrintEnabled && printLog.length > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2 border-t border-amber-500/20 text-xs">
                    <Printer className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 font-medium">
                      {printLog.filter(l => l.status === 'printed').length} printed
                    </span>
                    <span className="text-slate-500">/</span>
                    <span className="text-slate-400">
                      {pendingEpcs.length} scanned
                    </span>
                    {printLog.some(l => l.status === 'error') && (
                      <span className="text-red-400">
                        {printLog.filter(l => l.status === 'error').length} errors
                      </span>
                    )}
                  </div>
                )}
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

            {/* Printer Settings Panel */}
            {showPrinterSettings && (
              <div className="px-4 py-3 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-300">Printer Settings</span>
                  <button
                    onClick={() => setShowPrinterSettings(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={printerIP}
                    onChange={e => {
                      setPrinterIP(e.target.value);
                      localStorage.setItem('rfid_printer_ip', e.target.value);
                    }}
                    placeholder="10.0.1.13"
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    onClick={handleTestPrint}
                    disabled={testingPrinter || !printerIP.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    {testingPrinter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                    Test Print
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Honeywell PC42t IP address (port 9100) &nbsp;|&nbsp; Labels print automatically when tags are detected
                </p>
                {/* Print Server URL */}
                <div className="pt-2 border-t border-slate-700/50">
                  <label className="block text-xs font-medium text-purple-300 mb-1.5">Print Server URL</label>
                  <input
                    type="text"
                    value={printServerUrl}
                    onChange={e => {
                      const val = e.target.value.trim().replace(/\/$/, '');
                      setPrintServerUrl(val);
                      localStorage.setItem('rfid_print_server', val);
                    }}
                    placeholder="http://localhost:3001"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Leave empty when running on localhost. Set to <span className="font-mono text-slate-400">http://localhost:3001</span> when using the live site.
                  </p>
                  {typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1') && !printServerUrl && (
                    <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-300">
                        You&apos;re on the live site. Set Print Server URL to <button
                          onClick={() => {
                            const val = 'http://localhost:3001';
                            setPrintServerUrl(val);
                            localStorage.setItem('rfid_print_server', val);
                          }}
                          className="font-mono underline hover:text-amber-200"
                        >http://localhost:3001</button> to route prints to your local machine.
                      </span>
                    </div>
                  )}
                </div>
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
                    const now = Date.now();
                    keyTimestamps.current.push(now);
                    // Keep only last 10 timestamps
                    if (keyTimestamps.current.length > 10) {
                      keyTimestamps.current = keyTimestamps.current.slice(-10);
                    }

                    if (e.key === 'Enter') {
                      const timestamps = keyTimestamps.current;
                      const isReaderInput = timestamps.length >= 5 &&
                        (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1) < 50;
                      keyTimestamps.current = [];

                      if (isReaderInput) {
                        e.preventDefault();
                        // Show WD01 connected badge (auto-fade after 5s)
                        setWd01Detected(true);
                        if (wd01FadeTimer.current) clearTimeout(wd01FadeTimer.current);
                        wd01FadeTimer.current = setTimeout(() => setWd01Detected(false), 5000);

                        const normalizedEpc = epcInput.toUpperCase().trim();
                        if (!normalizedEpc) return;

                        if (autoPrintEnabled && isDesktopPrintStation) {
                          // WD01 + Auto-Print: print label directly (packing/address-label only)
                          if (printedEpcs.has(normalizedEpc) || printingRef.current.has(normalizedEpc)) {
                            // Duplicate — skip silently
                            setEpcInput('');
                            inputRef.current?.focus();
                            return;
                          }
                          printingRef.current.add(normalizedEpc);
                          setEpcInput('');
                          inputRef.current?.focus();

                          fetch(`${printServerUrl}/api/rfid/auto-print`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ epc: normalizedEpc, printerIP, station, scannedBy }),
                          })
                            .then(res => res.json())
                            .then(data => {
                              printingRef.current.delete(normalizedEpc);
                              if (data.printed) {
                                setPrintedEpcs(prev => new Set(prev).add(normalizedEpc));
                                setPrintLog(prev => [{
                                  epc: data.epc || displayEpc(normalizedEpc),
                                  name: data.graduateName,
                                  status: 'printed',
                                  time: new Date().toLocaleTimeString(),
                                  titoCheckin: data.stationScan?.titoCheckin,
                                }, ...prev]);
                              } else if (data.reason === 'unregistered') {
                                setPrintLog(prev => [{
                                  epc: data.epc || displayEpc(normalizedEpc),
                                  status: 'skipped',
                                  time: new Date().toLocaleTimeString(),
                                }, ...prev]);
                              } else {
                                setPrintLog(prev => [{
                                  epc: data.epc || displayEpc(normalizedEpc),
                                  status: 'error',
                                  error: data.error || 'Print failed',
                                  time: new Date().toLocaleTimeString(),
                                }, ...prev]);
                              }
                            })
                            .catch(err => {
                              printingRef.current.delete(normalizedEpc);
                              setPrintLog(prev => [{
                                epc: displayEpc(normalizedEpc),
                                status: 'error',
                                error: err instanceof Error ? err.message : 'Network error',
                                time: new Date().toLocaleTimeString(),
                              }, ...prev]);
                            });
                        } else {
                          // WD01 + no auto-print: add to batch like normal
                          addEpc();
                        }
                      } else if (e.shiftKey) {
                        // Manual typing + Shift+Enter: quick single scan
                        handleQuickScan(epcInput);
                      } else {
                        // Manual typing + Enter: add to batch
                        addEpc();
                      }
                    }
                  }}
                  placeholder={isDesktopPrintStation ? "Place folder on WD01 reader" : "Scan or type EPC"}
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
                {isDesktopPrintStation
                  ? 'Place folder on WD01 reader to auto-print'
                  : 'Enter to add to batch | Shift+Enter for quick scan'}
                {readerStatus === 'connected' && !isDesktopPrintStation && ' | Hardware scan auto-adds tags'}
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

            {/* Print Log — only for desktop print stations */}
            {isDesktopPrintStation && printLog.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-purple-400" />
                    Print Log
                  </h3>
                  <button
                    onClick={() => setPrintLog([])}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {printLog.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                        entry.status === 'printed'
                          ? 'bg-purple-500/10 border border-purple-500/20'
                          : entry.status === 'error'
                          ? 'bg-red-500/10 border border-red-500/20'
                          : 'bg-slate-900/30 border border-slate-700/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {entry.status === 'printed' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        ) : entry.status === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className="truncate">
                          {entry.name || entry.epc}
                        </span>
                        {entry.status === 'printed' && (
                          <span className="text-xs text-purple-400 shrink-0">Printed</span>
                        )}
                        {entry.status === 'printed' && entry.titoCheckin?.success && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">Tito ✓</span>
                        )}
                        {entry.status === 'printed' && entry.titoCheckin && !entry.titoCheckin.success && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 shrink-0" title={entry.titoCheckin.error}>Tito ✗</span>
                        )}
                        {entry.status === 'skipped' && (
                          <span className="text-xs text-slate-500 shrink-0">Skipped</span>
                        )}
                        {entry.status === 'error' && (
                          <span className="text-xs text-red-400 shrink-0 truncate">{entry.error}</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 shrink-0 ml-2">{entry.time}</span>
                    </div>
                  ))}
                </div>
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
                          <span className="font-mono text-sm font-medium">{displayEpc(result.epc)}</span>
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

      {/* Tag Lookup / Track Panel */}
      {showLookup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-16 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Track Tag Journey
              </h3>
              <button
                onClick={() => { setShowLookup(false); setLookupTag(null); setLookupError(null); setLookupQuery(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Search input */}
            <div className="flex gap-2 mb-4">
              <input
                ref={lookupInputRef}
                type="text"
                value={lookupQuery}
                onChange={e => setLookupQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
                placeholder="Convocation number (e.g. 118AEC1001)"
                className="flex-1 px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono uppercase"
                autoFocus
              />
              <button
                onClick={() => handleLookup()}
                disabled={lookupLoading || !lookupQuery.trim()}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            {/* Error */}
            {lookupError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 mb-4">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{lookupError}</p>
              </div>
            )}

            {/* Loading */}
            {lookupLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}

            {/* Tag Result */}
            {lookupTag && (
              <div className="space-y-4">
                {/* Graduate info */}
                <div className="p-3 bg-slate-900/50 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">{lookupTag.graduateName || lookupTag.epc}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      lookupTag.status === 'encoded' ? 'bg-slate-600/50 text-slate-300' :
                      lookupTag.status === 'scanned' ? 'bg-cyan-500/20 text-cyan-300' :
                      lookupTag.status === 'dispatched' ? 'bg-blue-500/20 text-blue-300' :
                      lookupTag.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300' :
                      lookupTag.status === 'returned' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {lookupTag.status.toUpperCase()}
                    </span>
                  </div>
                  {lookupTag.convocationNumber && (
                    <p className="text-sm text-slate-400 font-mono">{lookupTag.convocationNumber}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {lookupTag.encodedBy && <span>Encoded by {lookupTag.encodedBy}</span>}
                    {lookupTag.encodedAt && <span>{new Date(lookupTag.encodedAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Station Journey Timeline */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    Station Journey
                  </h4>
                  <div className="relative space-y-0">
                    {JOURNEY_STATIONS.map((station, i) => {
                      // Find scan record for this station
                      const scanRecord = lookupTag.scanHistory.find(s => s.station === station.id);
                      // For encoding station, check encodedAt
                      const isEncoded = station.id === 'encoding' && lookupTag.encodedAt;
                      const isDone = !!scanRecord || !!isEncoded;
                      const isLast = i === JOURNEY_STATIONS.length - 1;

                      return (
                        <div key={station.id} className="flex gap-3">
                          {/* Timeline line + dot */}
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                              isDone
                                ? 'bg-emerald-500/20 border-2 border-emerald-500/60'
                                : 'bg-slate-800 border-2 border-slate-600/40'
                            }`}>
                              {isDone ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <span className="text-xs text-slate-600">{station.icon}</span>
                              )}
                            </div>
                            {!isLast && (
                              <div className={`w-0.5 h-8 ${isDone ? 'bg-emerald-500/30' : 'bg-slate-700/50'}`} />
                            )}
                          </div>
                          {/* Station info */}
                          <div className={`pb-4 ${isDone ? '' : 'opacity-40'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isDone ? 'text-white' : 'text-slate-500'}`}>
                                {station.label}
                              </span>
                            </div>
                            {isDone && (
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {station.id === 'encoding' && lookupTag.encodedAt
                                    ? new Date(lookupTag.encodedAt).toLocaleString()
                                    : scanRecord
                                    ? new Date(scanRecord.timestamp).toLocaleString()
                                    : ''}
                                </span>
                                <span>
                                  {station.id === 'encoding'
                                    ? lookupTag.encodedBy
                                    : scanRecord?.scannedBy}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick action: look up another */}
                <button
                  onClick={() => { setLookupTag(null); setLookupQuery(''); setTimeout(() => lookupInputRef.current?.focus(), 50); }}
                  className="w-full py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  Look up another tag
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold">Confirm Bulk Scan</h3>
            </div>

            {(() => {
              const registeredEpcs = pendingEpcs.filter(epc => pendingTagDetails[epc]?.found);
              const unregisteredEpcs = pendingEpcs.filter(epc => pendingTagDetails[epc] && !pendingTagDetails[epc].found);
              const loadingCount = pendingEpcs.filter(epc => !pendingTagDetails[epc]).length;
              return (
                <>
                  <div className="space-y-3 mb-4">
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Station:</span>
                        <span className="font-medium">
                          {STATION_OPTIONS.find(s => s.id === station)?.icon}{' '}
                          {STATION_OPTIONS.find(s => s.id === station)?.label}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Registered:</span>
                        <span className="font-medium text-green-400">{registeredEpcs.length}</span>
                      </div>
                      {unregisteredEpcs.length > 0 && (
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-400">Unregistered (skipped):</span>
                          <span className="font-medium text-slate-500">{unregisteredEpcs.length}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Scanned By:</span>
                        <span>{scannedBy}</span>
                      </div>
                    </div>

                    {unregisteredEpcs.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-xs text-amber-300 flex-1">
                          {unregisteredEpcs.length} unregistered tag{unregisteredEpcs.length > 1 ? 's' : ''} will be skipped
                        </span>
                        <button
                          onClick={() => {
                            setPendingEpcs(prev => prev.filter(epc => pendingTagDetails[epc]?.found));
                          }}
                          className="text-xs px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 rounded text-amber-300 transition-colors shrink-0"
                        >
                          Remove N/A
                        </button>
                      </div>
                    )}

                    <div className="max-h-48 overflow-y-auto space-y-1.5">
                      {pendingEpcs.map((epc, i) => {
                        const detail = pendingTagDetails[epc];
                        const isNA = detail && !detail.found;
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                              isNA ? 'bg-slate-900/30 border border-slate-700/20 opacity-50'
                                : detail?.found ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-slate-900/50 border border-slate-700/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {epc.startsWith('BOX-') ? (
                                <Box className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <Tag className={`w-3.5 h-3.5 shrink-0 ${isNA ? 'text-slate-600' : 'text-blue-400'}`} />
                              )}
                              <span className={`font-mono text-xs truncate ${isNA ? 'line-through text-slate-600' : ''}`}>{epc}</span>
                            </div>
                            <span className={`text-xs shrink-0 ml-2 ${
                              detail?.found ? 'text-green-400 font-medium' : 'text-slate-500'
                            }`}>
                              {!detail ? (
                                <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                              ) : detail.found ? (
                                detail.graduateName || detail.convocationNumber || detail.type || 'Registered'
                              ) : (
                                'N/A — skip'
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-sm text-slate-400 mb-4">
                    {registeredEpcs.length > 0
                      ? `Will process ${registeredEpcs.length} registered tag${registeredEpcs.length > 1 ? 's' : ''} at the selected station and auto-trigger Tito check-ins.`
                      : 'No registered tags to process.'}
                    {unregisteredEpcs.length > 0 && ` ${unregisteredEpcs.length} unregistered tag${unregisteredEpcs.length > 1 ? 's' : ''} will be skipped.`}
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
                      disabled={registeredEpcs.length === 0 || loadingCount > 0}
                      className="flex-1 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors"
                    >
                      Confirm Scan ({registeredEpcs.length})
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
