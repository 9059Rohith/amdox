'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

interface RevenueChartProps {
  data?: Array<{ month: string; revenue: number; expenses: number }>;
  type?: 'bar' | 'line';
}

export function RevenueChart({ data = [], type = 'bar' }: RevenueChartProps) {
  const labels = data.map((d) => new Date(d.month).toLocaleDateString('en', { month: 'short', year: '2-digit' }));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Revenue',
        data: data.map((d) => d.revenue),
        backgroundColor: type === 'bar' ? 'rgba(99,102,241,0.8)' : undefined,
        borderColor: 'rgb(99,102,241)',
        borderWidth: 2,
        fill: type === 'line',
      },
      {
        label: 'Expenses',
        data: data.map((d) => d.expenses),
        backgroundColor: type === 'bar' ? 'rgba(244,63,94,0.7)' : undefined,
        borderColor: 'rgb(244,63,94)',
        borderWidth: 2,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.dataset.label}: $${(ctx.raw / 1000).toFixed(1)}K`,
        },
      },
    },
    scales: {
      y: { ticks: { callback: (v: any) => `$${(v / 1000).toFixed(0)}K` } },
    },
    onClick: (_: any, elements: any[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        const segment = labels[idx];
        // Drill-down: emit event or navigate
        window.dispatchEvent(new CustomEvent('chart-drill-down', { detail: { chart: 'revenue', segment } }));
      }
    },
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return type === 'bar'
    ? <Bar data={chartData} options={options} aria-label="Revenue vs Expenses bar chart" />
    : <Line data={chartData} options={options as any} aria-label="Profit trend line chart" />;
}
