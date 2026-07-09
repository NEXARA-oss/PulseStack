import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Panel } from '@pulsestack/ui';
import { motion } from 'framer-motion';
import type { TrendDataPoint, TimeRange } from '../hooks/usePerformanceTrends';

type ChartType = 'line' | 'area' | 'bar';

type TrendChartProps = {
  title: string;
  data: TrendDataPoint[];
  dataKey: keyof TrendDataPoint;
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  unit?: string;
  chartType?: ChartType;
  timeRange?: TimeRange;
  comparisonData?: TrendDataPoint[];
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
};

type ChartDataKey = Extract<keyof TrendDataPoint, 'cpuUsage' | 'memoryUtilization' | 'responseTime' | 'errorRate' | 'executions' | 'tokensUsed' | 'cost'>;

const CHART_COLORS: Record<ChartDataKey, string> = {
  cpuUsage: '#86d9ff',
  memoryUtilization: '#74e8a0',
  responseTime: '#fbbf24',
  errorRate: '#f87171',
  executions: '#a78bfa',
  tokensUsed: '#60a5fa',
  cost: '#f472b6',
} as const;

const GRADIENTS: Record<ChartDataKey, { from: string; to: string }> = {
  cpuUsage: { from: 'rgba(134,217,255,0.3)', to: 'rgba(134,217,255,0.01)' },
  memoryUtilization: { from: 'rgba(116,232,160,0.3)', to: 'rgba(116,232,160,0.01)' },
  responseTime: { from: 'rgba(251,191,36,0.3)', to: 'rgba(251,191,36,0.01)' },
  errorRate: { from: 'rgba(248,113,113,0.3)', to: 'rgba(248,113,113,0.01)' },
  executions: { from: 'rgba(167,139,250,0.3)', to: 'rgba(167,139,250,0.01)' },
  tokensUsed: { from: 'rgba(96,165,250,0.3)', to: 'rgba(96,165,250,0.01)' },
  cost: { from: 'rgba(244,114,182,0.3)', to: 'rgba(244,114,182,0.01)' },
};

export function TrendChart({
  title,
  data,
  dataKey,
  color,
  gradientFrom,
  gradientTo,
  unit = '',
  chartType: initialChartType = 'line',
  timeRange = '7d',
  comparisonData,
  yAxisLabel,
  formatValue,
}: TrendChartProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const chartDataKey = dataKey as ChartDataKey;
  const lineColor = color ?? CHART_COLORS[chartDataKey] ?? '#86d9ff';
  const grad = GRADIENTS[chartDataKey] ?? { from: 'rgba(134,217,255,0.3)', to: 'rgba(134,217,255,0.01)' };
  const fromColor = gradientFrom ?? grad.from;
  const toColor = gradientTo ?? grad.to;

  const displayData = useMemo(() => {
    const maxPoints = timeRange === '24h' ? 24 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return data.slice(-maxPoints).map((d) => ({
      ...d,
      label: formatDateLabel(d.date, timeRange),
      [dataKey]: d[dataKey] as number,
      ...(comparisonData ? { comparison: comparisonData.slice(-maxPoints).find((c) => c.date === d.date)?.[dataKey] as number ?? 0 } : {}),
    }));
  }, [data, dataKey, timeRange, comparisonData]);

  const formatVal = formatValue ?? ((v: number) => {
    if (typeof v !== 'number') return '0';
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(1);
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-white/10 bg-black/90 px-4 py-3 shadow-xl backdrop-blur-sm">
        <div className="text-xs font-mono text-white/60 mb-2">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white/80">{entry.name}:</span>
            <span className="font-mono font-bold text-white">{formatVal(entry.value)}{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    const commonProps = {
      data: displayData,
      margin: { top: 10, right: 10, left: 0, bottom: 0 },
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatVal} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey={dataKey} name={title} stroke={lineColor} fill={`url(#gradient-${dataKey})`} strokeWidth={2} />
            {comparisonData && (
              <Area type="monotone" dataKey="comparison" name="Previous Period" stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.02)" strokeWidth={1} strokeDasharray="4 4" />
            )}
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatVal} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} name={title} fill={lineColor} radius={[4, 4, 0, 0]} opacity={0.8} />
          </BarChart>
        );
      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatVal} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey={dataKey} name={title} stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: lineColor }} />
            {comparisonData && (
              <Line type="monotone" dataKey="comparison" name="Previous Period" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            )}
          </LineChart>
        );
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {yAxisLabel && <span className="text-[10px] font-mono text-white/40 uppercase">{yAxisLabel}</span>}
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
          {(['line', 'area', 'bar'] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all ${
                chartType === type
                  ? 'bg-cyan/20 text-cyan'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function formatDateLabel(date: string, timeRange: TimeRange): string {
  if (timeRange === '24h') {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrendSummaryCards({ summary, data }: { summary: any; data: TrendDataPoint[] }) {
  const cards = [
    {
      label: 'Avg CPU Usage',
      value: `${summary.cpu.avg}%`,
      trend: summary.cpu.trend,
      color: '#86d9ff',
      details: `Peak: ${summary.cpu.max}% · Min: ${summary.cpu.min}%`,
    },
    {
      label: 'Avg Memory',
      value: `${summary.memory.avg}%`,
      trend: summary.memory.trend,
      color: '#74e8a0',
      details: `Peak: ${summary.memory.max}% · Min: ${summary.memory.min}%`,
    },
    {
      label: 'Avg Response Time',
      value: `${summary.responseTime.avg}ms`,
      trend: summary.responseTime.trend,
      color: '#fbbf24',
      details: `Peak: ${summary.responseTime.max}ms · Min: ${summary.responseTime.min}ms`,
    },
    {
      label: 'Avg Error Rate',
      value: `${summary.errorRate.avg}%`,
      trend: summary.errorRate.trend,
      color: '#f87171',
      details: `Peak: ${summary.errorRate.max}% · Min: ${summary.errorRate.min}%`,
    },
  ];

  const totals = [
    {
      label: 'Total Executions',
      value: data.reduce((sum, d) => sum + d.executions, 0).toLocaleString(),
      color: '#a78bfa',
    },
    {
      label: 'Total Tokens',
      value: data.reduce((sum, d) => sum + d.tokensUsed, 0).toLocaleString(),
      color: '#60a5fa',
    },
    {
      label: 'Total Cost',
      value: `$${data.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}`,
      color: '#f472b6',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">{card.label}</span>
              <TrendBadge trend={card.trend} />
            </div>
            <div className="font-mono text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="mt-1 text-[10px] font-mono text-white/40">{card.details}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((total) => (
          <div
            key={total.label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all"
          >
            <div className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">{total.label}</div>
            <div className="font-mono text-xl font-bold" style={{ color: total.color }}>
              {total.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  const config = {
    up: { label: '↑ Rising', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    down: { label: '↓ Declining', className: 'bg-mint/20 text-mint border-mint/30' },
    stable: { label: '→ Stable', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  };
  const c = config[trend];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  );
}