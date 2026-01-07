'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import PrinterSetup from '@/components/PrinterSetup';

export default function PrinterSetupPage() {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg">
            <Printer className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Printer Setup</h1>
            <p className="text-white/60">Configure Zebra Browser Print for badge printing</p>
          </div>
        </div>
      </div>

      {/* About Section */}
      <GlassCard className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">About Zebra Browser Print</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          Zebra Browser Print is software that enables web applications to print directly to Zebra printers
          without requiring print dialogs or driver configuration. It runs locally on your computer and
          communicates with the web app to send print commands directly to connected Zebra printers.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Supported Printers</p>
            <p className="text-white text-sm">ZD230, ZD420, ZT230, etc.</p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Connection Types</p>
            <p className="text-white text-sm">USB or Network</p>
          </div>
        </div>
      </GlassCard>

      {/* Printer Setup Component */}
      <PrinterSetup />

      {/* Additional Help */}
      <GlassCard className="p-6 mt-6">
        <h3 className="text-white font-medium mb-4">Printer Settings (ZD230)</h3>
        <p className="text-white/60 text-sm mb-4">
          For optimal badge printing, ensure your Zebra printer has these settings:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-white/40 font-medium">Setting</th>
                <th className="text-left py-2 text-white/40 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              <tr className="border-b border-white/5">
                <td className="py-2">Print Language</td>
                <td className="py-2 font-mono text-cyan-400">ZPL</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Label Size</td>
                <td className="py-2 font-mono text-cyan-400">4" x 6" (100mm x 150mm)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Print Speed</td>
                <td className="py-2 font-mono text-cyan-400">2-4 inches/sec</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Print Darkness</td>
                <td className="py-2 font-mono text-cyan-400">15-20</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2">Media Type</td>
                <td className="py-2 font-mono text-cyan-400">Gap/Notch</td>
              </tr>
              <tr>
                <td className="py-2">Print Mode</td>
                <td className="py-2 font-mono text-cyan-400">Tear Off or Peel Off</td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Quick Links */}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/stations/registration"
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors text-sm"
        >
          Go to Registration Station
        </a>
        <a
          href="/stations"
          className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white/70 hover:bg-white/20 transition-colors text-sm"
        >
          All Stations
        </a>
      </div>
    </div>
  );
}
