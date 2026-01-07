const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printStation', {
  // Print ZPL to printer
  printZpl: (printerIp, printerPort, zplCode) =>
    ipcRenderer.invoke('print-zpl', printerIp, printerPort, zplCode),

  // Test printer connection
  testConnection: (printerIp, printerPort) =>
    ipcRenderer.invoke('test-connection', printerIp, printerPort),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version')
});
