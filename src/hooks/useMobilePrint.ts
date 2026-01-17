'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  generateConvocationBadgeZPL,
  generateTestZPL,
  ConvocationBadgeData,
} from '@/lib/zpl-badge-generator';
import { Graduate } from '@/types';

// Storage key for mobile printer settings
const MOBILE_PRINTER_SETTINGS_KEY = 'mobile-printer-settings';

export interface MobilePrinterSettings {
  ip: string;
  port: number;
  enabled: boolean;
}

export type MobilePrintState = 'idle' | 'printing' | 'success' | 'error';

export interface UseMobilePrintReturn {
  // Status
  isConfigured: boolean;
  state: MobilePrintState;
  error: string | null;

  // Settings
  settings: MobilePrinterSettings;
  saveSettings: (settings: MobilePrinterSettings) => void;

  // Actions
  printBadge: (graduate: Graduate) => Promise<boolean>;
  printTestLabel: () => Promise<boolean>;
  testConnection: () => Promise<boolean>;
}

const DEFAULT_SETTINGS: MobilePrinterSettings = {
  ip: '10.0.1.12',
  port: 9100,
  enabled: false,
};

/**
 * Hook for mobile printing via server-side network connection
 *
 * This bypasses Zebra Browser Print and sends ZPL directly to the network printer
 * via the server API. Works on mobile devices!
 */
export function useMobilePrint(): UseMobilePrintReturn {
  const [settings, setSettings] = useState<MobilePrinterSettings>(DEFAULT_SETTINGS);
  const [state, setState] = useState<MobilePrintState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MOBILE_PRINTER_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      console.error('[MobilePrint] Failed to load settings:', err);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: MobilePrinterSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(MOBILE_PRINTER_SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (err) {
      console.error('[MobilePrint] Failed to save settings:', err);
    }
  }, []);

  // Test printer connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    setState('printing');
    setError(null);

    try {
      const response = await fetch(
        `/api/print/zpl?ip=${settings.ip}&port=${settings.port}&action=test`
      );
      const data = await response.json();

      if (data.success) {
        setState('success');
        setTimeout(() => setState('idle'), 2000);
        return true;
      } else {
        setError(data.error || 'Connection failed');
        setState('error');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setState('error');
      return false;
    }
  }, [settings.ip, settings.port]);

  // Print test label
  const printTestLabel = useCallback(async (): Promise<boolean> => {
    setState('printing');
    setError(null);

    try {
      const zpl = generateTestZPL();

      const response = await fetch('/api/print/zpl/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zpl,
          printerIP: settings.ip,
          printerPort: settings.port,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setState('success');
        setTimeout(() => setState('idle'), 2000);
        return true;
      } else {
        setError(data.error || 'Print failed');
        setState('error');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setState('error');
      return false;
    }
  }, [settings.ip, settings.port]);

  // Print graduate badge
  const printBadge = useCallback(
    async (graduate: Graduate): Promise<boolean> => {
      setState('printing');
      setError(null);

      try {
        // Generate badge data from graduate
        const badgeData: ConvocationBadgeData = {
          name: graduate.name,
          course: graduate.course,
          convocationNumber: graduate.convocationNumber || 'N/A',
          registrationId: graduate.ticketSlug || graduate.registrationNumber,
        };

        const zpl = generateConvocationBadgeZPL(badgeData);

        console.log(`[MobilePrint] Printing badge for ${graduate.name} to ${settings.ip}:${settings.port}`);

        const response = await fetch('/api/print/zpl/raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zpl,
            printerIP: settings.ip,
            printerPort: settings.port,
          }),
        });

        const data = await response.json();

        if (data.success) {
          console.log(`[MobilePrint] Badge printed successfully for ${graduate.convocationNumber}`);
          setState('success');
          setTimeout(() => setState('idle'), 2000);
          return true;
        } else {
          console.error(`[MobilePrint] Print failed:`, data.error);
          setError(data.error || 'Print failed');
          setState('error');
          return false;
        }
      } catch (err) {
        console.error('[MobilePrint] Error:', err);
        setError(err instanceof Error ? err.message : 'Network error');
        setState('error');
        return false;
      }
    },
    [settings.ip, settings.port]
  );

  return {
    isConfigured: settings.enabled && settings.ip.length > 0,
    state,
    error,
    settings,
    saveSettings,
    printBadge,
    printTestLabel,
    testConnection,
  };
}
