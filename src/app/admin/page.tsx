'use client';

import { useEffect, useState } from 'react';
import GlassCard from '@/components/GlassCard';
import StatusBadge from '@/components/StatusBadge';
import { DashboardStats, Graduate } from '@/types';
import { stations } from '@/lib/stations';
import {
  Users,
  Package,
  Truck,
  UserCheck,
  Shirt,
  Award,
  Building2,
  Send,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
} from 'lucide-react';

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  async function fetchData() {
    setLoading(true);
    try {
      const [statsRes, graduatesRes] = await Promise.all([
        fetch('/api/graduates?stats=true'),
        fetch('/api/graduates'),
      ]);

      const statsData = await statsRes.json();
      const graduatesData = await graduatesRes.json();

      if (statsData.success) setStats(statsData.data);
      if (graduatesData.success) setGraduates(graduatesData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredGraduates = graduates.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending-gown') return matchesSearch && g.status.gownIssued && !g.status.gownReturned;
    if (filterStatus === 'collected') return matchesSearch && g.status.certificateCollected;
    if (filterStatus === 'dispatched') return matchesSearch && g.status.finalDispatched;
    if (filterStatus === 'uncollected') return matchesSearch && !g.status.certificateCollected && !g.status.finalDispatched;

    return matchesSearch;
  });

  function exportCSV() {
    const headers = ['Registration Number', 'Name', 'Email', 'Phone', 'Course', 'Status', 'Tracking Number'];
    const rows = graduates.map((g) => [
      g.registrationNumber,
      g.name,
      g.email,
      g.phone,
      g.course,
      g.status.certificateCollected ? 'Collected' : g.status.finalDispatched ? 'Dispatched' : 'Pending',
      g.trackingNumber || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graduates-export.csv';
    a.click();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/60">Overview of certificate management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportCSV}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Export CSV"
          >
            <Download className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalGraduates || 0}</p>
              <p className="text-xs text-white/50">Total</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.packed || 0}</p>
              <p className="text-xs text-white/50">Packed</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Truck className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.dispatchedToVenue || 0}</p>
              <p className="text-xs text-white/50">At Venue</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.registered || 0}</p>
              <p className="text-xs text-white/50">Registered</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.certificateCollected || 0}</p>
              <p className="text-xs text-white/50">Collected</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.returnedToHO || 0}</p>
              <p className="text-xs text-white/50">At HO</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Send className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.finalDispatched || 0}</p>
              <p className="text-xs text-white/50">Dispatched</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Shirt className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{stats?.pendingGownDeposit || 0}</p>
              <p className="text-xs text-white/50">Pending Returns</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Alerts */}
      {(stats?.pendingGownDeposit || 0) > 0 && (
        <GlassCard className="p-4 mb-8 border-yellow-500/30 bg-yellow-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="font-semibold text-yellow-400">Pending Gown Returns</p>
              <p className="text-sm text-white/70">
                {stats?.pendingGownDeposit} graduates have pending gown deposits (₹
                {(stats?.pendingGownDeposit || 0) * 1000} total)
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Station Progress */}
      <GlassCard className="p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Station Progress</h2>
        <div className="space-y-4">
          {stations.slice(0, 6).map((station) => {
            const count = (() => {
              switch (station.id) {
                case 'packing': return stats?.packed || 0;
                case 'dispatch-venue': return stats?.dispatchedToVenue || 0;
                case 'registration': return stats?.registered || 0;
                case 'gown-issue': return stats?.gownIssued || 0;
                case 'gown-return': return stats?.gownReturned || 0;
                case 'certificate-collection': return stats?.certificateCollected || 0;
                default: return 0;
              }
            })();
            const total = stats?.totalGraduates || 1;
            const percentage = Math.round((count / total) * 100);

            return (
              <div key={station.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/70">{station.name}</span>
                  <span className="text-white/50">
                    {count} / {total} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Graduates List */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Graduates</h2>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="collected">Collected</option>
              <option value="dispatched">Dispatched</option>
              <option value="uncollected">Uncollected</option>
              <option value="pending-gown">Pending Gown</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Reg. No.</th>
                <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Name</th>
                <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Course</th>
                <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Status</th>
                <th className="text-left py-3 px-4 text-white/60 font-medium text-sm">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {filteredGraduates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-white/40">
                    No graduates found
                  </td>
                </tr>
              ) : (
                filteredGraduates.map((graduate) => (
                  <tr key={graduate.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white font-mono text-sm">
                      {graduate.registrationNumber}
                    </td>
                    <td className="py-3 px-4 text-white">{graduate.name}</td>
                    <td className="py-3 px-4 text-white/70">{graduate.course}</td>
                    <td className="py-3 px-4">
                      {graduate.status.certificateCollected ? (
                        <StatusBadge status="completed" label="Collected" />
                      ) : graduate.status.finalDispatched ? (
                        <StatusBadge status="completed" label="Dispatched" />
                      ) : graduate.status.gownIssued && !graduate.status.gownReturned ? (
                        <StatusBadge status="in-progress" label="Pending Gown" />
                      ) : (
                        <StatusBadge status="pending" label="In Progress" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-white/50 text-sm font-mono">
                      {graduate.trackingNumber || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-white/40">
          Showing {filteredGraduates.length} of {graduates.length} graduates
        </div>
      </GlassCard>
    </div>
  );
}
