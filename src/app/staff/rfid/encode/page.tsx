'use client';

import { useState, useCallback } from 'react';
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

  const generateEpc = useCallback(() => {
    if (tagType === 'graduate' && convocationNumber) {
      setEpc(convocationNumber.toUpperCase().trim());
    } else if (tagType === 'box') {
      const id = boxId || String(Date.now()).slice(-6);
      setEpc(`BOX-${id.toUpperCase().trim()}`);
    }
  }, [tagType, convocationNumber, boxId]);

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
        // Scanned a raw convocation number directly
        setConvocationNumber(query.toUpperCase());
        setEpc(query.toUpperCase());
        setTagType('graduate');
        setShowScanner(false);
        setScanLoading(false);
        return;
      }

      if (!ticketSlug) {
        setError(`Could not extract ticket from scanned value: ${query}`);
        setScanLoading(false);
        return;
      }

      // Look up the ticket via API
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

      // Auto-fill the form
      setConvocationNumber(convNum.toUpperCase());
      setEpc(convNum.toUpperCase());
      setTagType('graduate');
      setLookupName(data.data.name || null);
      setShowScanner(false);
      setSuccessMessage(`Scanned: ${data.data.name || convNum}`);
    } catch (err) {
      setError(`Lookup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setScanLoading(false);
    }
  }, []);

  const handlePrepareEncode = () => {
    if (!epc.trim()) {
      setError('EPC is required');
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

    setPendingEncode({
      epc: epc.toUpperCase().trim(),
      type: tagType,
      convocationNumber: tagType === 'graduate' ? convocationNumber.toUpperCase().trim() : undefined,
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

    // Save encodedBy for next time
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

      setSuccessMessage(
        `Tag ${tag.epc} encoded successfully${tag.graduateName ? ` for ${tag.graduateName}` : ''}`
      );

      // Reset form (keep encodedBy)
      setEpc('');
      setConvocationNumber('');
      setBoxId('');
      setBoxLabel('');
      setBoxItemEpcs([]);
      setPendingEncode(null);
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
              Encode UHF RFID tags for graduates and boxes
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Encode Form */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Encode New Tag</h2>
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

            {/* Looked up name display */}
            {lookupName && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">Graduate: <span className="font-medium text-blue-200">{lookupName}</span></p>
              </div>
            )}

            {/* Tag Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Tag Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setTagType('graduate');
                    setEpc('');
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
                    setEpc('');
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

            {/* Graduate Fields */}
            {tagType === 'graduate' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Convocation Number
                </label>
                <input
                  type="text"
                  value={convocationNumber}
                  onChange={e => setConvocationNumber(e.target.value)}
                  placeholder="e.g., 120AEC1003"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                />
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
                      placeholder="e.g., 120AEC1003"
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 uppercase"
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

            {/* EPC Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">EPC Tag ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={epc}
                  onChange={e => setEpc(e.target.value)}
                  placeholder={
                    tagType === 'graduate' ? '118AEC1001' : 'BOX-001'
                  }
                  className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
                <button
                  onClick={generateEpc}
                  className="px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Auto-fill
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {tagType === 'graduate'
                  ? 'Convocation number e.g., 118AEC1001'
                  : 'Format: BOX-{BoxID}'}
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
                  Encoding...
                </>
              ) : (
                <>
                  <Radio className="w-5 h-5" />
                  Encode Tag
                </>
              )}
            </button>
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
                      <span className="font-mono text-sm font-medium">{tag.epc}</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                        Encoded
                      </span>
                    </div>
                    {tag.graduateName && (
                      <p className="text-sm text-slate-400 ml-6">{tag.graduateName}</p>
                    )}
                    {tag.convocationNumber && (
                      <p className="text-xs text-slate-500 ml-6 font-mono">
                        Conv: {tag.convocationNumber}
                      </p>
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
              <h3 className="text-lg font-semibold">Confirm Tag Encoding</h3>
            </div>

            <div className="space-y-2 mb-6 p-4 bg-slate-900/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">EPC:</span>
                <span className="font-mono font-medium">{pendingEncode.epc}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Type:</span>
                <span className="capitalize">{pendingEncode.type}</span>
              </div>
              {pendingEncode.convocationNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Conv. Number:</span>
                  <span className="font-mono">{pendingEncode.convocationNumber}</span>
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
              This will permanently associate this EPC with the{' '}
              {pendingEncode.type === 'graduate' ? 'graduate' : 'box'}. This action cannot be
              undone.
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
                Confirm Encode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
