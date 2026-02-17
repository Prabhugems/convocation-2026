'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Radio,
  ScanLine,
  LayoutDashboard,
  QrCode,
  Tag,
  Box,
  Package,
  Truck,
  Send,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Monitor,
  AlertTriangle,
} from 'lucide-react';

const STATIONS = [
  { id: 'encoding', label: 'Encoding', desc: 'Write EPC to RFID label & link to graduate' },
  { id: 'packing', label: 'Packing', desc: 'Certificate packed into dispatch box' },
  { id: 'dispatch-venue', label: 'Dispatch to Venue', desc: 'Box dispatched to convocation venue' },
  { id: 'registration', label: 'Registration', desc: 'Graduate arrives & registers' },
  { id: 'gown-issue', label: 'Gown Issue', desc: 'Academic gown issued to graduate' },
  { id: 'gown-return', label: 'Gown Return', desc: 'Gown returned after ceremony' },
  { id: 'certificate-collection', label: 'Certificate Collection', desc: 'Graduate collects certificate' },
  { id: 'return-ho', label: 'Return to Head Office', desc: 'Uncollected certificates sent back' },
  { id: 'address-label', label: 'Address Label', desc: 'Postal label printed for dispatch' },
  { id: 'final-dispatch', label: 'Final Dispatch', desc: 'Dispatched via DTDC / India Post' },
  { id: 'handover', label: 'Handover', desc: 'Handed over to authorized person' },
];

export default function RfidGuidePage() {
  return (
    <div className="min-h-screen bg-[#0c1222] text-[#f1f5f9]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/staff/rfid/dashboard"
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Radio className="w-7 h-7 text-cyan-400" />
              RFID System Guide
            </h1>
            <p className="text-slate-400 mt-1">
              How to use the UHF RFID tracking system for convocation
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <Link
            href="/staff/rfid/encode"
            className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-colors"
          >
            <Tag className="w-6 h-6 text-blue-400" />
            <div>
              <p className="font-medium text-blue-300">Encode Tags</p>
              <p className="text-xs text-slate-400">Write & register RFID tags</p>
            </div>
          </Link>
          <Link
            href="/staff/rfid/scan"
            className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-colors"
          >
            <ScanLine className="w-6 h-6 text-cyan-400" />
            <div>
              <p className="font-medium text-cyan-300">Scanner</p>
              <p className="text-xs text-slate-400">Scan at stations</p>
            </div>
          </Link>
          <Link
            href="/staff/rfid/dashboard"
            className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl hover:bg-purple-500/20 transition-colors"
          >
            <LayoutDashboard className="w-6 h-6 text-purple-400" />
            <div>
              <p className="font-medium text-purple-300">Dashboard</p>
              <p className="text-xs text-slate-400">Monitor & verify tags</p>
            </div>
          </Link>
        </div>

        {/* Equipment */}
        <Section title="Equipment" icon={<Monitor className="w-5 h-5 text-cyan-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <EquipmentCard
              title="RFID Labels"
              subtitle="54x34mm UHF tags"
              desc="2000 pcs — stick on each certificate"
            />
            <EquipmentCard
              title="RFG WD01"
              subtitle="Desktop Reader/Writer"
              desc="USB encoder — writes EPC to blank tags at desk"
            />
            <EquipmentCard
              title="MPower200"
              subtitle="Android Handheld"
              desc="Portable scanner — reads tags at event stations"
            />
          </div>
        </Section>

        {/* Encoding Process */}
        <Section title="Step 1: Encoding Tags (Before Event)" icon={<Tag className="w-5 h-5 text-blue-400" />}>
          <div className="space-y-4">
            <StepItem step={1} title="Scan Certificate QR Code">
              <p>Go to <InlineLink href="/staff/rfid/encode">Encode Page</InlineLink> and click <strong>Scan QR Code</strong>. Point camera at the certificate&apos;s QR code. The system auto-detects the graduate&apos;s convocation number and name from Tito.</p>
            </StepItem>
            <StepItem step={2} title="Write EPC to Physical Tag">
              <p>Place a blank 54x34mm RFID label on the <strong>RFG WD01 desktop encoder</strong>. Use the vendor software (Mivanta) to write the convocation number (e.g., <code className="text-cyan-400">118AEC1001</code>) as the EPC.</p>
            </StepItem>
            <StepItem step={3} title="Confirm Encode in App">
              <p>Enter your name in &quot;Encoded By&quot; and click <strong>Encode Tag</strong> → <strong>Confirm Encode</strong>. This saves the record in Airtable and links the RFID tag to the graduate&apos;s Tito ticket.</p>
            </StepItem>
            <StepItem step={4} title="Stick Label on Certificate">
              <p>Peel the encoded RFID label and stick it on the certificate or its envelope. The tag is now trackable across all stations.</p>
            </StepItem>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200/80">
                <strong>Tip:</strong> The EPC on the physical tag must exactly match the convocation number in the app. Always use the QR scan to avoid typos.
              </div>
            </div>
          </div>
        </Section>

        {/* Scanning at Stations */}
        <Section title="Step 2: Scanning at Stations (During Event)" icon={<ScanLine className="w-5 h-5 text-cyan-400" />}>
          <div className="space-y-4">
            <StepItem step={1} title="Open Scanner Page">
              <p>Go to <InlineLink href="/staff/rfid/scan">Scanner Page</InlineLink>. Select the current station from the dropdown (e.g., Registration, Gown Issue).</p>
            </StepItem>
            <StepItem step={2} title="Scan the Tag">
              <p>Use the <strong>MPower200 handheld reader</strong> or type the EPC manually. The app reads the tag and shows the graduate&apos;s details.</p>
            </StepItem>
            <StepItem step={3} title="Automatic Updates">
              <p>On scan, the system automatically:</p>
              <ul className="list-disc list-inside mt-1 text-slate-400 space-y-1">
                <li>Updates the tag status in Airtable</li>
                <li>Records scan time, station, and operator</li>
                <li>Triggers <strong>Tito check-in</strong> at the mapped station</li>
              </ul>
            </StepItem>

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-2">
              <Smartphone className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200/80">
                <strong>Mobile friendly:</strong> The scanner page works on phones and tablets. Staff can scan using the handheld reader connected via Bluetooth or type EPCs on any device.
              </div>
            </div>
          </div>
        </Section>

        {/* Station Flow */}
        <Section title="Station Flow" icon={<Package className="w-5 h-5 text-green-400" />}>
          <div className="space-y-2">
            {STATIONS.map((station, i) => (
              <div key={station.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 p-3 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{station.label}</span>
                    <span className="text-xs text-slate-500 font-mono">{station.id}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{station.desc}</p>
                </div>
                {i < STATIONS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Dashboard & Monitoring */}
        <Section title="Step 3: Monitor & Dispatch" icon={<LayoutDashboard className="w-5 h-5 text-purple-400" />}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard
                icon={<LayoutDashboard className="w-5 h-5 text-purple-400" />}
                title="Dashboard"
                desc="Real-time stats — total tags, station breakdown, recent scans"
              />
              <FeatureCard
                icon={<QrCode className="w-5 h-5 text-green-400" />}
                title="Verify Tag"
                desc="Enter any EPC to see its full history, current station, and graduate details"
              />
              <FeatureCard
                icon={<Truck className="w-5 h-5 text-purple-400" />}
                title="Dispatch"
                desc="Bulk dispatch tags via DTDC, India Post, or hand delivery with tracking"
              />
              <FeatureCard
                icon={<Send className="w-5 h-5 text-green-400" />}
                title="Handover"
                desc="Record handover of certificates to authorized recipients"
              />
            </div>
          </div>
        </Section>

        {/* Box Tracking */}
        <Section title="Box Tracking" icon={<Box className="w-5 h-5 text-amber-400" />}>
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              You can also encode RFID tags for <strong>dispatch boxes</strong>. A box tag tracks the box itself and links to the graduate tags inside it.
            </p>
            <div className="space-y-2">
              <StepItem step={1} title="Encode a Box Tag">
                <p>On the Encode page, select &quot;Box&quot; type. Enter a Box ID (e.g., <code className="text-cyan-400">BOX-001</code>) and optionally add graduate EPCs as box contents.</p>
              </StepItem>
              <StepItem step={2} title="Scan Box at Stations">
                <p>When a box is scanned, all items inside are also tracked. The dashboard shows box summary with total boxes and items count.</p>
              </StepItem>
            </div>
          </div>
        </Section>

        {/* Tito Integration */}
        <Section title="Tito Integration" icon={<CheckCircle className="w-5 h-5 text-green-400" />}>
          <p className="text-sm text-slate-300 mb-3">
            The RFID system is fully connected to Tito. When a graduate&apos;s tag is scanned at a station, it automatically triggers the corresponding Tito check-in:
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Packing', 'Packing check-in'],
              ['Dispatch to Venue', 'Dispatch to Convocation'],
              ['Registration', 'Registration check-in'],
              ['Gown Issue', 'Gown Issued'],
              ['Gown Return', 'Gown Returned'],
              ['Certificate Collection', 'Certificate Collected'],
              ['Return to HO', 'Dispatch to Head Office'],
              ['Address Label', 'Address Label Printed'],
              ['Final Dispatch', 'Final dispatch check-in'],
            ].map(([station, tito]) => (
              <div key={station} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg">
                <ArrowRight className="w-3 h-3 text-green-500 shrink-0" />
                <span className="text-slate-400">{station}</span>
                <span className="text-green-400 ml-auto text-xs">{tito}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function StepItem({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
        {step}
      </div>
      <div>
        <h3 className="font-medium text-sm mb-1">{title}</h3>
        <div className="text-sm text-slate-400">{children}</div>
      </div>
    </div>
  );
}

function EquipmentCard({ title, subtitle, desc }: { title: string; subtitle: string; desc: string }) {
  return (
    <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-cyan-400">{subtitle}</p>
      <p className="text-xs text-slate-400 mt-2">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
      {children}
    </Link>
  );
}
