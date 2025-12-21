'use client';

import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
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

export default function StationsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Scan Stations</h1>
        <p className="text-white/60">
          Select a station to start scanning certificates
        </p>
      </div>

      <div className="space-y-4">
        {stations.map((station, index) => {
          const Icon = iconMap[station.icon] || Package;
          return (
            <Link key={station.id} href={`/stations/${station.id}`}>
              <GlassCard hover className="p-6">
                <div className="flex items-center gap-5">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-white mb-1">
                      {station.name}
                    </h3>
                    <p className="text-sm text-white/50">{station.description}</p>

                    <div className="flex items-center gap-3 mt-2">
                      {station.printType && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                          Print: {station.printType}
                        </span>
                      )}
                      {station.collectMoney && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          Collect ₹{station.collectMoney}
                        </span>
                      )}
                      {station.refundMoney && (
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                          Refund ₹{station.refundMoney}
                        </span>
                      )}
                      {station.requiresAddress && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                          Fetch Address
                        </span>
                      )}
                      {station.requiresTracking && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
                          Tracking #
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-5 h-5 text-white/30" />
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
