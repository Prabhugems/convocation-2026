'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, QrCode, LayoutDashboard, Search, HelpCircle, LogIn, LogOut, X, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

// Public navigation - for delegates
const publicNavItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/track', icon: Search, label: 'Track' },
  { href: '/faq', icon: HelpCircle, label: 'FAQ' },
];

// Staff navigation - for station pages and admin
const staffNavItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/stations', icon: QrCode, label: 'Stations' },
  { href: '/track', icon: Search, label: 'Track' },
  { href: '/faq', icon: HelpCircle, label: 'FAQ' },
  { href: '/admin', icon: LayoutDashboard, label: 'Admin' },
];

function LoginModal() {
  const { login, showLoginModal, setShowLoginModal } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!showLoginModal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!login(username, password)) {
      setError('Invalid credentials');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => setShowLoginModal(false)}
    >
      <div
        className="bg-slate-900 border border-white/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Staff Login</h3>
          </div>
          <button
            onClick={() => setShowLoginModal(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter username"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Login
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-4">
          For authorized staff only
        </p>
      </div>
    </div>
  );
}

function LayoutContent({ children }: LayoutProps) {
  const pathname = usePathname();
  const { isStaff, logout, setShowLoginModal } = useAuth();

  // Show staff nav if logged in as staff OR on station pages
  const isStaffPage = pathname.startsWith('/stations') || pathname.startsWith('/admin');
  const showStaffNav = isStaff || isStaffPage;
  const navItems = showStaffNav ? staffNavItems : publicNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-md bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div>
                <h1 className="text-white font-semibold text-lg">AMASI</h1>
                <p className="text-white/60 text-xs">Convocation 2026</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                );
              })}

              {/* Login/Logout Button */}
              {isStaff ? (
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all ml-2"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all ml-2"
                  title="Staff Login"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="text-sm font-medium">Staff</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pb-20 md:pb-8">{children}</main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 backdrop-blur-md bg-black/40 border-t border-white/10">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-2 transition-all ${
                  isActive ? 'text-white' : 'text-white/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{label}</span>
              </Link>
            );
          })}

          {/* Mobile Login/Logout */}
          {isStaff ? (
            <button
              onClick={logout}
              className="flex flex-col items-center gap-1 px-3 py-2 text-white/50"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-xs">Logout</span>
            </button>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 text-white/50"
            >
              <LogIn className="w-5 h-5" />
              <span className="text-xs">Staff</span>
            </button>
          )}
        </div>
      </nav>

      {/* Login Modal */}
      <LoginModal />
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  return (
    <AuthProvider>
      <LayoutContent>{children}</LayoutContent>
    </AuthProvider>
  );
}
