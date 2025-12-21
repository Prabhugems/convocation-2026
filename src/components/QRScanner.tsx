'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RotateCcw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function QRScanner({ onScan, onError, className = '' }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanning = async () => {
    if (!containerRef.current) return;

    try {
      setError(null);
      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          onScan(decodedText);
          // Don't stop automatically - let the parent handle it
        },
        () => {
          // Ignore scan failures (happens on every frame without a QR)
        }
      );

      setIsScanning(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        id="qr-reader"
        ref={containerRef}
        className="w-full aspect-square bg-black/50 rounded-xl overflow-hidden"
      />

      {!isScanning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
          <Camera className="w-16 h-16 text-white/50 mb-4" />
          <button
            onClick={startScanning}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Start Camera
          </button>
          {error && (
            <p className="mt-4 text-red-400 text-sm text-center px-4">{error}</p>
          )}
        </div>
      )}

      {isScanning && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          <button
            onClick={stopScanning}
            className="p-3 bg-red-500/80 backdrop-blur text-white rounded-full hover:bg-red-600 transition-all"
            title="Stop Camera"
          >
            <CameraOff className="w-5 h-5" />
          </button>
          <button
            onClick={async () => {
              await stopScanning();
              await startScanning();
            }}
            className="p-3 bg-white/20 backdrop-blur text-white rounded-full hover:bg-white/30 transition-all"
            title="Restart Camera"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
