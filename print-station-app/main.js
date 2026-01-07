const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');

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
      autoPrint: false
    };
  } catch (err) {
    return {
      printerIp: '192.168.1.100',
      printerPort: 9100,
      apiUrl: 'https://convocation-2026.vercel.app',
      autoPrint: false
    };
  }
});

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion();
});
