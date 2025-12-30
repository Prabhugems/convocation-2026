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
  calibratePrinter: () => Promise<{ success: boolean; error?: string }>;
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

    // Try direct print if enabled
    if (settings.useDirectPrint) {
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
          // Direct print failed, fall back to browser print
          console.warn('[Printer] Direct print failed, falling back to browser:', result.error);
          setError(result.error);
        }
      } catch (err) {
        console.warn('[Printer] Direct print error, falling back to browser:', err);
        setError(err instanceof Error ? err.message : 'Network error');
      }
    }

    // Fallback: browser print
    try {
      if (type === 'packing') {
        printSticker3x2(graduate, elementRef);
      } else {
        printBadge4x6(graduate, elementRef);
      }
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Print failed');
    }
  }, [settings]);

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

  // Calibrate printer (run when loading new label stock)
  const calibratePrinter = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setStatus('printing');
    setError(null);

    try {
      const response = await fetch(`/api/print/zpl?ip=${settings.ip}&port=${settings.port}&action=calibrate`);
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
    calibratePrinter,
    status,
    error,
  };
}
