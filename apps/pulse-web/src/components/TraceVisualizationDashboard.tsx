import { useState } from 'react';
import { useTraceVisualization } from '../hooks/useTraceVisualization';

function formatMs(value: number): string {
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`;
}

function TraceNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-2">
      <div
        className={`rounded-xl border p-3 ${node.rootSpan?.status === 'error' ? 'border-rose-400/20 bg-rose-500/10' : 'border-white/10 bg-black/20'}`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                {expanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="w-3 text-center text-white/20">•</span>
            )}
            <span className="font-semibold text-sm">{node.rootSpan?.name ?? 'root'}</span>
          </div>
          <span className="font-mono text-xs text-white/50">{formatMs(node.totalDurationMs ?? 0)}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-white/40 font-mono">
          <span>{node.rootSpan?.serviceName}</span>
          <span>•</span>
          <span>{node.rootSpan?.kind}</span>
          <span>•</span>
          <span>{node.rootSpan?.status?.toUpperCase()}</span>
        </div>
      </div>
      {expanded && hasChildren
        ? node.children.map((child: any, idx: number) => (
            <TraceNode key={idx} node={child} depth={depth + 1} />
          ))
        : null}
    </div>
  );
}

export function TraceVisualizationDashboard() {
  const {
    searchTraceId,
    setSearchTraceId,
    serviceFilter,
    setServiceFilter,
    traceTree,
    searchResults,
    serviceLatencies,
    services,
    isLoading,
    isError,
    STATUS_COLORS,
  } = useTraceVisualization();

  const [localTraceId, setLocalTraceId] = useState('');

  const handleSearch = () => {
    if (localTraceId.trim()) setSearchTraceId(localTraceId.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Distributed Trace Explorer
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Trace Visualization
        </span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={localTraceId}
          onChange={(e) => setLocalTraceId(e.target.value)}
          placeholder="Search by Trace ID..."
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-cyan focus:outline-none"
        />
        <button
          onClick={handleSearch}
          className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan transition hover:bg-cyan/20"
        >
          Search
        </button>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          <option value="all">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isError && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load trace data.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Trace Tree</h4>
          {!searchTraceId ? (
            <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
              Enter a Trace ID to visualize request flow.
            </div>
          ) : isLoading || !traceTree ? (
            <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
              Loading trace tree...
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <TraceNode node={traceTree} />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Service Latency Comparison</h4>
            <div className="space-y-2">
              {serviceLatencies.map((lat) => (
                <div key={lat.service} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">{lat.service}</span>
                    <span className="font-mono text-xs text-cyan">{formatMs(lat.avgLatencyMs)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan"
                      style={{ width: `${Math.min(100, (lat.p99LatencyMs / 2000) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-white/40 font-mono">
                    <span>P99: {formatMs(lat.p99LatencyMs)}</span>
                    <span>Spans: {lat.spanCount}</span>
                    <span className={lat.errorRate > 5 ? 'text-rose-300' : ''}>Error: {lat.errorRate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Recent Traces</h4>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {searchResults.map((t) => (
                <button
                  key={t.traceId}
                  onClick={() => setSearchTraceId(t.traceId)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${searchTraceId === t.traceId ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-cyan">{t.traceId.slice(0, 12)}...</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${t.errorCount > 0 ? 'border-rose-400/30 bg-rose-500/10 text-rose-300' : 'border-mint/30 bg-mint/10 text-mint'}`}>
                      {t.errorCount > 0 ? `${t.errorCount} failed` : 'ok'}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-white/40">
                    <span>{t.service}</span>
                    <span>{formatMs(t.durationMs)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
