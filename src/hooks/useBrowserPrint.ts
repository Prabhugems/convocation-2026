'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getBrowserPrintStatus,
  getDefaultPrinter,
  printZPL,
  printToDefaultPrinter,
  BrowserPrintStatus,
  ZebraPrinter,
} from '@/lib/zebra-browser-print';
import {
  generateConvocationBadgeZPL,
  generateTestZPL,
  ConvocationBadgeData,
} from '@/lib/zpl-badge-generator';
import { Graduate } from '@/types';

export type BrowserPrintState = 'idle' | 'checking' | 'printing' | 'success' | 'error';

export interface UseBrowserPrintReturn {
  // Status
  isRunning: boolean;
  isChecking: boolean;
  state: BrowserPrintState;
  error: string | null;

  // Printers
  printers: ZebraPrinter[];
  selectedPrinter: ZebraPrinter | null;
  setSelectedPrinter: (printer: ZebraPrinter | null) => void;

  // Actions
  checkStatus: () => Promise<void>;
  printBadge: (graduate: Graduate) => Promise<boolean>;
  printTestLabel: () => Promise<boolean>;
  printRawZPL: (zpl: string) => Promise<boolean>;
}

export function useBrowserPrint(): UseBrowserPrintReturn {
  const [status, setStatus] = useState<BrowserPrintStatus | null>(null);
  const [state, setState] = useState<BrowserPrintState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<ZebraPrinter | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Check Browser Print status
  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setState('checking');
    setError(null);

    try {
      const result = await getBrowserPrintStatus();
      setStatus(result);

      if (result.running) {
        if (result.printers.length > 0 && !selectedPrinter) {
          // Auto-select default or first printer
          setSelectedPrinter(result.defaultPrinter || result.printers[0]);
        }
        setState('idle');
      } else {
        setError(result.error || 'Browser Print is not running');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status');
      setState('error');
    } finally {
      setIsChecking(false);
    }
  }, [selectedPrinter]);

  // Check on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Print a graduate badge
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

        let result;
        if (selectedPrinter) {
          result = await printZPL(selectedPrinter, zpl);
        } else {
          result = await printToDefaultPrinter(zpl);
          if (result.printer) {
            setSelectedPrinter(result.printer);
          }
        }

        if (result.success) {
          setState('success');
          // Reset to idle after 2 seconds
          setTimeout(() => setState('idle'), 2000);
          return true;
        } else {
          setError(result.error || 'Print failed');
          setState('error');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Print failed');
        setState('error');
        return false;
      }
    },
    [selectedPrinter]
  );

  // Print test label
  const printTestLabel = useCallback(async (): Promise<boolean> => {
    setState('printing');
    setError(null);

    try {
      const zpl = generateTestZPL();

      let result;
      if (selectedPrinter) {
        result = await printZPL(selectedPrinter, zpl);
      } else {
        result = await printToDefaultPrinter(zpl);
        if (result.printer) {
          setSelectedPrinter(result.printer);
        }
      }

      if (result.success) {
        setState('success');
        setTimeout(() => setState('idle'), 2000);
        return true;
      } else {
        setError(result.error || 'Print failed');
        setState('error');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed');
      setState('error');
      return false;
    }
  }, [selectedPrinter]);

  // Print raw ZPL
  const printRawZPL = useCallback(
    async (zpl: string): Promise<boolean> => {
      setState('printing');
      setError(null);

      try {
        let result;
        if (selectedPrinter) {
          result = await printZPL(selectedPrinter, zpl);
        } else {
          result = await printToDefaultPrinter(zpl);
          if (result.printer) {
            setSelectedPrinter(result.printer);
          }
        }

        if (result.success) {
          setState('success');
          setTimeout(() => setState('idle'), 2000);
          return true;
        } else {
          setError(result.error || 'Print failed');
          setState('error');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Print failed');
        setState('error');
        return false;
      }
    },
    [selectedPrinter]
  );

  return {
    isRunning: status?.running || false,
    isChecking,
    state,
    error,
    printers: status?.printers || [],
    selectedPrinter,
    setSelectedPrinter,
    checkStatus,
    printBadge,
    printTestLabel,
    printRawZPL,
  };
}
