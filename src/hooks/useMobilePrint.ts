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
  isLoading: boolean;
  state: MobilePrintState;
  error: string | null;

  // Settings
  settings: MobilePrinterSettings;
  saveSettings: (settings: MobilePrinterSettings) => void;
  refreshSettings: () => void;

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

// Load settings from localStorage (runs once at module load)
function getInitialSettings(): MobilePrinterSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(MOBILE_PRINTER_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (err) {
    console.error('[MobilePrint] Failed to load settings:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Hook for mobile printing via server-side network connection
 *
 * This bypasses Zebra Browser Print and sends ZPL directly to the network printer
 * via the server API. Works on mobile devices!
 */
export function useMobilePrint(): UseMobilePrintReturn {
  const [settings, setSettings] = useState<MobilePrinterSettings>(getInitialSettings);
  const [state, setState] = useState<MobilePrintState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refresh settings from localStorage
  const refreshSettings = useCallback(() => {
    const loaded = getInitialSettings();
    setSettings(loaded);
    console.log('[MobilePrint] Settings refreshed:', loaded);
  }, []);

  // Ensure settings are loaded on client side and listen for changes
  useEffect(() => {
    const loaded = getInitialSettings();
    setSettings(loaded);
    setIsLoaded(true);

    // Listen for storage changes from other components/tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === MOBILE_PRINTER_SETTINGS_KEY && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          setSettings({ ...DEFAULT_SETTINGS, ...newSettings });
          console.log('[MobilePrint] Settings synced from storage event:', newSettings);
        } catch (err) {
          console.error('[MobilePrint] Failed to parse storage event:', err);
        }
      }
    };

    // Listen for same-tab custom event
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<MobilePrinterSettings>;
      if (customEvent.detail) {
        setSettings({ ...DEFAULT_SETTINGS, ...customEvent.detail });
        console.log('[MobilePrint] Settings synced from custom event:', customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('mobilePrintSettingsChanged', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('mobilePrintSettingsChanged', handleCustomEvent);
    };
  }, []);

  // Save settings to localStorage and dispatch event for same-tab sync
  const saveSettings = useCallback((newSettings: MobilePrinterSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(MOBILE_PRINTER_SETTINGS_KEY, JSON.stringify(newSettings));
      // Dispatch custom event for same-tab sync (storage event only fires for other tabs)
      window.dispatchEvent(new CustomEvent('mobilePrintSettingsChanged', { detail: newSettings }));
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

  // Print graduate badge - reads fresh settings from localStorage to avoid stale closures
  const printBadge = useCallback(
    async (graduate: Graduate): Promise<boolean> => {
      setState('printing');
      setError(null);

      try {
        // Read fresh settings from localStorage
        const freshSettings = getInitialSettings();
        const printerIP = freshSettings.ip;
        const printerPort = freshSettings.port;

        // Generate badge data from graduate
        const badgeData: ConvocationBadgeData = {
          name: graduate.name,
          course: graduate.course,
          convocationNumber: graduate.convocationNumber || 'N/A',
          registrationId: graduate.ticketSlug || graduate.registrationNumber,
        };

        const zpl = generateConvocationBadgeZPL(badgeData);

        console.log(`[MobilePrint] Printing badge for ${graduate.name} to ${printerIP}:${printerPort}`);

        const response = await fetch('/api/print/zpl/raw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zpl,
            printerIP,
            printerPort,
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
    [] // No dependencies - always reads fresh from localStorage
  );

  return {
    isConfigured: settings.enabled && settings.ip.length > 0,
    isLoading: !isLoaded,
    state,
    error,
    settings,
    saveSettings,
    refreshSettings,
    printBadge,
    printTestLabel,
    testConnection,
  };
}
