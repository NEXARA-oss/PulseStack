import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import type { TrendDataPoint, TimeRange } from '../hooks/usePerformanceTrends';

type ComparisonMetric = 'cpuUsage' | 'memoryUtilization' | 'responseTime' | 'errorRate' | 'executions' | 'tokensUsed' | 'cost';

const COMPARISON_METRICS: { key: ComparisonMetric; label: string; color: string }[] = [
  { key: 'cpuUsage', label: 'CPU Usage (%)', color: '#86d9ff' },
  { key: 'memoryUtilization', label: 'Memory (%)', color: '#74e8a0' },
  { key: 'responseTime', label: 'Response Time (ms)', color: '#fbbf24' },
  { key: 'errorRate', label: 'Error Rate (%)', color: '#f87171' },
  { key: 'executions', label: 'Executions', color: '#a78bfa' },
  { key: 'tokensUsed', label: 'Tokens Used', color: '#60a5fa' },
  { key: 'cost', label: 'Cost ($)', color: '#f472b6' },
];

type HistoricalComparisonProps = {
  previousPeriod: TrendDataPoint[];
  currentPeriod: TrendDataPoint[];
  timeRange: TimeRange;
};

export function HistoricalComparison({ previousPeriod, currentPeriod, timeRange }: HistoricalComparisonProps) {
  const [selectedMetric, setSelectedMetric] = useState<ComparisonMetric>('cpuUsage');

  const chartData = useMemo(() => {
    return currentPeriod.map((current, index) => {
      const previous = previousPeriod[index];
      const currentVal = current[selectedMetric] as number;
      const previousVal = previous ? (previous[selectedMetric] as number) : 0;
      const change = previousVal > 0 ? ((currentVal - previousVal) / previousVal) * 100 : 0;
      return {
        label: formatDateLabel(current.date, timeRange),
        Current: currentVal,
        Previous: previousVal,
        change: parseFloat(change.toFixed(1)),
      };
    });
  }, [currentPeriod, previousPeriod, selectedMetric, timeRange]);

  const averages = useMemo(() => {
    const currentAvg = currentPeriod.reduce((sum, d) => sum + (d[selectedMetric] as number), 0) / currentPeriod.length;
    const prevAvg = previousPeriod.length > 0
      ? previousPeriod.reduce((sum, d) => sum + (d[selectedMetric] as number), 0) / previousPeriod.length
      : 0;
    const change = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;
    return {
      current: parseFloat(currentAvg.toFixed(2)),
      previous: parseFloat(prevAvg.toFixed(2)),
      change: parseFloat(change.toFixed(1)),
    };
  }, [currentPeriod, previousPeriod, selectedMetric]);

  const metricInfo = COMPARISON_METRICS.find((m) => m.key === selectedMetric)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white mb-3">Historical Comparison</h3>
        <div className="flex flex-wrap gap-1.5">
          {COMPARISON_METRICS.map((metric) => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all border ${
                selectedMetric === metric.key
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/5 bg-white/[0.03] text-white/50 hover:text-white/70'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">Current Avg</div>
          <div className="font-mono text-lg font-bold text-white mt-1">
            {formatMetricValue(averages.current, selectedMetric)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">Previous Avg</div>
          <div className="font-mono text-lg font-bold text-white/60 mt-1">
            {formatMetricValue(averages.previous, selectedMetric)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">Change</div>
          <div className={`font-mono text-lg font-bold mt-1 ${averages.change > 0 ? 'text-rose-400' : averages.change < 0 ? 'text-mint' : 'text-white/60'}`}>
            {averages.change > 0 ? '+' : ''}{averages.change}%
          </div>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-white/10 bg-black/90 px-4 py-3 shadow-xl backdrop-blur-sm">
                    <div className="text-xs font-mono text-white/60 mb-2">{label}</div>
                    {payload.map((entry: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-white/80">{entry.name}:</span>
                        <span className="font-mono font-bold text-white">
                          {formatMetricValue(entry.value as number, selectedMetric)}
                        </span>
                      </div>
                    ))}
                    {payload[0]?.payload?.change !== undefined && (
                      <div className={`mt-2 text-[10px] font-mono ${payload[0].payload.change > 0 ? 'text-rose-400' : payload[0].payload.change < 0 ? 'text-mint' : 'text-white/40'}`}>
                        {payload[0].payload.change > 0 ? '↑' : payload[0].payload.change < 0 ? '↓' : '→'} {Math.abs(payload[0].payload.change)}% vs previous
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}
            />
            <Bar dataKey="Previous" name="Previous Period" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Current" name="Current Period" fill={metricInfo.color} radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

function formatMetricValue(value: number, metric: ComparisonMetric): string {
  switch (metric) {
    case 'cpuUsage':
    case 'memoryUtilization':
    case 'errorRate':
      return `${value.toFixed(1)}%`;
    case 'responseTime':
      return `${value.toFixed(0)}ms`;
    case 'executions':
      return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(0);
    case 'tokensUsed':
      return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(0);
    case 'cost':
      return `$${value.toFixed(4)}`;
    default:
      return value.toFixed(1);
  }
}

function formatDateLabel(date: string, timeRange: TimeRange): string {
  if (timeRange === '24h') {
    return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}