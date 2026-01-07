/**
 * Example React Component for Zebra Printing
 *
 * This is a reference implementation showing how to use the
 * Zebra print client in a React/Next.js application.
 *
 * Copy and modify for your own use case.
 */

'use client';

import { useState } from 'react';
import {
  testZebraPrinter,
  printBadge,
  calibratePrinter,
  clearPrintQueue,
  LABEL_SIZES,
  type BadgeData,
  type LabelSize,
  type PrintResult,
} from '@/lib/zebra-client';

interface PrinterStatus {
  connected: boolean;
  message: string;
  loading: boolean;
}

export default function ZebraPrintExample() {
  // Printer settings
  const [printerIP, setPrinterIP] = useState('192.168.1.100');
  const [printerPort, setPrinterPort] = useState(9100);

  // Badge data
  const [badgeData, setBadgeData] = useState<BadgeData>({
    name: 'John Doe',
    title: 'Software Engineer',
    company: 'Tech Corp',
    badge_type: 'Attendee',
    badge_id: 'ATT001',
    event_name: 'Conference 2024',
    paper_size: '4x6',
    rotation: 0,
  });

  // Status
  const [status, setStatus] = useState<PrinterStatus>({
    connected: false,
    message: '',
    loading: false,
  });

  // Handle test connection
  const handleTestConnection = async () => {
    setStatus({ connected: false, message: 'Testing connection...', loading: true });

    const result: PrintResult = await testZebraPrinter(printerIP, printerPort);

    setStatus({
      connected: result.success,
      message: result.success
        ? 'Connected! Test print sent.'
        : `Failed: ${result.error}`,
      loading: false,
    });
  };

  // Handle print badge
  const handlePrint = async () => {
    setStatus({ ...status, message: 'Printing...', loading: true });

    const result: PrintResult = await printBadge(printerIP, badgeData, printerPort);

    setStatus({
      ...status,
      message: result.success
        ? 'Badge printed successfully!'
        : `Print failed: ${result.error}`,
      loading: false,
    });
  };

  // Handle calibration
  const handleCalibrate = async () => {
    setStatus({ ...status, message: 'Calibrating...', loading: true });

    const result: PrintResult = await calibratePrinter(printerIP, printerPort);

    setStatus({
      ...status,
      message: result.success
        ? 'Calibration complete'
        : `Calibration failed: ${result.error}`,
      loading: false,
    });
  };

  // Handle clear queue
  const handleClearQueue = async () => {
    setStatus({ ...status, message: 'Clearing queue...', loading: true });

    const result: PrintResult = await clearPrintQueue(printerIP, printerPort);

    setStatus({
      ...status,
      message: result.success
        ? 'Queue cleared'
        : `Clear failed: ${result.error}`,
      loading: false,
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Zebra Printer Demo</h1>

      {/* Printer Settings */}
      <section style={{ marginBottom: '20px' }}>
        <h2>Printer Settings</h2>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <label>
            IP Address:
            <input
              type="text"
              value={printerIP}
              onChange={(e) => setPrinterIP(e.target.value)}
              placeholder="192.168.1.100"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
          <label>
            Port:
            <input
              type="number"
              value={printerPort}
              onChange={(e) => setPrinterPort(parseInt(e.target.value) || 9100)}
              style={{ marginLeft: '10px', padding: '5px', width: '80px' }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleTestConnection} disabled={status.loading}>
            Test Connection
          </button>
          <button onClick={handleCalibrate} disabled={status.loading}>
            Calibrate
          </button>
          <button onClick={handleClearQueue} disabled={status.loading}>
            Clear Queue
          </button>
        </div>
      </section>

      {/* Status Display */}
      {status.message && (
        <div
          style={{
            padding: '10px',
            marginBottom: '20px',
            borderRadius: '5px',
            backgroundColor: status.connected ? '#d4edda' : '#f8d7da',
            color: status.connected ? '#155724' : '#721c24',
          }}
        >
          {status.loading ? 'Loading...' : status.message}
        </div>
      )}

      {/* Badge Data Form */}
      <section style={{ marginBottom: '20px' }}>
        <h2>Badge Data</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          <label>
            Name:
            <input
              type="text"
              value={badgeData.name}
              onChange={(e) => setBadgeData({ ...badgeData, name: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Title:
            <input
              type="text"
              value={badgeData.title || ''}
              onChange={(e) => setBadgeData({ ...badgeData, title: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Company:
            <input
              type="text"
              value={badgeData.company || ''}
              onChange={(e) => setBadgeData({ ...badgeData, company: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Badge Type:
            <input
              type="text"
              value={badgeData.badge_type || ''}
              onChange={(e) => setBadgeData({ ...badgeData, badge_type: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Badge ID:
            <input
              type="text"
              value={badgeData.badge_id || ''}
              onChange={(e) => setBadgeData({ ...badgeData, badge_id: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Event Name:
            <input
              type="text"
              value={badgeData.event_name || ''}
              onChange={(e) => setBadgeData({ ...badgeData, event_name: e.target.value })}
              style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
            />
          </label>
          <label>
            Label Size:
            <select
              value={badgeData.paper_size}
              onChange={(e) =>
                setBadgeData({ ...badgeData, paper_size: e.target.value as LabelSize })
              }
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              {Object.entries(LABEL_SIZES).map(([key, value]) => (
                <option key={key} value={key}>
                  {key} ({value.inches})
                </option>
              ))}
            </select>
          </label>
          <label>
            Rotation:
            <select
              value={badgeData.rotation}
              onChange={(e) =>
                setBadgeData({ ...badgeData, rotation: parseInt(e.target.value) as 0 | 180 })
              }
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value={0}>Normal (0°)</option>
              <option value={180}>Inverted (180°)</option>
            </select>
          </label>
        </div>
      </section>

      {/* Print Button */}
      <button
        onClick={handlePrint}
        disabled={status.loading || !badgeData.name}
        style={{
          padding: '15px 30px',
          fontSize: '18px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: status.loading ? 'not-allowed' : 'pointer',
        }}
      >
        {status.loading ? 'Printing...' : 'Print Badge'}
      </button>

      {/* Quick Reference */}
      <section style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <h3>Quick Reference</h3>
        <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
{`// Test connection
const result = await testZebraPrinter("${printerIP}")

// Print badge
const result = await printBadge("${printerIP}", {
  name: "${badgeData.name}",
  badge_type: "${badgeData.badge_type}",
  badge_id: "${badgeData.badge_id}"
})

// Print raw ZPL
const result = await printRawZPL("${printerIP}", "^XA^FO50,50^A0N,50,50^FDHello^FS^XZ")`}
        </pre>
      </section>
    </div>
  );
}
