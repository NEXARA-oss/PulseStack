import { useQueryPerformance } from '../hooks/useQueryPerformance';

function ImpactBadge({ impact }: { impact: string }) {
  const colors: Record<string, string> = {
    low: 'border-white/10 bg-white/5 text-white/40',
    medium: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    high: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  };
  return <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${colors[impact]}`}>{impact}</span>;
}

export function QueryPerformanceDashboard() {
  const { queries, slowQueries, stats, filterSlow, setFilterSlow, isLoading, isError } = useQueryPerformance();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load query performance data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Query Performance Analyzer
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Execution Insights
        </span>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/50 uppercase tracking-wider">Total Queries</div>
            <div className="mt-1 font-mono text-xl text-cyan">{stats.totalQueries}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/50 uppercase tracking-wider">Avg Execution</div>
            <div className="mt-1 font-mono text-xl text-white">{stats.avgExecutionTimeMs}ms</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/50 uppercase tracking-wider">Slow Queries</div>
            <div className="mt-1 font-mono text-xl text-rose-300">{stats.slowQueryCount}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/50 uppercase tracking-wider">Slow Rate</div>
            <div className="mt-1 font-mono text-xl text-mint">{stats.slowPercentage}%</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterSlow(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${!filterSlow ? 'bg-cyan/20 text-cyan border border-cyan/30' : 'text-white/60 border border-white/10'}`}
          >
            All Queries
          </button>
          <button
            onClick={() => setFilterSlow(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filterSlow ? 'bg-rose-400/20 text-rose-300 border border-rose-400/30' : 'text-white/60 border border-white/10'}`}
          >
            Slow Only
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {(filterSlow ? slowQueries : queries).map((q) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-cyan">{q.endpoint}</span>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${q.isSlow ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-mint/30 bg-mint/10 text-mint'}`}>
                {q.isSlow ? 'SLOW' : 'ok'}
              </span>
            </div>
            <div className="mt-1 text-xs text-white/40 font-mono truncate">{q.queryText}</div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/50">
              <span>{q.executionTimeMs}ms</span>
              <span>Scanned: {q.rowsScanned}</span>
              <span>CPU: {q.resourceUsage.cpuMs}ms</span>
              <span>Mem: {q.resourceUsage.memoryMb}MB</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
