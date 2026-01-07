'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getBrowserPrintStatus,
  printZPL,
  BrowserPrintStatus,
  ZebraPrinter,
} from '@/lib/zebra-browser-print';
import { generateTestZPL, generateCalibrationZPL } from '@/lib/zpl-badge-generator';
import {
  Printer,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Monitor,
  Usb,
  Wifi,
  Settings,
} from 'lucide-react';
import GlassCard from '@/components/GlassCard';

interface PrinterSetupProps {
  onPrinterReady?: (printer: ZebraPrinter) => void;
  compact?: boolean;
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'error';

export default function PrinterSetup({ onPrinterReady, compact = false }: PrinterSetupProps) {
  const [status, setStatus] = useState<BrowserPrintStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [selectedPrinter, setSelectedPrinter] = useState<ZebraPrinter | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; message: string } | null>(null);

  // Check Browser Print status
  const checkStatus = useCallback(async () => {
    setConnectionStatus('checking');
    setPrintResult(null);

    try {
      const result = await getBrowserPrintStatus();
      setStatus(result);

      if (result.running && result.printers.length > 0) {
        setConnectionStatus('connected');
        // Select default printer or first available
        const printer = result.defaultPrinter || result.printers[0];
        setSelectedPrinter(printer);
        onPrinterReady?.(printer);
      } else if (result.running) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch {
      setConnectionStatus('error');
    }
  }, [onPrinterReady]);

  // Check on mount and periodically
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Print test label
  const handleTestPrint = async () => {
    if (!selectedPrinter) return;

    setPrinting(true);
    setPrintResult(null);

    try {
      const zpl = generateTestZPL();
      const result = await printZPL(selectedPrinter, zpl);

      if (result.success) {
        setPrintResult({ success: true, message: 'Test label printed successfully!' });
      } else {
        setPrintResult({ success: false, message: result.error || 'Print failed' });
      }
    } catch (error) {
      setPrintResult({
        success: false,
        message: error instanceof Error ? error.message : 'Print failed',
      });
    } finally {
      setPrinting(false);
    }
  };

  // Calibrate printer
  const handleCalibrate = async () => {
    if (!selectedPrinter) return;

    setPrinting(true);
    setPrintResult(null);

    try {
      const zpl = generateCalibrationZPL();
      const result = await printZPL(selectedPrinter, zpl);

      if (result.success) {
        setPrintResult({
          success: true,
          message: 'Calibration command sent. Printer will calibrate its sensors.',
        });
      } else {
        setPrintResult({ success: false, message: result.error || 'Calibration failed' });
      }
    } catch (error) {
      setPrintResult({
        success: false,
        message: error instanceof Error ? error.message : 'Calibration failed',
      });
    } finally {
      setPrinting(false);
    }
  };

  // Status indicator
  const StatusIndicator = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="flex items-center gap-2 text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking...</span>
          </div>
        );
      case 'connected':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span>Connected</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span>Not Detected</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span>Error</span>
          </div>
        );
    }
  };

  // Compact view for embedding in other pages
  if (compact) {
    return (
      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="w-5 h-5 text-cyan-400" />
            <StatusIndicator />
          </div>
          <div className="flex items-center gap-2">
            {selectedPrinter && (
              <span className="text-white/60 text-sm">{selectedPrinter.name}</span>
            )}
            <button
              onClick={checkStatus}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-white/50 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {connectionStatus === 'disconnected' && (
          <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
            <p className="text-red-400 text-sm">
              Browser Print not running.{' '}
              <a
                href="/printer-setup"
                className="underline hover:text-red-300"
              >
                Setup instructions
              </a>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Printer className="w-5 h-5 text-cyan-400" />
            </div>
            Zebra Browser Print
          </h2>
          <div className="flex items-center gap-3">
            <StatusIndicator />
            <button
              onClick={checkStatus}
              disabled={connectionStatus === 'checking'}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-5 h-5 text-white ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Not Running - Show Installation */}
        {connectionStatus === 'disconnected' && (
          <div className="space-y-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-medium">Browser Print Not Detected</p>
                  <p className="text-amber-400/70 text-sm mt-1">
                    Zebra Browser Print software must be installed and running on this computer.
                  </p>
                </div>
              </div>
            </div>

            {/* Download Links */}
            <div className="space-y-3">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Browser Print
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href="https://www.zebra.com/content/dam/zebra_new_ia/en-us/software/printer-software/browser-print/zebra-browser-print-windows.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-colors"
                >
                  <Monitor className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-white font-medium">Windows</p>
                    <p className="text-white/50 text-sm">Direct download (.exe)</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
                </a>
                <a
                  href="https://www.zebra.com/us/en/support-downloads/printer-software/browser-print.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <Settings className="w-8 h-8 text-white/60" />
                  <div>
                    <p className="text-white font-medium">All Platforms</p>
                    <p className="text-white/50 text-sm">Zebra downloads page</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/30 ml-auto" />
                </a>
              </div>
            </div>

            {/* Installation Steps */}
            <div className="space-y-3">
              <h3 className="text-white font-medium">Installation Steps</h3>
              <ol className="space-y-3">
                <li className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">
                    1
                  </span>
                  <div>
                    <p className="text-white">Download and install Browser Print</p>
                    <p className="text-white/50 text-sm">Run the installer as Administrator</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">
                    2
                  </span>
                  <div>
                    <p className="text-white">Connect your Zebra printer</p>
                    <p className="text-white/50 text-sm">Via USB or network (same WiFi)</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0">
                    3
                  </span>
                  <div>
                    <p className="text-white">Start Browser Print application</p>
                    <p className="text-white/50 text-sm">Look for Zebra icon in system tray</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Connected - Show Printers */}
        {connectionStatus === 'connected' && (
          <div className="space-y-6">
            {/* Printer List */}
            {status?.printers && status.printers.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-white font-medium">Available Printers</h3>
                <div className="space-y-2">
                  {status.printers.map((printer) => (
                    <button
                      key={printer.uid}
                      onClick={() => {
                        setSelectedPrinter(printer);
                        onPrinterReady?.(printer);
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        selectedPrinter?.uid === printer.uid
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedPrinter?.uid === printer.uid ? 'bg-cyan-500/20' : 'bg-white/10'
                        }`}
                      >
                        {printer.connection === 'usb' ? (
                          <Usb className={`w-5 h-5 ${selectedPrinter?.uid === printer.uid ? 'text-cyan-400' : 'text-white/60'}`} />
                        ) : (
                          <Wifi className={`w-5 h-5 ${selectedPrinter?.uid === printer.uid ? 'text-cyan-400' : 'text-white/60'}`} />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-medium ${selectedPrinter?.uid === printer.uid ? 'text-cyan-400' : 'text-white'}`}>
                          {printer.name}
                        </p>
                        <p className="text-white/50 text-sm">
                          {printer.connection.toUpperCase()} • {printer.manufacturer || 'Zebra'}
                        </p>
                      </div>
                      {selectedPrinter?.uid === printer.uid && (
                        <CheckCircle className="w-5 h-5 text-cyan-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">No Printers Found</p>
                    <p className="text-amber-400/70 text-sm mt-1">
                      Browser Print is running but no Zebra printers are detected. Make sure your printer is connected via USB or on the same network.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Test & Calibrate Buttons */}
            {selectedPrinter && (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleTestPrint}
                  disabled={printing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  Print Test Label
                </button>
                <button
                  onClick={handleCalibrate}
                  disabled={printing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white/70 hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  <Settings className="w-4 h-4" />
                  Calibrate Printer
                </button>
              </div>
            )}

            {/* Print Result */}
            {printResult && (
              <div
                className={`p-4 rounded-xl border ${
                  printResult.success
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {printResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <p className={printResult.success ? 'text-green-400' : 'text-red-400'}>
                    {printResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Troubleshooting */}
      {connectionStatus !== 'checking' && (
        <GlassCard className="p-6">
          <h3 className="text-white font-medium mb-4">Troubleshooting</h3>
          <ul className="space-y-2 text-white/60 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              Make sure Browser Print is running (check system tray)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              Printer must be connected via USB or on the same network
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              Printer language must be set to ZPL (not EPL)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              Try restarting Browser Print if connection issues persist
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">•</span>
              Run Calibrate after loading new label stock
            </li>
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
