import { useMetricCorrelation } from '../hooks/useMetricCorrelation';

function CorrelationBadge({ strength, direction }: { strength: string; direction: string }) {
  const colorMap: Record<string, string> = {
    strong: 'text-cyan',
    moderate: 'text-mint',
    weak: 'text-white/50',
  };
  const dirMap: Record<string, string> = {
    positive: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    negative: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
    none: 'bg-white/5 border-white/10 text-white/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono uppercase ${dirMap[direction]}`}>
      <span className={colorMap[strength]}>{strength}</span>
      <span className="opacity-70">{direction}</span>
    </span>
  );
}

export function MetricCorrelationDashboard() {
  const {
    metricA,
    setMetricA,
    metricB,
    setMetricB,
    sourceFilter,
    setSourceFilter,
    series,
    matrix,
    metrics,
    sources,
    isLoading,
    isError,
    METRIC_COLORS,
  } = useMetricCorrelation();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load correlation data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Metric Correlation Explorer
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Multi-Metric Analysis
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={metricA}
          onChange={(e) => setMetricA(e.target.value as MetricName)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          {metrics.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-xs text-white/40">vs</span>
        <select
          value={metricB}
          onChange={(e) => setMetricB(e.target.value as MetricName)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          {metrics.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Overlay Visualization</h4>
          <div className="relative h-[250px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-white/40 text-sm">Loading...</div>
            ) : (
              <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
                {series.slice(0, 2).map((s, idx) => {
                  const max = Math.max(...s.points.map((p) => p.value));
                  const min = Math.min(...s.points.map((p) => p.value));
                  const range = max - min || 1;
                  const points = s.points
                    .map((p, i) => {
                      const x = (i / (s.points.length - 1)) * 100;
                      const y = 100 - ((p.value - min) / range) * 100;
                      return `${x},${y}`;
                    })
                    .join(' ');
                  return (
                    <polyline
                      key={idx}
                      points={points}
                      fill="none"
                      stroke={METRIC_COLORS[s.name]}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </svg>
            )}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-white/50">
            {series.slice(0, 2).map((s) => (
              <span key={s.name} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: METRIC_COLORS[s.name] }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Correlation Matrix</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {matrix.map((c) => (
              <div key={`${c.metricA}-${c.metricB}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <span className="text-white/70">
                  {c.metricA} ↔ {c.metricB}
                </span>
                <CorrelationBadge strength={c.strength} direction={c.direction} />
                <span className="font-mono text-xs text-white/50">{c.coefficient}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
