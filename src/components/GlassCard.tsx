'use client';

import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export default function GlassCard({ children, className = '', hover = false, onClick }: GlassCardProps) {
  const baseClasses = 'backdrop-blur-lg bg-white/10 border border-white/20 rounded-2xl shadow-xl';
  const hoverClasses = hover ? 'transition-all duration-300 hover:bg-white/15 hover:border-white/30 hover:scale-[1.02] cursor-pointer' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
