import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useApiAnalytics, type EndpointStats, type TimeBucket } from '../hooks/useApiAnalytics';

export function ApiAnalyticsDashboard() {
  const {
    summary, endpoints, slowest, timeSeries, trend,
    isLoading, isError, isSimulated, refetch, METHOD_COLORS,
  } = useApiAnalytics();

  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointStats | null>(null);
  const [filterService, setFilterService] = useState<string>('all');

  const services = useMemo(() => {
    const set = new Set(endpoints.map((e) => e.service));
    return ['all', ...Array.from(set)];
  }, [endpoints]);

  const filteredEndpoints = filterService === 'all' ? endpoints : endpoints.filter((e) => e.service === filterService);

  const maxTimeCount = Math.max(...timeSeries.map((t) => t.requestCount), 1);
  const maxTimeLatency = Math.max(...timeSeries.map((t) => t.avgResponseTime), 1);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    );
  }

  const trendColor = trend === 'improving' ? '#34d399' : trend === 'degrading' ? '#ef4444' : '#fbbf24';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">API Performance Analytics</h2>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
              isSimulated ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' : 'bg-mint/10 text-mint border-mint/30'
            }`}>
              {isSimulated ? '🔬 Demo' : '🟢 Live'}
            </span>
          </div>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {summary.totalEndpoints} endpoints · {summary.totalRequests.toLocaleString()} total requests · {summary.requestsPerMinute} req/min
          </p>
        </div>
        <button onClick={refetch} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <SummaryCard label="Avg Response Time" value={`${summary.avgResponseTimeAll}ms`} color="#60a5fa" />
        <SummaryCard label="P95 Latency" value={`${summary.p95ResponseTimeAll}ms`} color="#fbbf24" />
        <SummaryCard label="Success Rate" value={`${summary.overallSuccessRate}%`} color="#34d399" />
        <SummaryCard label="Error Rate" value={`${summary.overallErrorRate}%`} color="#ef4444" pulse={summary.overallErrorRate > 2} />
      </div>

      {/* Trend + RPM row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">Trend</div>
          <span className="font-mono text-sm font-bold" style={{ color: trendColor }}>
            {trend === 'improving' ? '↗ Improving' : trend === 'degrading' ? '↘ Degrading' : '→ Stable'}
          </span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">Requests/min</div>
          <div className="font-mono text-lg font-bold text-white">{summary.requestsPerMinute}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">P50 Latency</div>
          <div className="font-mono text-lg font-bold text-white">{summary.p50ResponseTimeAll}ms</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase">P99 Latency</div>
          <div className="font-mono text-lg font-bold text-white">{summary.p99ResponseTimeAll}ms</div>
        </div>
      </div>

      {/* Time Series Chart - Response Time + Request Volume */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">📈 24-Hour Response Time & Request Volume</div>
        <div className="h-28 flex items-end gap-[2px]">
          {timeSeries.map((bucket, i) => {
            const latencyHeight = (bucket.avgResponseTime / maxTimeLatency) * 100;
            const volumeHeight = (bucket.requestCount / maxTimeCount) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[1px]" title={`${new Date(bucket.timestamp).toLocaleTimeString()}: ${bucket.avgResponseTime}ms, ${bucket.requestCount} req`}>
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(latencyHeight, 2)}%`,
                    backgroundColor: bucket.errorCount > 0 ? 'rgba(239,68,68,0.6)' : 'rgba(96,165,250,0.5)',
                  }}
                />
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(volumeHeight, 2)}%`,
                    backgroundColor: 'rgba(52,211,153,0.3)',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[8px] font-mono text-white/30">
          <span>24h ago</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'rgba(96,165,250,0.5)' }} /> Latency</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: 'rgba(52,211,153,0.3)' }} /> Volume</span>
          </span>
          <span>Now</span>
        </div>
      </div>

      {/* Service filter */}
      <div className="flex gap-1 flex-wrap">
        {services.map((service) => (
          <button
            key={service}
            onClick={() => setFilterService(service)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
              filterService === service
                ? 'bg-cyan/20 text-cyan border border-cyan/30'
                : 'text-white/40 border border-transparent hover:text-white/60'
            }`}
          >
            {service === 'all' ? 'All' : service.replace('pulse-', '')}
          </button>
        ))}
      </div>

      {/* Slowest Endpoints */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-3 border-b border-white/10">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">🐢 Slowest Endpoints</div>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
          {filteredEndpoints.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/40">No endpoint data available</div>
          ) : (
            filteredEndpoints
              .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
              .map((ep) => {
                const isSelected = selectedEndpoint?.path === ep.path && selectedEndpoint?.method === ep.method;
                return (
                  <div
                    key={`${ep.method}-${ep.path}`}
                    onClick={() => setSelectedEndpoint(isSelected ? null : ep)}
                    className={`p-3 cursor-pointer transition-colors hover:bg-white/[0.02] ${isSelected ? 'bg-cyan/[0.03]' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold"
                          style={{ backgroundColor: `${METHOD_COLORS[ep.method]}22`, color: METHOD_COLORS[ep.method] }}>
                          {ep.method}
                        </span>
                        <span className="text-[10px] font-mono text-white/70 truncate max-w-[300px]">{ep.path}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold" style={{ color: ep.avgResponseTime > 200 ? '#ef4444' : ep.avgResponseTime > 100 ? '#fbbf24' : '#34d399' }}>
                        {ep.avgResponseTime}ms
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[8px] font-mono text-white/30">
                      <span>{ep.service}</span>
                      <span>{ep.requestCount.toLocaleString()} req</span>
                      <span style={{ color: ep.errorRate > 2 ? '#ef4444' : '#34d399' }}>{ep.errorRate}% err</span>
                      <span>P95: {ep.p95ResponseTime}ms</span>
                      <span>P99: {ep.p99ResponseTime}ms</span>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Expanded Endpoint Detail */}
      {selectedEndpoint && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded text-[10px] font-mono font-bold"
                style={{ backgroundColor: `${METHOD_COLORS[selectedEndpoint.method]}22`, color: METHOD_COLORS[selectedEndpoint.method] }}>
                {selectedEndpoint.method}
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">{selectedEndpoint.path}</h3>
                <p className="text-[10px] font-mono text-white/40 mt-0.5">{selectedEndpoint.service}</p>
              </div>
            </div>
            <button onClick={() => setSelectedEndpoint(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
            <DetailField label="Avg Response" value={`${selectedEndpoint.avgResponseTime}ms`}
              color={selectedEndpoint.avgResponseTime > 200 ? '#ef4444' : '#34d399'} />
            <DetailField label="P50 / P95 / P99" value={`${selectedEndpoint.p50ResponseTime} / ${selectedEndpoint.p95ResponseTime} / ${selectedEndpoint.p99ResponseTime}ms`} color="#60a5fa" />
            <DetailField label="Min / Max" value={`${selectedEndpoint.minResponseTime} / ${selectedEndpoint.maxResponseTime}ms`} color="#9ca3af" />
            <DetailField label="Success Rate" value={`${selectedEndpoint.successRate}%`} color={selectedEndpoint.successRate >= 99 ? '#34d399' : '#fbbf24'} />
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <DetailField label="Total Requests" value={selectedEndpoint.requestCount.toLocaleString()} color="#86d9ff" />
            <DetailField label="Errors" value={selectedEndpoint.errorCount.toLocaleString()} color="#ef4444" />
            <DetailField label="Error Rate" value={`${selectedEndpoint.errorRate}%`} color={selectedEndpoint.errorRate > 2 ? '#ef4444' : '#34d399'} />
            <DetailField label="Data Transfer" value={`${formatBytes(selectedEndpoint.totalBytesSent + selectedEndpoint.totalBytesReceived)}`} color="#a78bfa" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function SummaryCard({ label, value, color, pulse }: { label: string; value: string; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-2xl font-bold mt-0.5 flex items-center gap-1.5" style={{ color }}>
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
        {value}
      </div>
    </div>
  );
}

function DetailField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs font-semibold truncate" style={{ color }} title={value}>{value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}