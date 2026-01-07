/**
 * Zebra Browser Print Client
 *
 * Communicates with Zebra Browser Print software running locally.
 * Browser Print must be installed on the user's computer.
 *
 * Download: https://www.zebra.com/us/en/support-downloads/printer-software/browser-print.html
 */

// Browser Print endpoints
const BROWSER_PRINT_HTTP = 'http://localhost:9100';
const BROWSER_PRINT_HTTPS = 'https://localhost:9101';

// Timeout for API calls
const API_TIMEOUT = 5000;

export interface ZebraPrinter {
  name: string;
  uid: string;
  connection: string;
  deviceType: string;
  version: number;
  provider: string;
  manufacturer: string;
}

export interface BrowserPrintStatus {
  running: boolean;
  version?: string;
  printers: ZebraPrinter[];
  defaultPrinter?: ZebraPrinter;
  error?: string;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Try to connect to Browser Print (HTTP first, then HTTPS)
 */
async function getBrowserPrintUrl(): Promise<string | null> {
  // Try HTTP first (preferred)
  try {
    const response = await fetchWithTimeout(`${BROWSER_PRINT_HTTP}/available`, {}, 2000);
    if (response.ok) {
      return BROWSER_PRINT_HTTP;
    }
  } catch {
    // HTTP failed, try HTTPS
  }

  // Try HTTPS
  try {
    const response = await fetchWithTimeout(`${BROWSER_PRINT_HTTPS}/available`, {}, 2000);
    if (response.ok) {
      return BROWSER_PRINT_HTTPS;
    }
  } catch {
    // HTTPS also failed
  }

  return null;
}

/**
 * Check if Zebra Browser Print is running
 */
export async function isBrowserPrintRunning(): Promise<boolean> {
  const url = await getBrowserPrintUrl();
  return url !== null;
}

/**
 * Get full Browser Print status including printers
 */
export async function getBrowserPrintStatus(): Promise<BrowserPrintStatus> {
  const baseUrl = await getBrowserPrintUrl();

  if (!baseUrl) {
    return {
      running: false,
      printers: [],
      error: 'Zebra Browser Print is not running. Please install and start it.',
    };
  }

  try {
    // Get available printers
    const availableResponse = await fetchWithTimeout(`${baseUrl}/available`);
    const printers: ZebraPrinter[] = await availableResponse.json();

    // Get default printer
    let defaultPrinter: ZebraPrinter | undefined;
    try {
      const defaultResponse = await fetchWithTimeout(`${baseUrl}/default`);
      if (defaultResponse.ok) {
        defaultPrinter = await defaultResponse.json();
      }
    } catch {
      // No default printer set
    }

    return {
      running: true,
      printers: printers || [],
      defaultPrinter,
    };
  } catch (error) {
    return {
      running: false,
      printers: [],
      error: error instanceof Error ? error.message : 'Failed to get printer status',
    };
  }
}

/**
 * Get list of available Zebra printers
 */
export async function getAvailablePrinters(): Promise<ZebraPrinter[] | null> {
  const baseUrl = await getBrowserPrintUrl();
  if (!baseUrl) return null;

  try {
    const response = await fetchWithTimeout(`${baseUrl}/available`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the default Zebra printer
 */
export async function getDefaultPrinter(): Promise<ZebraPrinter | null> {
  const baseUrl = await getBrowserPrintUrl();
  if (!baseUrl) return null;

  try {
    const response = await fetchWithTimeout(`${baseUrl}/default`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Send ZPL code to a specific printer
 */
export async function printZPL(
  printer: ZebraPrinter,
  zpl: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = await getBrowserPrintUrl();

  if (!baseUrl) {
    return {
      success: false,
      error: 'Browser Print is not running',
    };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        device: printer,
        data: zpl,
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        error: `Print failed: ${errorText || response.statusText}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Print failed',
    };
  }
}

/**
 * Print ZPL to the default printer
 */
export async function printToDefaultPrinter(
  zpl: string
): Promise<{ success: boolean; error?: string; printer?: ZebraPrinter }> {
  const printer = await getDefaultPrinter();

  if (!printer) {
    // Try to get any available printer
    const printers = await getAvailablePrinters();
    if (!printers || printers.length === 0) {
      return {
        success: false,
        error: 'No Zebra printers found. Please connect a printer and refresh.',
      };
    }
    // Use first available printer
    const result = await printZPL(printers[0], zpl);
    return { ...result, printer: printers[0] };
  }

  const result = await printZPL(printer, zpl);
  return { ...result, printer };
}

/**
 * Read data from printer (for status queries)
 */
export async function readFromPrinter(
  printer: ZebraPrinter
): Promise<{ success: boolean; data?: string; error?: string }> {
  const baseUrl = await getBrowserPrintUrl();

  if (!baseUrl) {
    return {
      success: false,
      error: 'Browser Print is not running',
    };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        device: printer,
      }),
    });

    if (response.ok) {
      const data = await response.text();
      return { success: true, data };
    } else {
      return {
        success: false,
        error: 'Failed to read from printer',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Read failed',
    };
  }
}

/**
 * Get printer configuration/status via SGD command
 */
export async function getPrinterConfig(
  printer: ZebraPrinter
): Promise<{ success: boolean; config?: string; error?: string }> {
  // Send host status query
  const queryZpl = '~HS';

  const baseUrl = await getBrowserPrintUrl();
  if (!baseUrl) {
    return { success: false, error: 'Browser Print is not running' };
  }

  try {
    // Write query command
    await printZPL(printer, queryZpl);

    // Small delay for printer to respond
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Read response
    const readResult = await readFromPrinter(printer);
    if (readResult.success) {
      return { success: true, config: readResult.data };
    }
    return { success: false, error: 'No response from printer' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Config query failed',
    };
  }
}
