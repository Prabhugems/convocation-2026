'use client';

import { CheckCircle, Circle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: 'completed' | 'pending' | 'in-progress';
  label: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const config = {
    completed: {
      bg: 'bg-green-100',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: CheckCircle,
    },
    pending: {
      bg: 'bg-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-600',
      icon: Circle,
    },
    'in-progress': {
      bg: 'bg-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-700',
      icon: Clock,
    },
  };

  const { bg, border, text, icon: Icon } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${border} ${text} border ${className}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
