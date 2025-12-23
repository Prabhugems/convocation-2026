'use client';

import Link from 'next/link';
import { stations } from '@/lib/stations';
import {
  Package,
  Truck,
  UserCheck,
  Shirt,
  Undo2,
  Award,
  Building2,
  MapPin,
  Send,
  ArrowRight,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
  Package,
  Truck,
  UserCheck,
  Shirt,
  Undo2,
  Award,
  Building2,
  MapPin,
  Send,
};

// Color schemes for each station
const colorSchemes = [
  { gradient: 'from-slate-600 to-slate-800', bg: 'bg-slate-500', text: 'text-slate-600' },
  { gradient: 'from-purple-500 to-purple-700', bg: 'bg-purple-500', text: 'text-purple-600' },
  { gradient: 'from-cyan-500 to-cyan-700', bg: 'bg-cyan-500', text: 'text-cyan-600' },
  { gradient: 'from-orange-500 to-orange-700', bg: 'bg-orange-500', text: 'text-orange-600' },
  { gradient: 'from-amber-500 to-amber-700', bg: 'bg-amber-500', text: 'text-amber-600' },
  { gradient: 'from-green-500 to-green-700', bg: 'bg-green-500', text: 'text-green-600' },
  { gradient: 'from-yellow-500 to-yellow-700', bg: 'bg-yellow-500', text: 'text-yellow-600' },
  { gradient: 'from-blue-500 to-blue-700', bg: 'bg-blue-500', text: 'text-blue-600' },
  { gradient: 'from-indigo-500 to-indigo-700', bg: 'bg-indigo-500', text: 'text-indigo-600' },
];

export default function StationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">Scan Stations</h1>
          <p className="text-slate-400 text-lg">
            Select a station to start scanning certificates
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map((station, index) => {
            const Icon = iconMap[station.icon] || Package;
            const colors = colorSchemes[index % colorSchemes.length];

            return (
              <Link key={station.id} href={`/stations/${station.id}`}>
                <div className="group relative h-full">
                  {/* Card */}
                  <div className="relative h-full bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 transition-all duration-500 ease-out group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:shadow-black/30 group-hover:border-slate-600">

                    {/* Curved gradient side accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${colors.gradient} rounded-l-2xl`} />

                    {/* Hover glow effect */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${colors.gradient}`} />

                    {/* Content */}
                    <div className="relative p-6 pl-8">
                      {/* Top row: Number badge and Icon */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          {/* Number badge */}
                          <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                            {index + 1}
                          </span>

                          {/* Icon container with curved shape */}
                          <div className={`w-14 h-14 rounded-2xl ${colors.bg}/20 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                            <Icon className={`w-7 h-7 ${colors.text} opacity-80`} />
                          </div>
                        </div>

                        {/* Arrow indicator */}
                        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center transition-all duration-300 group-hover:bg-white/10 group-hover:translate-x-1">
                          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                      </div>

                      {/* Station name */}
                      <h3 className="font-bold text-xl text-white mb-2 group-hover:text-white transition-colors">
                        {station.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                        {station.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        {station.printType && (
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-full border border-blue-500/30">
                            Print: {station.printType}
                          </span>
                        )}
                        {station.collectMoney && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                            Collect ₹{station.collectMoney}
                          </span>
                        )}
                        {station.refundMoney && (
                          <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full border border-yellow-500/30">
                            Refund ₹{station.refundMoney}
                          </span>
                        )}
                        {station.requiresAddress && (
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full border border-purple-500/30">
                            Fetch Address
                          </span>
                        )}
                        {station.requiresTracking && (
                          <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-full border border-orange-500/30">
                            Tracking #
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom curved accent line */}
                    <div className={`absolute bottom-0 left-2 right-0 h-1 bg-gradient-to-r ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-br-2xl`} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
