'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Radio,
  Tag,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Box,
  Camera,
  Zap,
  Search,
} from 'lucide-react';
import UniversalScanner, { SearchInputType, extractTicketFromUrl } from '@/components/UniversalScanner';

interface EncodedTag {
  epc: string;
  type: string;
  graduateName?: string;
  convocationNumber?: string;
  boxId?: string;
  status: string;
}

export default function RfidEncodePage() {
  const [tagType, setTagType] = useState<'graduate' | 'box'>('graduate');
  const [epc, setEpc] = useState('');
  const [convocationNumber, setConvocationNumber] = useState('');
  const [boxId, setBoxId] = useState('');
  const [boxLabel, setBoxLabel] = useState('');
  const [encodedBy, setEncodedBy] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rfid_encoded_by') || '';
    }
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [encodedTags, setEncodedTags] = useState<EncodedTag[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEncode, setPendingEncode] = useState<{
    epc: string;
    type: string;
    convocationNumber?: string;
    boxId?: string;
    boxLabel?: string;
  } | null>(null);

  // QR Scanner
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [lookupName, setLookupName] = useState<string | null>(null);

  // Box contents management
  const [boxItemEpcs, setBoxItemEpcs] = useState<string[]>([]);
  const [newBoxItem, setNewBoxItem] = useState('');

  // Reader status
  const [readerDetected, setReaderDetected] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number>(0);
  const [autoLinkEnabled, setAutoLinkEnabled] = useState(true);
  const epcInputRef = useRef<HTMLInputElement>(null);
  const convocationInputRef = useRef<HTMLInputElement>(null);

  // Track keyboard input speed to detect reader vs manual typing
  const keyTimestamps = useRef<number[]>([]);

  // Duplicate read prevention
  const lastScannedEpc = useRef<string>('');
  const lastScannedTime = useRef<number>(0);

  // Detect rapid keyboard input (reader types very fast, <50ms between keys)
  // Auto-link when reader scan is detected
  const handleEpcKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    keyTimestamps.current.push(now);

    // Keep only last 10 timestamps
    if (keyTimestamps.current.length > 10) {
      keyTimestamps.current = keyTimestamps.current.slice(-10);
    }

    // If Enter is pressed and we have rapid input, it's from the reader
    if (e.key === 'Enter') {
      e.preventDefault(); // Don't submit form on Enter from reader

      const timestamps = keyTimestamps.current;
      let isReaderScan = false;
      if (timestamps.length >= 5) {
        const avgGap =
          (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
        if (avgGap < 50) {
          isReaderScan = true;
          setReaderDetected(true);
          setLastScanTime(now);
        }
      }
      keyTimestamps.current = [];

      // Get the current EPC value from the input
      const currentEpc = (e.target as HTMLInputElement).value.toUpperCase().trim();

      // Duplicate read prevention: ignore same EPC within 3 seconds
      if (currentEpc && currentEpc === lastScannedEpc.current && now - lastScannedTime.current < 3000) {
        console.log('[Encode] Duplicate read ignored:', currentEpc.slice(0, 12));
        setEpc('');
        return;
      }

      if (currentEpc) {
        lastScannedEpc.current = currentEpc;
        lastScannedTime.current = now;
      }

      // Auto-link: trigger linking on Enter (both reader scan and manual typing)
      if (autoLinkEnabled && currentEpc) {
        // Pass EPC directly — don't rely on React state
        setTimeout(() => {
          autoLinkRef.current?.(currentEpc);
        }, 100);
      }
    }
  }, [autoLinkEnabled]);

  // Ref for auto-link function (avoids stale closures)
  const autoLinkRef = useRef<((epcValue: string) => void) | null>(null);

  // Auto-link function — accepts EPC directly to avoid stale state issues
  useEffect(() => {
    autoLinkRef.current = (epcValue: string) => {
      if (loading) return;
      if (!epcValue) return;
      if (!encodedBy.trim()) {
        setError('Please enter your name (Encoded By) before auto-linking');
        return;
      }
      if (tagType === 'graduate' && !convocationNumber.trim()) {
        setError('Enter convocation number first, then scan the tag');
        convocationInputRef.current?.focus();
        setEpc('');
        return;
      }

      // Skip confirmation dialog — directly encode
      const normalizedEpc = epcValue.toUpperCase().trim();
      const encodeData = {
        epc: normalizedEpc,
        type: tagType,
        convocationNumber:
          tagType === 'graduate' ? convocationNumber.toUpperCase().trim() : undefined,
        boxId: tagType === 'box' ? boxId.trim() || undefined : undefined,
        boxLabel: tagType === 'box' ? boxLabel.trim() || undefined : undefined,
      };

      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      localStorage.setItem('rfid_encoded_by', encodedBy);

      fetch('/api/rfid/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...encodeData,
          encodedBy: encodedBy.trim(),
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            setError(data.error || 'Failed to encode tag');
            return;
          }

          const tag = data.data;
          setEncodedTags(prev => [
            {
              epc: tag.epc,
              type: tag.type,
              graduateName: tag.graduateName,
              convocationNumber: tag.convocationNumber,
              boxId: tag.boxId,
              status: 'encoded',
            },
            ...prev,
          ]);

          const emoji = tag.type === 'graduate' ? ' 🎓' : ' 📦';
          const titoWarning = tag.type === 'graduate' && !tag.titoTicketSlug
            ? ' ⚠️ No Tito ticket'
            : '';
          setSuccessMessage(
            `✅ Linked ${tag.epc.slice(0, 12)}... → ${tag.convocationNumber || tag.boxId || tag.epc}${tag.graduateName ? ` (${tag.graduateName})` : ''}${emoji} Tag linked${titoWarning}`
          );

          // Reset for next — focus goes to convocation number input
          setEpc('');
          setConvocationNumber('');
          setBoxId('');
          setBoxLabel('');
          setBoxItemEpcs([]);
          setPendingEncode(null);
          setLookupName(null);

          // Auto-focus convocation number for next tag
          setTimeout(() => convocationInputRef.current?.focus(), 300);
        })
        .catch(err => {
          setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        })
        .finally(() => {
          setLoading(false);
        });
    };
  }, [convocationNumber, tagType, boxId, boxLabel, encodedBy, loading]);

  // After successful encode, focus convocation number field (not EPC)
  useEffect(() => {
    if (successMessage && convocationInputRef.current) {
      setTimeout(() => convocationInputRef.current?.focus(), 300);
    }
  }, [successMessage]);

  // Auto-focus EPC/scan field when graduate name is found (convocation verified)
  useEffect(() => {
    if (lookupName && epcInputRef.current && !epc.trim()) {
      setTimeout(() => epcInputRef.current?.focus(), 300);
    }
  }, [lookupName]);

  // Debounced Tito URL detection — waits for input to stabilize (barcode scanners type char by char)
  const titoLookupRef = useRef(false);
  useEffect(() => {
    if (!convocationNumber || titoLookupRef.current) return;
    const clean = convocationNumber.replace(/[^\x20-\x7E]/g, '');
    if (!/ti[._]to/i.test(clean)) return;
    const parts = clean.split('/');
    const slugPart = parts.find(p => /^ti_/i.test(p));
    const slug = slugPart?.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slug || slug.length < 13) return;

    const timer = setTimeout(() => {
      console.log('[Encode] Tito URL debounced, slug:', slug, 'length:', slug.length);
      titoLookupRef.current = true;
      setConvocationNumber('Looking up...');
      setError(null);
      setScanLoading(true);
      fetch(`/api/tito/ticket/${encodeURIComponent(slug)}`)
        .then(res => res.json())
        .then(data => {
          console.log('[Encode] Tito API response:', data);
          if (data.success && data.data?.convocationNumber) {
            setConvocationNumber(data.data.convocationNumber.toUpperCase());
            setLookupName(data.data.name || null);
            setSuccessMessage(`Found: ${data.data.name || data.data.convocationNumber}`);
          } else {
            setError(`Ticket not found for: ${slug}`);
            setConvocationNumber('');
          }
        })
        .catch(() => {
          setError('Failed to look up ticket');
          setConvocationNumber('');
        })
        .finally(() => {
          setScanLoading(false);
          titoLookupRef.current = false;
        });
    }, 800);

    return () => clearTimeout(timer);
  }, [convocationNumber]);

  // Handle QR scan result — looks up ticket to get convocation number
  const handleScan = useCallback(async (query: string, type: SearchInputType) => {
    setError(null);
    setScanLoading(true);
    setLookupName(null);

    try {
      let ticketSlug: string | null = null;

      if (type === 'tito_url') {
        ticketSlug = extractTicketFromUrl(query);
      } else if (type === 'tito_ticket_id') {
        ticketSlug = query;
      } else if (type === 'convocation_number') {
        setConvocationNumber(query.toUpperCase());
        setTagType('graduate');
        setShowScanner(false);
        setScanLoading(false);
        // Auto-lookup name
        lookupConvocationNumber(query.toUpperCase());
        return;
      }

      if (!ticketSlug) {
        setError(`Could not extract ticket from scanned value: ${query}`);
        setScanLoading(false);
        return;
      }

      const response = await fetch(`/api/tito/ticket/${ticketSlug}`);
      const data = await response.json();

      if (!data.success || !data.data) {
        setError(data.error || 'Ticket not found');
        setScanLoading(false);
        return;
      }

      const convNum = data.data.convocationNumber;
      if (!convNum) {
        setError('No convocation number found for this ticket');
        setScanLoading(false);
        return;
      }

      setConvocationNumber(convNum.toUpperCase());
      setTagType('graduate');
      setLookupName(data.data.name || null);
      setShowScanner(false);
      setSuccessMessage(`Found: ${data.data.name || convNum}`);
    } catch (err) {
      setError(`Lookup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setScanLoading(false);
    }
  }, []);

  // Look up graduate name from convocation number
  const lookupConvocationNumber = async (convNum: string) => {
    if (!convNum || convNum.length < 5) return;
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(convNum)}`);
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const match = data.data.find(
          (r: { convocationNumber?: string }) =>
            r.convocationNumber?.toUpperCase() === convNum.toUpperCase()
        );
        if (match) {
          setLookupName(match.name || null);
        }
      }
    } catch {
      // Silently fail lookup
    }
  };

  const handlePrepareEncode = () => {
    if (!epc.trim()) {
      setError('Please scan a tag or enter the EPC from the reader');
      return;
    }
    if (!encodedBy.trim()) {
      setError('Please enter your name (Encoded By)');
      return;
    }
    if (tagType === 'graduate' && !convocationNumber.trim()) {
      setError('Convocation number is required for graduate tags');
      return;
    }

    const normalizedEpc = epc.toUpperCase().trim();

    setPendingEncode({
      epc: normalizedEpc,
      type: tagType,
      convocationNumber:
        tagType === 'graduate' ? convocationNumber.toUpperCase().trim() : undefined,
      boxId: tagType === 'box' ? boxId.trim() || undefined : undefined,
      boxLabel: tagType === 'box' ? boxLabel.trim() || undefined : undefined,
    });
    setShowConfirmDialog(true);
  };

  const handleConfirmEncode = async () => {
    if (!pendingEncode) return;
    setShowConfirmDialog(false);
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    localStorage.setItem('rfid_encoded_by', encodedBy);

    try {
      const response = await fetch('/api/rfid/encode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pendingEncode,
          encodedBy: encodedBy.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to encode tag');
        return;
      }

      const tag = data.data;
      setEncodedTags(prev => [
        {
          epc: tag.epc,
          type: tag.type,
          graduateName: tag.graduateName,
          convocationNumber: tag.convocationNumber,
          boxId: tag.boxId,
          status: 'encoded',
        },
        ...prev,
      ]);

      const titoWarning = tag.type === 'graduate' && !tag.titoTicketSlug
        ? ' ⚠️ No Tito ticket linked — check-in & QR code will not work!'
        : tag.titoTicketSlug
        ? ' 🎟️ Tito linked'
        : '';
      setSuccessMessage(
        `✅ Linked ${tag.epc.slice(0, 12)}... → ${tag.convocationNumber || tag.boxId || tag.epc}${tag.graduateName ? ` (${tag.graduateName})` : ''}${titoWarning}`
      );

      // Reset for next scan (keep encodedBy and convocation number cleared)
      setEpc('');
      setConvocationNumber('');
      setBoxId('');
      setBoxLabel('');
      setBoxItemEpcs([]);
      setPendingEncode(null);
      setLookupName(null);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const addBoxItem = () => {
    if (newBoxItem.trim() && !boxItemEpcs.includes(newBoxItem.toUpperCase().trim())) {
      setBoxItemEpcs(prev => [...prev, newBoxItem.toUpperCase().trim()]);
      setNewBoxItem('');
    }
  };

  const removeBoxItem = (index: number) => {
    setBoxItemEpcs(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#0c1222] text-[#f1f5f9]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/staff/rfid/scan"
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Radio className="w-7 h-7 text-blue-400" />
              RFID Tag Encoding
            </h1>
            <p className="text-slate-400 mt-1">
              Link RFID tags to certificates — place tag on WD01 reader to scan
            </p>
          </div>
        </div>

        {/* Reader Status */}
        <div
          className={`mb-6 p-3 rounded-lg flex items-center gap-3 ${
            readerDetected
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-slate-800/50 border border-slate-700/50'
          }`}
        >
          <Zap
            className={`w-5 h-5 ${readerDetected ? 'text-green-400' : 'text-slate-500'}`}
          />
          <div className="flex-1">
            <p className={`text-sm font-medium ${readerDetected ? 'text-green-300' : 'text-slate-400'}`}>
              {readerDetected
                ? 'WD01 Reader Detected — scanning via keyboard emulation'
                : 'Click the EPC field and place a tag on the WD01 reader'}
            </p>
            {readerDetected && lastScanTime > 0 && (
              <p className="text-xs text-green-400/60 mt-0.5">
                Last scan: {new Date(lastScanTime).toLocaleTimeString()}
              </p>
            )}
          </div>
          {/* Auto-link toggle */}
          <button
            onClick={() => setAutoLinkEnabled(!autoLinkEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoLinkEnabled
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
            }`}
            title={autoLinkEnabled ? 'Auto-link is ON: reader scan will link automatically' : 'Auto-link is OFF: manual button click required'}
          >
            <Zap className="w-3.5 h-3.5" />
            Auto-Link {autoLinkEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Encode Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Link Tag to Certificate</h2>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  showScanner
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                <Camera className="w-4 h-4" />
                {showScanner ? 'Hide Scanner' : 'Scan QR Code'}
              </button>
            </div>

            {/* QR Scanner */}
            {showScanner && (
              <div className="mb-4">
                {scanLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                )}
                <UniversalScanner
                  onSearch={handleScan}
                  placeholder="Scan certificate QR or type convocation number"
                  loading={scanLoading}
                />
              </div>
            )}

            {/* Tag Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Tag Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTagType('graduate');
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                    tagType === 'graduate'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-slate-600 hover:border-slate-500 text-slate-400'
                  }`}
                >
                  <Tag className="w-5 h-5" />
                  Graduate
                </button>
                <button
                  onClick={() => {
                    setTagType('box');
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                    tagType === 'box'
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                      : 'border-slate-600 hover:border-slate-500 text-slate-400'
                  }`}
                >
                  <Box className="w-5 h-5" />
                  Box
                </button>
              </div>
            </div>

            {/* Encoded By */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Encoded By</label>
              <input
                type="text"
                value={encodedBy}
                onChange={e => setEncodedBy(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Step 1: Convocation Number (for graduate) */}
            {tagType === 'graduate' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Step 1: Convocation Number
                </label>
                <div className="flex gap-2">
                  <input
                    ref={convocationInputRef}
                    type="text"
                    value={convocationNumber}
                    onChange={e => {
                      setConvocationNumber(e.target.value);
                      setLookupName(null);
                    }}
                    onBlur={() => lookupConvocationNumber(convocationNumber)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && convocationNumber.trim()) {
                        e.preventDefault();
                        lookupConvocationNumber(convocationNumber);
                        // Auto-focus EPC/scan field
                        setTimeout(() => epcInputRef.current?.focus(), 100);
                      }
                    }}
                    placeholder="Convocation no. or scan QR / paste Tito URL"
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={() => lookupConvocationNumber(convocationNumber)}
                    className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Look up name"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                {lookupName && (
                  <p className="text-sm text-green-400 mt-1.5">
                    ✓ {lookupName}
                  </p>
                )}
              </div>
            )}

            {/* Box Fields */}
            {tagType === 'box' && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Box ID</label>
                  <input
                    type="text"
                    value={boxId}
                    onChange={e => setBoxId(e.target.value)}
                    placeholder="e.g., 001"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Box Label</label>
                  <input
                    type="text"
                    value={boxLabel}
                    onChange={e => setBoxLabel(e.target.value)}
                    placeholder="e.g., FMAS Kolkata Box 1"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Box Contents */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Box Contents (Graduate EPCs)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newBoxItem}
                      onChange={e => setNewBoxItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addBoxItem()}
                      placeholder="Scan or type EPC"
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                    />
                    <button
                      onClick={addBoxItem}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {boxItemEpcs.length > 0 && (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {boxItemEpcs.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-1.5 bg-slate-900/30 rounded text-sm"
                        >
                          <span className="font-mono text-slate-300">{item}</span>
                          <button
                            onClick={() => removeBoxItem(i)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Step 2: EPC from Reader */}
            <div className={`mb-4 p-4 rounded-xl border-2 border-dashed transition-colors ${
              epc
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-blue-500/40 bg-blue-500/5'
            }`}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {tagType === 'graduate' ? 'Step 2: ' : ''}Scan Tag (place on WD01 reader)
              </label>
              <div className="flex gap-2">
                <input
                  ref={epcInputRef}
                  type="text"
                  value={epc}
                  onChange={e => {
                    const val = e.target.value;
                    setEpc(val);
                    // Auto-link when full EPC length detected (32 = WD01 TID, 24 = UHF EPC)
                    const trimmed = val.trim();
                    if (autoLinkEnabled && (trimmed.length === 32 || trimmed.length === 24)) {
                      const now = Date.now();
                      // Duplicate prevention
                      if (trimmed.toUpperCase() === lastScannedEpc.current && now - lastScannedTime.current < 3000) {
                        console.log('[Encode] Duplicate read ignored:', trimmed.slice(0, 12));
                        setEpc('');
                        return;
                      }
                      lastScannedEpc.current = trimmed.toUpperCase();
                      lastScannedTime.current = now;
                      // Small delay to let state settle
                      setTimeout(() => {
                        autoLinkRef.current?.(trimmed);
                      }, 200);
                    }
                  }}
                  onKeyDown={handleEpcKeyDown}
                  placeholder="Click here, then place tag on reader..."
                  className={`flex-1 px-3 py-3 bg-slate-900/50 border rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none font-mono text-sm ${
                    epc
                      ? 'border-green-500/50 bg-green-500/5'
                      : 'border-slate-600 focus:border-blue-400 animate-pulse focus:animate-none'
                  }`}
                />
                {epc && (
                  <button
                    onClick={() => {
                      setEpc('');
                      epcInputRef.current?.focus();
                    }}
                    className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Clear and re-scan"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {epc
                  ? `Tag scanned: ${epc.length} characters`
                  : 'The reader will type the tag EPC automatically when you place a label on it'}
              </p>
            </div>

            {/* Error / Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-300">{successMessage}</p>
              </div>
            )}

            {/* Encode Button */}
            <button
              onClick={handlePrepareEncode}
              disabled={loading || !epc.trim() || !encodedBy.trim()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Radio className="w-5 h-5" />
                  {autoLinkEnabled
                    ? `#${encodedTags.length + 1} Link Tag to Certificate`
                    : 'Link Tag to Certificate'}
                </>
              )}
            </button>
            {autoLinkEnabled && (
              <p className="text-xs text-center text-slate-500 mt-2">
                Auto-link is ON — reader scan will link automatically without clicking this button
              </p>
            )}
          </div>

          {/* Encoded Tags History */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" />
              Session History
              {encodedTags.length > 0 && (
                <span className="ml-auto text-sm font-normal text-slate-400">
                  {encodedTags.length} tags
                </span>
              )}
            </h2>

            {encodedTags.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No tags encoded in this session</p>
                <p className="text-sm mt-1">Encoded tags will appear here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {encodedTags.map((tag, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {tag.type === 'box' ? (
                        <Box className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Tag className="w-4 h-4 text-blue-400" />
                      )}
                      <span className="font-mono text-xs text-slate-400 truncate max-w-[180px]">
                        {tag.epc}
                      </span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        Linked
                      </span>
                    </div>
                    {tag.convocationNumber && (
                      <p className="text-sm font-medium text-blue-300 ml-6">
                        {tag.convocationNumber}
                      </p>
                    )}
                    {tag.graduateName && (
                      <p className="text-sm text-slate-400 ml-6">{tag.graduateName}</p>
                    )}
                    {tag.boxId && (
                      <p className="text-xs text-slate-500 ml-6">Box ID: {tag.boxId}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && pendingEncode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-lg font-semibold">Confirm Tag Linking</h3>
            </div>

            <div className="space-y-2 mb-6 p-4 bg-slate-900/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tag EPC:</span>
                <span className="font-mono text-xs max-w-[200px] truncate">
                  {pendingEncode.epc}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Type:</span>
                <span className="capitalize">{pendingEncode.type}</span>
              </div>
              {pendingEncode.convocationNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Conv. Number:</span>
                  <span className="font-mono font-medium text-blue-300">
                    {pendingEncode.convocationNumber}
                  </span>
                </div>
              )}
              {lookupName && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Graduate:</span>
                  <span className="text-green-300">{lookupName}</span>
                </div>
              )}
              {pendingEncode.boxId && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Box ID:</span>
                  <span>{pendingEncode.boxId}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Encoded By:</span>
                <span>{encodedBy}</span>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6">
              This will permanently link this physical tag to the{' '}
              {pendingEncode.type === 'graduate' ? 'graduate certificate' : 'box'}. Make sure
              you stick this label on the correct certificate.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingEncode(null);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEncode}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Confirm & Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
