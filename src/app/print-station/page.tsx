'use client';

import Link from 'next/link';
import {
  Download,
  Monitor,
  Printer,
  Settings,
  CheckCircle,
  ChevronRight,
  Apple,
  ExternalLink,
  Info,
  AlertTriangle,
} from 'lucide-react';

// Windows icon SVG component
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.949" />
    </svg>
  );
}

export default function PrintStationPage() {
  // Update these URLs when releases are available
  const downloadUrls = {
    mac: '#', // Will be updated to GitHub Releases URL
    windows: '#', // Will be updated to GitHub Releases URL
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white hover:text-cyan-400 transition-colors">
            <Printer className="w-6 h-6" />
            <span className="font-semibold">AMASI Print Station</span>
          </Link>
          <Link
            href="/admin"
            className="text-sm text-white/70 hover:text-white transition-colors flex items-center gap-1"
          >
            Admin Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-6">
            <Printer className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            AMASI Print Station
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Desktop application for printing 4x6 convocation badges on Zebra ZD230 thermal printers.
            Optimized for Station 3 Registration.
          </p>
        </div>

        {/* Download Section */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <Download className="w-6 h-6 text-cyan-400" />
            Download
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Mac Download */}
            <a
              href={downloadUrls.mac}
              className="group block p-6 bg-slate-900/50 border border-white/10 rounded-xl hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                  <Apple className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">macOS</h3>
                  <p className="text-sm text-white/50">Intel & Apple Silicon</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 text-sm font-medium">Download .dmg</span>
                <Download className="w-5 h-5 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </a>

            {/* Windows Download */}
            <a
              href={downloadUrls.windows}
              className="group block p-6 bg-slate-900/50 border border-white/10 rounded-xl hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                  <WindowsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Windows</h3>
                  <p className="text-sm text-white/50">Windows 10/11 (64-bit)</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 text-sm font-medium">Download .exe</span>
                <Download className="w-5 h-5 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
              </div>
            </a>
          </div>

          <p className="text-sm text-white/50 mt-6 text-center">
            Version 1.0.0 • Released January 2026
          </p>
        </div>

        {/* Setup Instructions */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <Settings className="w-6 h-6 text-cyan-400" />
            Setup Instructions
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Install the Application</h3>
                <p className="text-white/70 text-sm">
                  Download and install the app for your operating system. On macOS, drag to Applications folder.
                  On Windows, run the installer.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Configure Printer Settings</h3>
                <p className="text-white/70 text-sm">
                  Go to the Settings tab and enter:
                </p>
                <ul className="text-white/70 text-sm mt-2 space-y-1 ml-4 list-disc">
                  <li><strong>Printer IP:</strong> Will be assigned at venue (e.g., 192.168.1.100)</li>
                  <li><strong>Port:</strong> 9100 (default for Zebra printers)</li>
                  <li><strong>API URL:</strong> https://convocation-2026.vercel.app</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Test Connection</h3>
                <p className="text-white/70 text-sm">
                  Click "Test Connection" to verify the printer is reachable. Then click "Test Print"
                  to print a sample label and verify alignment.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Start Scanning</h3>
                <p className="text-white/70 text-sm">
                  Scan QR codes from Tito tickets. The app will automatically fetch registration data
                  and display badge preview. Press Enter or click Print to print the badge.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <Monitor className="w-6 h-6 text-cyan-400" />
            Requirements
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                Printer
              </h3>
              <ul className="space-y-2 text-white/70 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Zebra ZD230 (recommended)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  4x6 inch (100mm × 153mm) labels
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Connected to same network
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-cyan-400" />
                Computer
              </h3>
              <ul className="space-y-2 text-white/70 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  macOS 10.15+ or Windows 10/11
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Internet connection (for data fetch)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  USB/Wireless barcode scanner
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            Troubleshooting
          </h2>

          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">Printer not connecting</h3>
              <p className="text-white/70 text-sm">
                Ensure the printer is on the same network as your computer. Check the IP address
                in the printer settings menu. Make sure port 9100 is not blocked by firewall.
              </p>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">Badge not aligned correctly</h3>
              <p className="text-white/70 text-sm">
                Run printer calibration from the Settings tab or use the printer's built-in
                calibration. Ensure you're using 4x6 inch labels (not 4x4 or other sizes).
              </p>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg">
              <h3 className="text-white font-medium mb-2">QR code not found</h3>
              <p className="text-white/70 text-sm">
                Ensure the QR code starts with "ti_" (Tito ticket slug). You can also search
                by convocation number or name using the scanner input.
              </p>
            </div>
          </div>
        </div>

        {/* Alternative: Web-based Printing */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-8">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-semibold mb-2">Alternative: Web-based Printing</h3>
              <p className="text-white/70 text-sm mb-4">
                If you can't install the desktop app, you can use the web-based printing at Station 3 Registration.
                This requires Zebra Browser Print to be installed on the computer.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/stations/registration"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm transition-colors"
                >
                  Go to Station 3 Registration
                  <ChevronRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://www.zebra.com/us/en/support-downloads/printer-software/by-request-software.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 rounded-lg text-white/70 text-sm transition-colors"
                >
                  Download Browser Print
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-white/50 text-sm">
          AMASI Print Station v1.0.0 • AMASICON 2026 Convocation
        </div>
      </footer>
    </div>
  );
}
