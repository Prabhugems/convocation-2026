/**
 * Zebra ZPL Print Client Utilities
 *
 * Copy this file to: src/lib/zebra-client.ts
 *
 * Client-side utilities for interacting with the Zebra print API.
 * Works with the api-route.ts API endpoint.
 */

// Label sizes in dots (203 DPI)
export const LABEL_SIZES = {
  '4x6': { width: 812, height: 1218, inches: '4" x 6"' },
  '4x3': { width: 812, height: 609, inches: '4" x 3"' },
  '4x2': { width: 812, height: 406, inches: '4" x 2"' },
  '3x2': { width: 609, height: 406, inches: '3" x 2"' },
  '2x1': { width: 406, height: 203, inches: '2" x 1"' },
} as const;

export type LabelSize = keyof typeof LABEL_SIZES;

export interface BadgeData {
  name: string;
  title?: string;
  company?: string;
  badge_type?: string;
  badge_id?: string;
  event_name?: string;
  paper_size?: LabelSize;
  rotation?: 0 | 180;
}

export interface PrintResult {
  success: boolean;
  message?: string;
  error?: string;
  printer?: {
    ip: string;
    port: number;
  };
}

export interface ZebraPrinterConfig {
  ip: string;
  port?: number;
  apiEndpoint?: string;
}

const DEFAULT_API_ENDPOINT = '/api/zebra-print';
const DEFAULT_PORT = 9100;

/**
 * Test connection to a Zebra printer
 * Sends a test label to verify connectivity
 */
export async function testZebraPrinter(
  printerIP: string,
  printerPort: number = DEFAULT_PORT,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<PrintResult> {
  try {
    const response = await fetch(
      `${apiEndpoint}?ip=${encodeURIComponent(printerIP)}&port=${printerPort}&action=test`
    );
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Print a badge/label to a Zebra printer
 */
export async function printBadge(
  printerIP: string,
  data: BadgeData,
  printerPort: number = DEFAULT_PORT,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<PrintResult> {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_ip: printerIP,
        printer_port: printerPort,
        data,
      }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Send raw ZPL code to a Zebra printer
 */
export async function printRawZPL(
  printerIP: string,
  zpl: string,
  printerPort: number = DEFAULT_PORT,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<PrintResult> {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_ip: printerIP,
        printer_port: printerPort,
        zpl,
      }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Calibrate printer sensors (run when loading new label stock)
 */
export async function calibratePrinter(
  printerIP: string,
  printerPort: number = DEFAULT_PORT,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<PrintResult> {
  try {
    const response = await fetch(
      `${apiEndpoint}?ip=${encodeURIComponent(printerIP)}&port=${printerPort}&action=calibrate`
    );
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Clear the printer's job queue
 */
export async function clearPrintQueue(
  printerIP: string,
  printerPort: number = DEFAULT_PORT,
  apiEndpoint: string = DEFAULT_API_ENDPOINT
): Promise<PrintResult> {
  try {
    const response = await fetch(
      `${apiEndpoint}?ip=${encodeURIComponent(printerIP)}&port=${printerPort}&action=clear-queue`
    );
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * ZebraPrinter class for object-oriented usage
 */
export class ZebraPrinter {
  private ip: string;
  private port: number;
  private apiEndpoint: string;

  constructor(config: ZebraPrinterConfig) {
    this.ip = config.ip;
    this.port = config.port || DEFAULT_PORT;
    this.apiEndpoint = config.apiEndpoint || DEFAULT_API_ENDPOINT;
  }

  async test(): Promise<PrintResult> {
    return testZebraPrinter(this.ip, this.port, this.apiEndpoint);
  }

  async printBadge(data: BadgeData): Promise<PrintResult> {
    return printBadge(this.ip, data, this.port, this.apiEndpoint);
  }

  async printRawZPL(zpl: string): Promise<PrintResult> {
    return printRawZPL(this.ip, zpl, this.port, this.apiEndpoint);
  }

  async calibrate(): Promise<PrintResult> {
    return calibratePrinter(this.ip, this.port, this.apiEndpoint);
  }

  async clearQueue(): Promise<PrintResult> {
    return clearPrintQueue(this.ip, this.port, this.apiEndpoint);
  }

  getConfig(): ZebraPrinterConfig {
    return {
      ip: this.ip,
      port: this.port,
      apiEndpoint: this.apiEndpoint,
    };
  }

  setIP(ip: string): void {
    this.ip = ip;
  }

  setPort(port: number): void {
    this.port = port;
  }
}

/**
 * React hook for Zebra printer (for use in components)
 * Note: This is a simplified hook. For a full-featured hook with
 * state management, see the usePrinter hook in the main project.
 */
export function createPrinterHook(initialIP: string = '', initialPort: number = DEFAULT_PORT) {
  return {
    printer: new ZebraPrinter({ ip: initialIP, port: initialPort }),
    testConnection: () => testZebraPrinter(initialIP, initialPort),
    print: (data: BadgeData) => printBadge(initialIP, data, initialPort),
  };
}
