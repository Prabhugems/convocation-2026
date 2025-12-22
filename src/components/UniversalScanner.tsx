'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  RotateCcw,
  Search,
  ChevronDown,
  Loader2,
  SwitchCamera,
  Keyboard,
  AlertCircle,
  ShieldAlert,
  VideoOff,
} from 'lucide-react';

interface UniversalScannerProps {
  onSearch: (query: string, type: SearchInputType) => void;
  onError?: (error: string) => void;
  className?: string;
  placeholder?: string;
  loading?: boolean;
}

export type SearchInputType =
  | 'convocation_number'
  | 'name'
  | 'tito_url'
  | 'tito_ticket_id'
  | 'mobile'
  | 'reference'
  | 'barcode'
  | 'unknown';

type CameraStatus = 'idle' | 'requesting' | 'scanning' | 'denied' | 'not_found' | 'error';

// Storage key for camera preference
const CAMERA_PREFERENCE_KEY = 'scanner_camera_id';

// Detect input type
export function detectInputType(input: string): SearchInputType {
  const trimmed = input.trim();

  if (trimmed.includes('ti.to/') || trimmed.includes('tito.io/')) {
    return 'tito_url';
  }

  if (/^ti_[a-zA-Z0-9]+$/i.test(trimmed)) {
    return 'tito_ticket_id';
  }

  if (/^(\+91|0)?[6-9]\d{9}$/.test(trimmed.replace(/[\s-]/g, ''))) {
    return 'mobile';
  }

  if (/^\d{2,3}[a-zA-Z]{2,4}\d{3,5}$/i.test(trimmed)) {
    return 'convocation_number';
  }

  if (/^[A-Z0-9]{3,6}$/i.test(trimmed) && trimmed.length <= 6) {
    return 'reference';
  }

  if (/^[a-zA-Z\s.]+$/.test(trimmed) && trimmed.includes(' ')) {
    return 'name';
  }

  if (/^\d{8,20}$/.test(trimmed)) {
    return 'barcode';
  }

  return 'unknown';
}

export function extractTicketFromUrl(url: string): string | null {
  const match = url.match(/ti_[a-zA-Z0-9]+/);
  return match ? match[0] : null;
}

// Get friendly camera name
function getCameraLabel(camera: CameraDevice, index: number): string {
  const label = camera.label.toLowerCase();

  // iOS/Safari labels
  if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
    return 'Back Camera';
  }
  if (label.includes('front') || label.includes('user') || label.includes('facetime')) {
    return 'Front Camera';
  }

  // Check for common patterns
  if (label.includes('webcam')) {
    return 'Webcam';
  }
  if (label.includes('obs') || label.includes('virtual')) {
    return 'Virtual Camera';
  }
  if (label.includes('usb') || label.includes('external')) {
    return 'External Camera';
  }

  // Use the actual label if it's descriptive
  if (camera.label && camera.label.length > 0 && camera.label.length < 30) {
    return camera.label;
  }

  return `Camera ${index + 1}`;
}

// Determine camera type for sorting
function getCameraType(camera: CameraDevice): 'back' | 'front' | 'external' | 'virtual' | 'other' {
  const label = camera.label.toLowerCase();

  if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
    return 'back';
  }
  if (label.includes('front') || label.includes('user') || label.includes('facetime')) {
    return 'front';
  }
  if (label.includes('obs') || label.includes('virtual') || label.includes('snap')) {
    return 'virtual';
  }
  if (label.includes('usb') || label.includes('external') || label.includes('webcam')) {
    return 'external';
  }

  return 'other';
}

export default function UniversalScanner({
  onSearch,
  onError,
  className = '',
  placeholder = 'Enter Name, Conv. No, Mobile, or scan QR/Barcode',
  loading = false,
}: UniversalScannerProps) {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [showCameraSelect, setShowCameraSelect] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [camerasLoaded, setCamerasLoaded] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const [scanCount, setScanCount] = useState(0);
  const [justDetected, setJustDetected] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'processing'>('idle');
  const [scanAttempts, setScanAttempts] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved camera preference
  useEffect(() => {
    const saved = localStorage.getItem(CAMERA_PREFERENCE_KEY);
    if (saved) {
      setSelectedCameraId(saved);
    }
  }, []);

  // Request camera permission and get cameras list
  const requestCameraPermission = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      // First, request camera permission using getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());

      // Now get the list of cameras
      const devices = await Html5Qrcode.getCameras();

      if (devices.length === 0) {
        return [];
      }

      // Sort cameras: back first, then front, then external, then virtual
      const sortOrder = { back: 0, front: 1, external: 2, other: 3, virtual: 4 };
      devices.sort((a, b) => {
        const typeA = getCameraType(a);
        const typeB = getCameraType(b);
        return sortOrder[typeA] - sortOrder[typeB];
      });

      return devices;
    } catch (error) {
      console.error('Camera permission error:', error);
      throw error;
    }
  }, []);

  // Initialize cameras on mount
  useEffect(() => {
    async function initCameras() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices.length > 0) {
          const sortOrder = { back: 0, front: 1, external: 2, other: 3, virtual: 4 };
          devices.sort((a, b) => {
            const typeA = getCameraType(a);
            const typeB = getCameraType(b);
            return sortOrder[typeA] - sortOrder[typeB];
          });
          setCameras(devices);

          // Set default camera if not already set
          const savedId = localStorage.getItem(CAMERA_PREFERENCE_KEY);
          if (savedId && devices.find(d => d.id === savedId)) {
            setSelectedCameraId(savedId);
          } else if (devices.length > 0) {
            setSelectedCameraId(devices[0].id);
          }
        }
      } catch {
        // Camera enumeration might fail without permission - that's ok
      }
      setCamerasLoaded(true);
    }

    initCameras();
  }, []);

  // Stop any running scanner
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
      try {
        scannerRef.current.clear();
      } catch {
        // Ignore clear errors
      }
      scannerRef.current = null;
    }
    setCameraStatus('idle');
  }, []);

  // Start camera with specific device
  const startCamera = useCallback(async (cameraId?: string) => {
    // Stop any existing scanner first
    await stopScanner();

    setCameraStatus('requesting');
    setErrorMessage('');

    try {
      // Get cameras if we don't have them
      let availableCameras = cameras;
      if (availableCameras.length === 0) {
        availableCameras = await requestCameraPermission();
        setCameras(availableCameras);
      }

      if (availableCameras.length === 0) {
        setCameraStatus('not_found');
        setErrorMessage('No cameras found on this device.');
        return;
      }

      // Determine which camera to use
      const targetCameraId = cameraId || selectedCameraId || availableCameras[0].id;

      // Verify the camera exists
      const targetCamera = availableCameras.find(c => c.id === targetCameraId);
      if (!targetCamera) {
        // Fall back to first camera
        setSelectedCameraId(availableCameras[0].id);
      }

      const finalCameraId = targetCamera ? targetCameraId : availableCameras[0].id;

      // Create new scanner - focus on QR_CODE primarily
      console.log('[QR Scanner] Creating scanner with camera:', finalCameraId);

      const scanner = new Html5Qrcode('qr-reader-universal', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
        verbose: true, // Enable verbose for debugging
      });

      scannerRef.current = scanner;
      setScanStatus('scanning');
      setScanAttempts(0);

      // Smaller, focused scan area for better detection
      const qrboxSize = 200;

      console.log('[QR Scanner] Starting with config:', {
        cameraId: finalCameraId,
        qrbox: qrboxSize,
        fps: 10,
      });

      let attemptCounter = 0;

      await scanner.start(
        finalCameraId,
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1,
        },
        (decodedText, decodedResult) => {
          // SUCCESS! QR/Barcode detected
          console.log('');
          console.log('╔════════════════════════════════════════╗');
          console.log('║  🎉 QR CODE DETECTED!                  ║');
          console.log('╠════════════════════════════════════════╣');
          console.log('║ Value:', decodedText);
          console.log('║ Format:', decodedResult?.result?.format?.formatName || 'Unknown');
          console.log('╚════════════════════════════════════════╝');
          console.log('');

          setScanStatus('found');

          // Play beep sound
          try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            oscillator.start();
            setTimeout(() => {
              oscillator.stop();
              audioContext.close();
            }, 150);
          } catch (e) {
            // Audio not supported
          }

          // Update UI state with visual feedback
          setLastScanned(decodedText);
          setScanCount(prev => prev + 1);
          setJustDetected(true);
          setTimeout(() => setJustDetected(false), 1000);

          setScanStatus('processing');

          // Process the scanned value
          const inputType = detectInputType(decodedText);
          console.log('');
          console.log('╔════════════════════════════════════════════════════════╗');
          console.log('║  📤 SENDING TO API                                     ║');
          console.log('╠════════════════════════════════════════════════════════╣');
          console.log('║ Raw scanned value:', decodedText);
          console.log('║ Detected type:', inputType);

          if (inputType === 'tito_url') {
            const ticketId = extractTicketFromUrl(decodedText);
            console.log('║ Extracted ticket ID:', ticketId);
            console.log('║ Calling onSearch with:', ticketId || decodedText);
            console.log('╚════════════════════════════════════════════════════════╝');
            if (ticketId) {
              onSearch(ticketId, 'tito_ticket_id');
            } else {
              onSearch(decodedText, inputType);
            }
          } else {
            console.log('║ Calling onSearch with:', decodedText);
            console.log('╚════════════════════════════════════════════════════════╝');
            onSearch(decodedText, inputType);
          }

          setTimeout(() => setScanStatus('scanning'), 2000);
        },
        (errorMessage) => {
          // Log every 50th scan attempt to show scanner is working
          attemptCounter++;
          if (attemptCounter % 50 === 0) {
            console.log(`[QR Scanner] Scanning... (${attemptCounter} frames checked, no QR found)`);
            setScanAttempts(attemptCounter);
          }
        }
      );

      console.log('[QR Scanner] ✅ Scanner started successfully');
      console.log('[QR Scanner] Point camera at QR code. Check console for "QR CODE DETECTED" message.');

      // Save preference and update state
      localStorage.setItem(CAMERA_PREFERENCE_KEY, finalCameraId);
      setSelectedCameraId(finalCameraId);
      setCameraStatus('scanning');

    } catch (error) {
      console.error('Camera start error:', error);

      const err = error as Error;

      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setCameraStatus('denied');
        setErrorMessage('Camera access denied. Please allow camera permission in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        setCameraStatus('not_found');
        setErrorMessage('Selected camera not found. Please choose another camera.');
      } else if (err.name === 'NotReadableError' || err.message?.includes('Could not start video source')) {
        setCameraStatus('error');
        setErrorMessage('Camera is in use by another application. Please close other apps using the camera.');
      } else {
        setCameraStatus('error');
        setErrorMessage(err.message || 'Failed to start camera. Please try again.');
      }

      onError?.(errorMessage || err.message);
    }
  }, [cameras, selectedCameraId, requestCameraPermission, stopScanner, onSearch, onError, errorMessage]);

  // Switch to a different camera
  const switchCamera = useCallback(async (cameraId: string) => {
    setShowCameraSelect(false);
    if (cameraId !== selectedCameraId) {
      await startCamera(cameraId);
    }
  }, [selectedCameraId, startCamera]);

  // Handle search form submit
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || loading) return;

    const inputType = detectInputType(searchInput.trim());
    if (inputType === 'tito_url') {
      const ticketId = extractTicketFromUrl(searchInput.trim());
      if (ticketId) {
        onSearch(ticketId, 'tito_ticket_id');
      } else {
        onSearch(searchInput.trim(), inputType);
      }
    } else {
      onSearch(searchInput.trim(), inputType);
    }

    setSearchInput('');
  }, [searchInput, loading, onSearch]);

  // External barcode scanner support (keyboard input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;

      if (e.key === 'Enter' && barcodeBuffer) {
        e.preventDefault();
        const inputType = detectInputType(barcodeBuffer);
        onSearch(barcodeBuffer, inputType);
        setBarcodeBuffer('');
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (timeDiff < 100 || barcodeBuffer.length > 0) {
          setBarcodeBuffer(prev => prev + e.key);
          setLastKeyTime(now);

          if (barcodeTimeoutRef.current) {
            clearTimeout(barcodeTimeoutRef.current);
          }
          barcodeTimeoutRef.current = setTimeout(() => {
            setBarcodeBuffer('');
          }, 500);
        } else {
          setLastKeyTime(now);
          setBarcodeBuffer(e.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [lastKeyTime, barcodeBuffer, onSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showCameraSelect) {
        setShowCameraSelect(false);
      }
    };

    if (showCameraSelect) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCameraSelect]);

  const currentCamera = cameras.find(c => c.id === selectedCameraId);
  const hasCameras = cameras.length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Camera View */}
      <div className="relative">
        <div
          id="qr-reader-universal"
          ref={containerRef}
          className={`w-full aspect-square bg-black/50 rounded-xl overflow-hidden transition-all duration-300 ${
            justDetected ? 'ring-4 ring-green-500 ring-opacity-100' : ''
          }`}
        />

        {/* Detection Flash Overlay */}
        {justDetected && (
          <div className="absolute inset-0 bg-green-500/30 rounded-xl pointer-events-none animate-pulse" />
        )}

        {/* Idle State - Start Camera */}
        {cameraStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <Camera className="w-16 h-16 text-white/50 mb-4" />
            <button
              onClick={() => startCamera()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              Start Camera
            </button>
            <p className="mt-3 text-white/40 text-sm">
              Scan QR codes or barcodes
            </p>
          </div>
        )}

        {/* Requesting Permission */}
        {cameraStatus === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl">
            <Loader2 className="w-12 h-12 text-blue-400 mb-4 animate-spin" />
            <p className="text-white font-medium">Requesting camera access...</p>
            <p className="mt-2 text-white/50 text-sm">Please allow camera permission</p>
          </div>
        )}

        {/* Permission Denied */}
        {cameraStatus === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl p-6">
            <ShieldAlert className="w-16 h-16 text-red-400 mb-4" />
            <p className="text-red-400 font-medium text-center">Camera Access Denied</p>
            <p className="mt-2 text-white/60 text-sm text-center">
              Camera access is required for QR scanning.
              <br />Please enable it in your browser settings.
            </p>
            <button
              onClick={() => startCamera()}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* No Camera Found */}
        {cameraStatus === 'not_found' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl p-6">
            <VideoOff className="w-16 h-16 text-yellow-400 mb-4" />
            <p className="text-yellow-400 font-medium text-center">No Camera Found</p>
            <p className="mt-2 text-white/60 text-sm text-center">
              No camera detected on this device.
              <br />Use the search box below instead.
            </p>
          </div>
        )}

        {/* Error State */}
        {cameraStatus === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-xl p-6">
            <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
            <p className="text-red-400 font-medium text-center">Camera Error</p>
            <p className="mt-2 text-white/60 text-sm text-center">{errorMessage}</p>
            <button
              onClick={() => startCamera()}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Scanning State - Camera Active */}
        {cameraStatus === 'scanning' && (
          <>
            {/* Top controls */}
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
              {/* Camera selector */}
              {cameras.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCameraSelect(!showCameraSelect);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur text-white text-sm rounded-lg hover:bg-black/80 transition-all"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    <span className="max-w-[120px] truncate">
                      {currentCamera ? getCameraLabel(currentCamera, cameras.indexOf(currentCamera)) : 'Select Camera'}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showCameraSelect ? 'rotate-180' : ''}`} />
                  </button>

                  {showCameraSelect && (
                    <div
                      className="absolute top-full left-0 mt-1 w-56 bg-gray-900/95 backdrop-blur border border-white/20 rounded-lg shadow-xl z-20 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 border-b border-white/10 text-xs text-white/50 font-medium uppercase">
                        Select Camera
                      </div>
                      {cameras.map((camera, index) => {
                        const cameraType = getCameraType(camera);
                        const isSelected = camera.id === selectedCameraId;

                        return (
                          <button
                            key={camera.id}
                            onClick={() => switchCamera(camera.id)}
                            className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-500/30 text-blue-400'
                                : 'text-white hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{getCameraLabel(camera, index)}</span>
                            {cameraType === 'virtual' && (
                              <span className="text-xs text-white/40 ml-2">Virtual</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Scanning status indicator */}
              <div className={`px-3 py-2 backdrop-blur text-sm rounded-lg flex items-center gap-2 ${
                scanStatus === 'found' ? 'bg-green-500/40 text-green-300' :
                scanStatus === 'processing' ? 'bg-blue-500/40 text-blue-300' :
                'bg-green-500/20 text-green-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  scanStatus === 'found' ? 'bg-green-300' :
                  scanStatus === 'processing' ? 'bg-blue-300 animate-pulse' :
                  'bg-green-400 animate-pulse'
                }`} />
                {scanStatus === 'found' ? 'QR Found!' :
                 scanStatus === 'processing' ? 'Processing...' :
                 `Scanning${scanAttempts > 0 ? ` (${scanAttempts})` : '...'}`}
              </div>
            </div>

            {/* Detection Success Banner */}
            {justDetected && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="px-6 py-4 bg-green-500 text-white text-xl font-bold rounded-xl shadow-2xl animate-bounce">
                  ✓ DETECTED!
                </div>
              </div>
            )}

            {/* Last Scanned Display */}
            {lastScanned && !justDetected && (
              <div className="absolute bottom-16 left-3 right-3 z-10">
                <div className="px-3 py-2 bg-green-500/90 backdrop-blur text-white text-sm rounded-lg">
                  <div className="text-xs opacity-70">Last Scanned (#{scanCount}):</div>
                  <div className="font-mono truncate">{lastScanned}</div>
                </div>
              </div>
            )}

            {/* Bottom controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
              <button
                onClick={stopScanner}
                className="p-3 bg-red-500/80 backdrop-blur text-white rounded-full hover:bg-red-600 transition-all"
                title="Stop Camera"
              >
                <CameraOff className="w-5 h-5" />
              </button>
              <button
                onClick={() => startCamera(selectedCameraId)}
                className="p-3 bg-white/20 backdrop-blur text-white rounded-full hover:bg-white/30 transition-all"
                title="Restart Camera"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* OR Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-white/20" />
        <span className="text-white/40 text-sm font-medium">OR</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      {/* Universal Search Input */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="relative">
          <Keyboard className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-12 pr-24 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={loading || !searchInput.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>

        {/* Input type hint */}
        {searchInput && (
          <div className="mt-2 text-xs text-white/40">
            Detected: {detectInputType(searchInput).replace(/_/g, ' ')}
          </div>
        )}
      </form>

      {/* External scanner hint */}
      {barcodeBuffer && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          External scanner: {barcodeBuffer}...
        </div>
      )}
    </div>
  );
}
