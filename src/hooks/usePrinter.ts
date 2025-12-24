'use client';

import { useState, useCallback, useEffect } from 'react';
import { Graduate } from '@/types';
import { printSticker3x2, printBadge4x6 } from '@/components/PrintTemplates';

export interface PrinterSettings {
  ip: string;
  port: number;
  useDirectPrint: boolean;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  ip: '10.0.1.12',
  port: 9100,
  useDirectPrint: true,
};

const STORAGE_KEY = 'zebra-printer-settings';

export type PrintStatus = 'idle' | 'printing' | 'success' | 'error';

export interface UsePrinterReturn {
  settings: PrinterSettings;
  updateSettings: (settings: Partial<PrinterSettings>) => void;
  printLabel: (graduate: Graduate, type?: 'packing' | 'badge', elementRef?: HTMLElement | null) => Promise<void>;
  testPrint: () => Promise<{ success: boolean; error?: string }>;
  status: PrintStatus;
  error: string | null;
}

export function usePrinter(): UsePrinterReturn {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<PrintStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch {
          // Invalid JSON, use defaults
        }
      }
    }
  }, []);

  // Save settings to localStorage
  const updateSettings = useCallback((newSettings: Partial<PrinterSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  // Detect mobile devices (including iPads that report as Mac)
  const isMobile = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    // Check standard mobile user agents
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return true;
    }
    // iPadOS 13+ reports as Macintosh - detect via touch points
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
      return true;
    }
    return false;
  }, []);

  // Print a label directly to Zebra printer
  const printLabel = useCallback(async (
    graduate: Graduate,
    type: 'packing' | 'badge' = 'packing',
    elementRef?: HTMLElement | null
  ) => {
    setStatus('printing');
    setError(null);

    // Generate ticket URL
    const ticketUrl = graduate.ticketSlug
      ? `https://ti.to/tickets/${graduate.ticketSlug}`
      : `https://ti.to/amasi/convocation-2026-kolkata/tickets/${graduate.registrationNumber}`;

    // ALWAYS use API print (works on both mobile and desktop)
    // This sends ZPL directly to printer - no browser print dialog
    try {
      const response = await fetch('/api/print/zpl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          convocationNumber: graduate.convocationNumber || 'N/A',
          name: graduate.name,
          ticketUrl,
          course: graduate.course,
          printerIP: settings.ip,
          printerPort: settings.port,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
        return;
      } else {
        console.warn('[Printer] Direct print failed:', result.error);
        setError(result.error);

        // Only fallback to browser print on desktop (mobile browser print doesn't work)
        if (!isMobile()) {
          try {
            if (type === 'packing') {
              printSticker3x2(graduate, elementRef);
            } else {
              printBadge4x6(graduate, elementRef);
            }
            setStatus('success');
            setTimeout(() => setStatus('idle'), 2000);
            return;
          } catch (err) {
            console.error('[Printer] Browser print also failed:', err);
          }
        }

        setStatus('error');
      }
    } catch (err) {
      console.error('[Printer] API error:', err);
      setError(err instanceof Error ? err.message : 'Network error');

      // Only fallback to browser print on desktop
      if (!isMobile()) {
        try {
          if (type === 'packing') {
            printSticker3x2(graduate, elementRef);
          } else {
            printBadge4x6(graduate, elementRef);
          }
          setStatus('success');
          setTimeout(() => setStatus('idle'), 2000);
          return;
        } catch (browserErr) {
          console.error('[Printer] Browser print also failed:', browserErr);
        }
      }

      setStatus('error');
    }
  }, [settings, isMobile]);

  // Test printer connection
  const testPrint = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setStatus('printing');
    setError(null);

    try {
      const response = await fetch(`/api/print/zpl?ip=${settings.ip}&port=${settings.port}`);
      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
        return { success: true };
      } else {
        setStatus('error');
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setStatus('error');
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [settings]);

  return {
    settings,
    updateSettings,
    printLabel,
    testPrint,
    status,
    error,
  };
}
