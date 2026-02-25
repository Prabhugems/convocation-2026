#!/usr/bin/env node
/**
 * Local Print Server for AMASI Convocation 2026
 *
 * Run this on any computer on the same network as your Zebra printer.
 * Then your phone can send print jobs through this server.
 *
 * Usage:
 *   node local-print-server.js
 *
 * Then on your phone, use: http://<computer-ip>:3001
 */

const http = require('http');
const net = require('net');
const url = require('url');

const PORT = 3004;
const DEFAULT_PRINTER_IP = '10.0.1.12';
const DEFAULT_PRINTER_PORT = 9100;

// Enable CORS for all origins
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Send ZPL to printer via TCP
function sendToPrinter(zpl, printerIP, printerPort) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let resolved = false;

    client.setTimeout(10000); // 10 second timeout

    client.connect(printerPort, printerIP, () => {
      console.log(`[Print] Connected to ${printerIP}:${printerPort}`);
      client.write(zpl, () => {
        console.log(`[Print] Sent ${zpl.length} bytes`);
        resolved = true;
        client.end();
        resolve({ success: true });
      });
    });

    client.on('error', (err) => {
      console.error(`[Print] Error: ${err.message}`);
      if (!resolved) {
        reject(err);
      }
    });

    client.on('timeout', () => {
      console.error('[Print] Connection timeout');
      client.destroy();
      if (!resolved) {
        reject(new Error('Connection timeout'));
      }
    });

    client.on('close', () => {
      console.log('[Print] Connection closed');
    });
  });
}

// Get local IP addresses
function getLocalIPs() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // Health check
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Local Print Server is running',
      defaultPrinter: `${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}`
    }));
    return;
  }

  // Print endpoint
  if (parsedUrl.pathname === '/print' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { zpl, printerIP = DEFAULT_PRINTER_IP, printerPort = DEFAULT_PRINTER_PORT } = data;

        if (!zpl) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing ZPL data' }));
          return;
        }

        console.log(`\n[Print Request] Sending to ${printerIP}:${printerPort}`);

        await sendToPrinter(zpl, printerIP, printerPort);

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Print job sent' }));

      } catch (err) {
        console.error('[Print Error]', err.message);
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Test print endpoint
  if (parsedUrl.pathname === '/test-print') {
    const printerIP = parsedUrl.query.ip || DEFAULT_PRINTER_IP;
    const printerPort = parseInt(parsedUrl.query.port) || DEFAULT_PRINTER_PORT;

    const testZPL = `^XA
^CI28
^FO50,50^A0N,40,40^FDTest Print OK^FS
^FO50,100^A0N,30,30^FD${new Date().toLocaleString()}^FS
^FO50,150^A0N,25,25^FDLocal Print Server^FS
^XZ`;

    try {
      await sendToPrinter(testZPL, printerIP, printerPort);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Test print sent!' }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 404
  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();

  console.log('\n========================================');
  console.log('  AMASI Local Print Server');
  console.log('========================================\n');
  console.log(`Default Printer: ${DEFAULT_PRINTER_IP}:${DEFAULT_PRINTER_PORT}\n`);
  console.log('Access from your phone using one of these URLs:\n');

  ips.forEach(ip => {
    console.log(`  http://${ip}:${PORT}`);
  });

  console.log(`\nTest print: http://<ip>:${PORT}/test-print`);
  console.log('\n========================================\n');
});
