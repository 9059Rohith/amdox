'use client';

import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

type Color = 'green' | 'blue' | 'purple' | 'yellow' | 'indigo' | 'red';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: Color;
  change?: string;
  loading?: boolean;
}

const colorMap: Record<Color, { bg: string; icon: string; change: string }> = {
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  change: 'text-green-600' },
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   change: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', change: 'text-purple-600' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', change: 'text-yellow-600' },
  indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', change: 'text-indigo-600' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    change: 'text-red-600' },
};

export function KpiCard({ title, value, icon: Icon, color, change, loading }: KpiCardProps) {
  const colors = colorMap[color];
  return (
    <div className="card p-4 flex flex-col gap-3" role="region" aria-label={title}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        <div className={clsx('p-2 rounded-lg', colors.bg)}>
          <Icon className={clsx('w-4 h-4', colors.icon)} aria-hidden="true" />
        </div>
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" aria-busy="true" />
      ) : (
        <div className="text-2xl font-bold text-gray-900" aria-live="polite">{value}</div>
      )}
      {change && (
        <span className={clsx('text-xs font-medium', colors.change)}>
          {change} vs last period
        </span>
      )}
    </div>
  );
}
