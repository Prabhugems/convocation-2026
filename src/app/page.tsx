'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/GlassCard';
import { Search, HelpCircle, Calendar, MapPin, Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Convocation date: 27th August 2026, 6:00 PM IST
const CONVOCATION_DATE = new Date('2026-08-27T18:00:00+05:30');

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/70 text-sm mb-6">
          <Calendar className="w-4 h-4" />
          27th August 2026
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          Convocation{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            2026
          </span>
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto">
          AMASI Certificate Management System
        </p>
      </div>

      {/* Countdown Timer */}
      <GlassCard className="p-6 md:p-8 mb-8">
        <div className="text-center mb-4">
          <p className="text-white/50 text-sm uppercase tracking-wide">Countdown to Convocation</p>
        </div>
        <div className="grid grid-cols-4 gap-3 md:gap-6 max-w-md mx-auto">
          {[
            { value: timeLeft.days, label: 'Days' },
            { value: timeLeft.hours, label: 'Hours' },
            { value: timeLeft.minutes, label: 'Minutes' },
            { value: timeLeft.seconds, label: 'Seconds' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="bg-white/10 rounded-xl p-3 md:p-4 mb-2">
                <p className="text-2xl md:text-4xl font-bold text-white font-mono">
                  {String(item.value).padStart(2, '0')}
                </p>
              </div>
              <p className="text-xs md:text-sm text-white/50">{item.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/track">
          <GlassCard hover className="p-6 md:p-8 h-full border-2 border-transparent hover:border-blue-500/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                <Search className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Track Your Certificate</h2>
                <p className="text-white/50">
                  Check your certificate status and download your digital badge using your convocation number
                </p>
              </div>
            </div>
          </GlassCard>
        </Link>

        <Link href="/faq">
          <GlassCard hover className="p-6 md:p-8 h-full border-2 border-transparent hover:border-purple-500/50 transition-all">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">FAQ</h2>
                <p className="text-white/50">
                  Common questions about the convocation ceremony, dress code, and certificate collection
                </p>
              </div>
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* Event Details */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">Event Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
            <Calendar className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-white font-medium">27th August 2026</p>
              <p className="text-white/50 text-sm">Thursday</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
            <Clock className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-white font-medium">6:00 PM IST</p>
              <p className="text-white/50 text-sm">Gates open at 4:30 PM</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
            <MapPin className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-white font-medium">Biswa Bangla</p>
              <p className="text-white/50 text-sm">Convention Center, Kolkata</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Footer note */}
      <p className="text-center text-white/30 text-sm mt-8">
        For any queries, please contact convocation@amasi.org
      </p>
    </div>
  );
}
