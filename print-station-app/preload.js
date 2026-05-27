const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printStation', {
  // Print ZPL via TCP to a network printer
  printZpl: (printerIp, printerPort, zplCode) =>
    ipcRenderer.invoke('print-zpl', printerIp, printerPort, zplCode),

  // Print ZPL via CUPS to a USB-connected printer (macOS/Linux only)
  // requestedPrinter is optional; if omitted, picker chooses default/first USB printer
  printZplUsb: (zplCode, requestedPrinter) =>
    ipcRenderer.invoke('print-zpl-usb', zplCode, requestedPrinter),

  // List enabled USB-connected CUPS printers
  listUsbPrinters: () => ipcRenderer.invoke('list-usb-printers'),

  // Test printer connection
  testConnection: (printerIp, printerPort) =>
    ipcRenderer.invoke('test-connection', printerIp, printerPort),

  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version')
});
