'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { stations } from '@/lib/stations';
import { DashboardStats } from '@/types';
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
  Users,
  TrendingUp,
  CheckCircle2,
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

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/graduates?stats=true');
        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Convocation{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            2026
          </span>
        </h1>
        <p className="text-lg text-white/60 max-w-2xl mx-auto">
          AMASI Certificate Management System - Multi-station QR-based tracking for ~1500 FMAS graduates
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats?.totalGraduates || 0}
              </p>
              <p className="text-xs text-white/50">Total Graduates</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats?.certificateCollected || 0}
              </p>
              <p className="text-xs text-white/50">Collected</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats?.registered || 0}
              </p>
              <p className="text-xs text-white/50">Registered</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : stats?.finalDispatched || 0}
              </p>
              <p className="text-xs text-white/50">Dispatched</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Stations Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Scan Stations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station, index) => {
            const Icon = iconMap[station.icon] || Package;
            return (
              <Link key={station.id} href={`/stations/${station.id}`}>
                <GlassCard hover className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                          {index + 1}
                        </span>
                        <h3 className="font-semibold text-white truncate">{station.name}</h3>
                      </div>
                      <p className="text-sm text-white/50 line-clamp-2">{station.description}</p>
                      {station.collectMoney && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                          Collect ₹{station.collectMoney}
                        </span>
                      )}
                      {station.refundMoney && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                          Refund ₹{station.refundMoney}
                        </span>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/track">
          <GlassCard hover className="p-6">
            <h3 className="font-semibold text-white mb-2">Track Certificate</h3>
            <p className="text-sm text-white/50">
              Check the status and location of any certificate using registration number
            </p>
          </GlassCard>
        </Link>
        <Link href="/admin">
          <GlassCard hover className="p-6">
            <h3 className="font-semibold text-white mb-2">Admin Dashboard</h3>
            <p className="text-sm text-white/50">
              View detailed statistics, manage graduates, and export reports
            </p>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
