'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { DollarSign, Users, ShoppingCart, Package, TrendingUp, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.get('/bi/dashboard/metrics').then((r) => r.data),
    refetchInterval: 30_000, // 30s live refresh
  });

  const { data: revenueChart } = useQuery({
    queryKey: ['revenue-chart', '12months'],
    queryFn: () => api.get('/bi/dashboard/charts/revenue?period=12months').then((r) => r.data),
  });

  const kpis = [
    {
      title: 'Total Revenue',
      value: metrics ? `$${(metrics.totalRevenue / 1000).toFixed(1)}K` : '—',
      icon: DollarSign,
      color: 'green' as const,
      change: '+12.5%',
    },
    {
      title: 'Net Profit',
      value: metrics ? `$${(metrics.netProfit / 1000).toFixed(1)}K` : '—',
      icon: TrendingUp,
      color: 'blue' as const,
      change: '+8.3%',
    },
    {
      title: 'Employees',
      value: metrics?.employeeCount ?? '—',
      icon: Users,
      color: 'purple' as const,
    },
    {
      title: 'Open POs',
      value: metrics?.openPOs ?? '—',
      icon: ShoppingCart,
      color: 'yellow' as const,
    },
    {
      title: 'Inventory Value',
      value: metrics ? `$${(metrics.inventoryValue / 1000).toFixed(1)}K` : '—',
      icon: Package,
      color: 'indigo' as const,
    },
    {
      title: 'Pending Invoices',
      value: metrics?.pendingInvoices ?? '—',
      icon: AlertCircle,
      color: 'red' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          Live · refreshes every 30s
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} loading={isLoading} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Expenses</h2>
          <RevenueChart data={revenueChart} />
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit Trend</h2>
          <RevenueChart data={revenueChart} type="line" />
        </div>
      </div>
    </div>
  );
}
