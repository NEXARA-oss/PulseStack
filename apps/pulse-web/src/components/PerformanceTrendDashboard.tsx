import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import { TrendChart, TrendSummaryCards } from './TrendChart';
import { HistoricalComparison } from './HistoricalComparison';
import {
  usePerformanceTrends,
  generateMockTrendData,
  type TimeRange,
  type PerformanceTrendsResponse,
} from '../hooks/usePerformanceTrends';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export function PerformanceTrendDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [showComparison, setShowComparison] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportedData, setExportedData] = useState<string | null>(null);
  const exportRef = useRef<HTMLPreElement>(null);

  // Use mock data since the backend endpoint may not exist yet
  const [mockData] = useState<PerformanceTrendsResponse>(() => generateMockTrendData(timeRange));

  const trends = usePerformanceTrends(timeRange);

  const data = trends.data ?? mockData;
  const isLoading = trends.isLoading;
  const isError = trends.isError;

  const handleExport = useCallback(() => {
    setExporting(true);
    try {
      const rows = data.daily;
      const headers = 'Date,CPU Usage (%),Memory (%),Response Time (ms),Error Rate (%),Executions,Tokens Used,Cost ($)';
      const csvRows = rows.map((d) =>
        `${d.date},${d.cpuUsage.toFixed(2)},${d.memoryUtilization.toFixed(2)},${d.responseTime.toFixed(2)},${d.errorRate.toFixed(2)},${d.executions},${d.tokensUsed},${d.cost.toFixed(4)}`
      );
      const csv = [headers, ...csvRows].join('\n');
      setExportedData(csv);

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-trends-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [data, timeRange]);

  const activeData = timeRange === '24h' ? data.hourly : data.daily;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Performance Trend Analytics</h2>
          <p className="text-xs text-white/50 mt-1 font-mono">
            Historical infrastructure performance metrics and long-term trend analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  timeRange === range.value
                    ? 'bg-cyan/20 text-cyan shadow-sm border border-cyan/30'
                    : 'text-white/60 hover:text-white border border-transparent'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Comparison Toggle */}
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              showComparison
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                : 'bg-white/[0.03] text-white/60 hover:text-white border-white/10'
            }`}
          >
            {showComparison ? 'Hide Comparison' : 'Compare Periods'}
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06] disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-white/50">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            <span className="text-sm font-mono">Loading trend data...</span>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-sm text-amber-200 font-semibold">Using simulated data</p>
          <p className="text-xs text-amber-100/60 mt-1">
            The trend analytics API endpoint is not yet available. Showing generated mock data for demonstration.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <TrendSummaryCards summary={data.summary} data={activeData} />

      {/* Main Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart
          title="CPU Usage Trends"
          data={activeData}
          dataKey="cpuUsage"
          unit="%"
          timeRange={timeRange}
          yAxisLabel="CPU Utilization %"
          comparisonData={showComparison ? data.comparison.previousPeriod : undefined}
        />
        <TrendChart
          title="Memory Utilization"
          data={activeData}
          dataKey="memoryUtilization"
          unit="%"
          timeRange={timeRange}
          yAxisLabel="Memory Usage %"
          comparisonData={showComparison ? data.comparison.previousPeriod : undefined}
        />
        <TrendChart
          title="Response Time"
          data={activeData}
          dataKey="responseTime"
          unit="ms"
          timeRange={timeRange}
          yAxisLabel="Latency (ms)"
          comparisonData={showComparison ? data.comparison.previousPeriod : undefined}
        />
        <TrendChart
          title="Error Rate"
          data={activeData}
          dataKey="errorRate"
          unit="%"
          timeRange={timeRange}
          yAxisLabel="Error %"
          comparisonData={showComparison ? data.comparison.previousPeriod : undefined}
        />
      </div>

      {/* Secondary Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <TrendChart
          title="Execution Volume"
          data={activeData}
          dataKey="executions"
          chartType="bar"
          timeRange={timeRange}
          yAxisLabel="Number of Executions"
          formatValue={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}
        />
        <TrendChart
          title="Token Consumption"
          data={activeData}
          dataKey="tokensUsed"
          chartType="area"
          timeRange={timeRange}
          yAxisLabel="Tokens Used"
          formatValue={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}
        />
        <TrendChart
          title="Cost Analysis"
          data={activeData}
          dataKey="cost"
          chartType="area"
          timeRange={timeRange}
          yAxisLabel="Cost ($)"
          formatValue={(v) => `$${v.toFixed(4)}`}
        />
      </div>

      {/* Historical Comparison */}
      {showComparison && (
        <HistoricalComparison
          previousPeriod={data.comparison.previousPeriod}
          currentPeriod={data.comparison.currentPeriod}
          timeRange={timeRange}
        />
      )}

      {/* Exported Data Preview */}
      {exportedData && (
        <Panel title="Exported Data Preview">
          <pre
            ref={exportRef}
            className="max-h-[200px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-[10px] font-mono text-white/60 leading-relaxed"
          >
            {exportedData}
          </pre>
          <div className="mt-2 text-[10px] text-white/40 font-mono">
            CSV file has been downloaded. Showing preview of exported data.
          </div>
        </Panel>
      )}
    </motion.div>
  );
}