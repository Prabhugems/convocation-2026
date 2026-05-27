const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    title: 'AMASI Print Station'
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Print ZPL to Zebra printer via TCP
ipcMain.handle('print-zpl', async (event, printerIp, printerPort, zplCode) => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.destroy();
        resolve({ success: false, error: 'Connection timeout (10s)' });
      }
    }, 10000);

    client.connect(printerPort, printerIp, () => {
      client.write(zplCode, () => {
        clearTimeout(timeout);
        client.end();
        if (!resolved) {
          resolved = true;
          resolve({ success: true });
        }
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: err.message });
      }
    });

    client.on('close', () => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ success: true });
      }
    });
  });
});

// Run a shell command and resolve its stdout
function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

// Discover enabled USB-connected CUPS printers
async function listUsbPrintersInternal() {
  const [lpvOut, lppOut] = await Promise.all([run('lpstat -v'), run('lpstat -p')]);

  const usbPrinters = [];
  for (const line of lpvOut.split('\n')) {
    const m = line.match(/^device for ([^:]+):\s*(usb:\/\/.+)$/);
    if (m) usbPrinters.push(m[1].trim());
  }

  const enabled = new Set();
  for (const line of lppOut.split('\n')) {
    const m = line.match(/^printer (\S+) .* enabled/);
    if (m) enabled.add(m[1]);
  }

  let systemDefault = null;
  try {
    const defOut = await run('lpstat -d');
    const m = defOut.match(/system default destination:\s*(\S+)/);
    if (m) systemDefault = m[1];
  } catch {
    // no default — fine
  }

  return usbPrinters
    .filter((p) => enabled.has(p))
    .map((name) => ({ name, isDefault: name === systemDefault }));
}

// Expose USB printer list to renderer
ipcMain.handle('list-usb-printers', async () => {
  try {
    const printers = await listUsbPrintersInternal();
    return { success: true, printers };
  } catch (err) {
    return { success: false, error: err.message, printers: [] };
  }
});

// Print ZPL via CUPS (USB)
//
// Printer selection priority:
//   1. requestedPrinter argument (UI choice)
//   2. System default destination, IF it's a usb:// device and enabled
//   3. First enabled usb:// printer
ipcMain.handle('print-zpl-usb', async (event, zplCode, requestedPrinter) => {
  let printerName = '';

  try {
    if (requestedPrinter) {
      printerName = requestedPrinter;
    } else {
      const candidates = await listUsbPrintersInternal();
      if (candidates.length === 0) {
        return { success: false, error: 'No enabled USB printer found in CUPS. Is the printer connected via USB?' };
      }
      const def = candidates.find((p) => p.isDefault);
      printerName = (def || candidates[0]).name;
    }
  } catch (err) {
    return { success: false, error: `Failed to query CUPS: ${err.message}` };
  }

  if (!/^[A-Za-z0-9_.\-]+$/.test(printerName)) {
    return { success: false, error: `Invalid CUPS printer name: ${printerName}` };
  }

  return new Promise((resolve) => {
    const child = exec(`lp -d ${printerName} -o raw`, (err, stdout) => {
      if (err) {
        resolve({ success: false, error: `USB print error: ${err.message}` });
      } else {
        resolve({ success: true, printer: printerName, message: stdout.trim() });
      }
    });
    if (child.stdin) {
      child.stdin.write(zplCode);
      child.stdin.end();
    }
  });
});

// Test printer connection
ipcMain.handle('test-connection', async (event, printerIp, printerPort) => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      }
    }, 5000);

    client.connect(printerPort, printerIp, () => {
      clearTimeout(timeout);
      client.end();
      if (!resolved) {
        resolved = true;
        resolve({ success: true, message: 'Connected successfully' });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: err.message });
      }
    });
  });
});

// Save settings
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Load settings
ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
    return {
      printerIp: '192.168.1.100',
      printerPort: 9100,
      apiUrl: 'https://convocation-2026.vercel.app',
      autoPrint: false,
      printMode: 'network',
      usbPrinterName: ''
    };
  } catch (err) {
    return {
      printerIp: '192.168.1.100',
      printerPort: 9100,
      apiUrl: 'https://convocation-2026.vercel.app',
      autoPrint: false,
      printMode: 'network',
      usbPrinterName: ''
    };
  }
});

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion();
});
