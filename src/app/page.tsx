'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { Search, HelpCircle, Calendar, MapPin, Clock, Sparkles, GraduationCap, ArrowRight, ChevronDown, Sun, Moon, Award, Users } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Convocation date: 27th August 2026, 5:30 PM IST
const CONVOCATION_DATE = new Date('2026-08-27T17:30:00+05:30');

function useCountdown(targetTimestamp: number): TimeLeft {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetTimestamp - Date.now();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  return timeLeft;
}

export default function Home() {
  const targetTimestamp = useMemo(() => CONVOCATION_DATE.getTime(), []);
  const timeLeft = useCountdown(targetTimestamp);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('amasi_theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    }
    return 'dark';
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Persist theme to localStorage
  useEffect(() => {
    localStorage.setItem('amasi_theme', theme);
  }, [theme]);

  // Theme classes
  const themeClasses = {
    bg: theme === 'dark'
      ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      : 'bg-gradient-to-br from-gray-50 via-white to-gray-100',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-white/60' : 'text-gray-600',
    textSubtle: theme === 'dark' ? 'text-white/30' : 'text-gray-400',
    card: theme === 'dark'
      ? 'bg-white/5 backdrop-blur-xl border-white/10'
      : 'bg-white/80 backdrop-blur-xl border-gray-200 shadow-lg',
    cardHover: theme === 'dark'
      ? 'hover:bg-white/10 hover:border-white/20'
      : 'hover:bg-white hover:border-gray-300 hover:shadow-xl',
    badge: theme === 'dark'
      ? 'bg-white/10 text-white/70'
      : 'bg-gray-100 text-gray-600',
    countdownBg: theme === 'dark'
      ? 'bg-white/10'
      : 'bg-gray-100',
    eventCard: theme === 'dark'
      ? 'bg-white/5'
      : 'bg-gray-50',
  };

  return (
    <div className={`min-h-screen ${themeClasses.bg} transition-colors duration-500`}>
      {/* Theme Toggle - Fixed position */}
      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className={`fixed top-4 right-4 z-50 p-3 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${
          theme === 'dark'
            ? 'bg-white/10 hover:bg-white/20 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        }`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600" />
        )}
      </button>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
        {/* Floating Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full ${
            theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-200/30'
          } blur-3xl animate-pulse-soft`} />
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full ${
            theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-200/30'
          } blur-3xl animate-pulse-soft`} style={{ animationDelay: '1s' }} />
        </div>

        {/* Hero Section */}
        <div className={`text-center mb-12 relative z-10 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
          {/* Decorative badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6 ${themeClasses.badge} animate-bounce-soft`}>
            <Calendar className="w-4 h-4" />
            27th August 2026
            <span className={`w-1.5 h-1.5 rounded-full ${theme === 'dark' ? 'bg-green-400' : 'bg-green-500'} animate-pulse`} />
          </div>

          {/* Main title with gradient */}
          <h1 className={`text-5xl md:text-7xl font-bold mb-4 ${themeClasses.text}`}>
            <span className="inline-block animate-fade-in" style={{ animationDelay: '100ms' }}>Convocation</span>{' '}
            <span className="inline-block bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-fade-in" style={{ animationDelay: '200ms' }}>
              2026
            </span>
          </h1>

          {/* Subtitle with icon */}
          <div className={`flex items-center justify-center gap-2 text-lg md:text-xl ${themeClasses.textMuted} animate-fade-in`} style={{ animationDelay: '300ms' }}>
            <GraduationCap className="w-6 h-6" />
            <p>AMASI Certificate Management System</p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div
          className={`relative overflow-hidden rounded-3xl ${themeClasses.card} border p-8 md:p-10 mb-10 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '400ms' }}
        >
          {/* Decorative gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />

          <div className="relative z-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2">
                <Sparkles className={`w-5 h-5 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'} animate-pulse`} />
                <p className={`text-sm uppercase tracking-widest ${themeClasses.textMuted}`}>Countdown to Convocation</p>
                <Sparkles className={`w-5 h-5 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'} animate-pulse`} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 md:gap-6 max-w-xl mx-auto">
              {[
                { value: timeLeft.days, label: 'Days', gradient: 'from-blue-500 to-blue-600' },
                { value: timeLeft.hours, label: 'Hours', gradient: 'from-purple-500 to-purple-600' },
                { value: timeLeft.minutes, label: 'Minutes', gradient: 'from-pink-500 to-pink-600' },
                { value: timeLeft.seconds, label: 'Seconds', gradient: 'from-amber-500 to-amber-600' },
              ].map((item, index) => (
                <div
                  key={item.label}
                  className="text-center group"
                  style={{ animationDelay: `${500 + index * 100}ms` }}
                >
                  <div className={`relative ${themeClasses.countdownBg} rounded-2xl p-4 md:p-6 mb-3 overflow-hidden transition-all duration-300 group-hover:scale-105 flex items-center justify-center min-h-[72px] md:min-h-[96px]`}>
                    {/* Hover gradient effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />
                    <p className={`text-3xl md:text-5xl font-bold font-mono relative z-10 ${themeClasses.text} transition-transform duration-300 group-hover:scale-110 tabular-nums`}>
                      {item.label === 'Days' ? item.value : String(item.value).padStart(2, '0')}
                    </p>
                  </div>
                  <p className={`text-xs md:text-sm ${themeClasses.textMuted}`}>{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Track Certificate Card */}
          <Link
            href="/track"
            className={`group relative overflow-hidden rounded-3xl ${themeClasses.card} border p-8 transition-all duration-500 ${themeClasses.cardHover} hover:scale-[1.02] ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{ animationDelay: '600ms' }}
          >
            {/* Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Floating decorative element */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500" />

            <div className="relative z-10 flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <Search className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold mb-2 ${themeClasses.text} group-hover:translate-x-1 transition-transform duration-300`}>
                  Track Your Certificate
                </h2>
                <p className={`${themeClasses.textMuted} mb-4`}>
                  Check your certificate status and download your digital badge using your convocation number
                </p>
                <div className={`inline-flex items-center gap-2 text-blue-400 font-medium group-hover:gap-3 transition-all duration-300`}>
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </div>
          </Link>

          {/* FAQ Card */}
          <Link
            href="/faq"
            className={`group relative overflow-hidden rounded-3xl ${themeClasses.card} border p-8 transition-all duration-500 ${themeClasses.cardHover} hover:scale-[1.02] ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
            style={{ animationDelay: '700ms' }}
          >
            {/* Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Floating decorative element */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500" />

            <div className="relative z-10 flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold mb-2 ${themeClasses.text} group-hover:translate-x-1 transition-transform duration-300`}>
                  Frequently Asked Questions
                </h2>
                <p className={`${themeClasses.textMuted} mb-4`}>
                  Common questions about the convocation ceremony, dress code, and certificate collection
                </p>
                <div className={`inline-flex items-center gap-2 text-purple-400 font-medium group-hover:gap-3 transition-all duration-300`}>
                  Learn More
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats Section */}
        <div
          className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '800ms' }}
        >
          {[
            { icon: Users, label: 'Graduates', value: '500+', color: 'blue' },
            { icon: Award, label: 'Certificates', value: '500+', color: 'green' },
            { icon: GraduationCap, label: 'Courses', value: '10+', color: 'purple' },
            { icon: MapPin, label: 'Venue Capacity', value: '1000+', color: 'amber' },
          ].map((stat, index) => {
            const Icon = stat.icon;
            const colorClasses: Record<string, string> = {
              blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
              green: 'from-green-500 to-green-600 shadow-green-500/30',
              purple: 'from-purple-500 to-purple-600 shadow-purple-500/30',
              amber: 'from-amber-500 to-amber-600 shadow-amber-500/30',
            };
            return (
              <div
                key={stat.label}
                className={`group relative overflow-hidden rounded-2xl ${themeClasses.card} border p-5 transition-all duration-300 hover:scale-105`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[stat.color]} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className={`text-2xl font-bold ${themeClasses.text} group-hover:scale-105 transition-transform duration-300 origin-left`}>
                  {stat.value}
                </p>
                <p className={`text-sm ${themeClasses.textMuted}`}>{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Event Details */}
        <div
          className={`relative overflow-hidden rounded-3xl ${themeClasses.card} border p-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
          style={{ animationDelay: '900ms' }}
        >
          <h3 className={`text-xl font-bold mb-6 text-center ${themeClasses.text} flex items-center justify-center gap-2`}>
            <Calendar className="w-5 h-5 text-blue-400" />
            Event Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Calendar,
                color: 'blue',
                title: '27th August 2026',
                subtitle: 'Thursday',
                gradient: 'from-blue-500/20 to-cyan-500/20'
              },
              {
                icon: Clock,
                color: 'purple',
                title: '5:30 PM IST',
                subtitle: 'Reporting at 5:00 PM',
                gradient: 'from-purple-500/20 to-pink-500/20'
              },
              {
                icon: MapPin,
                color: 'green',
                title: 'Biswa Bangla',
                subtitle: 'Convention Center, Kolkata',
                gradient: 'from-green-500/20 to-emerald-500/20'
              },
            ].map((item, index) => {
              const Icon = item.icon;
              const iconColors: Record<string, string> = {
                blue: 'text-blue-400',
                purple: 'text-purple-400',
                green: 'text-green-400',
              };
              return (
                <div
                  key={item.title}
                  className={`group flex items-center gap-4 p-5 ${themeClasses.eventCard} rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`w-6 h-6 ${iconColors[item.color]}`} />
                  </div>
                  <div>
                    <p className={`font-semibold ${themeClasses.text}`}>{item.title}</p>
                    <p className={`text-sm ${themeClasses.textMuted}`}>{item.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className={`flex justify-center mt-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '1000ms' }}>
          <div className={`flex flex-col items-center gap-2 ${themeClasses.textSubtle}`}>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </div>
        </div>

        {/* Footer note */}
        <p className={`text-center text-sm mt-8 ${themeClasses.textSubtle} ${mounted ? 'animate-fade-in' : 'opacity-0'}`} style={{ animationDelay: '1100ms' }}>
          For any queries, please contact{' '}
          <a
            href="mailto:convocation@amasi.org"
            className="text-blue-400 hover:text-blue-300 transition-colors hover:underline"
          >
            convocation@amasi.org
          </a>
        </p>
      </div>

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.3; }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }

        .animate-bounce-soft {
          animation: bounce-soft 2s ease-in-out infinite;
        }

        .animate-pulse-soft {
          animation: pulse-soft 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
