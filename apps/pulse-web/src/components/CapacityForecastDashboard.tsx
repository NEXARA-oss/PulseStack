import { useCapacityForecast } from '../hooks/useCapacityForecast';

function TrendBar({ label, current, forecast7d, forecast30d, warning, colors }: { label: string; current: number; forecast7d: number; forecast30d: number; warning?: any; colors: Record<string, { bg: string; text: string; border: string }> }) {
  const max = 100;
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        {warning && (
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border" style={{ background: colors[warning.severity].bg, color: colors[warning.severity].text, borderColor: colors[warning.severity].border }}>
            {warning.severity}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-white/50">
            <span>Current</span>
            <span className="font-mono">{current.toFixed(1)}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.min(100, current)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/40">7d Forecast</div>
            <div className="mt-1 font-mono text-sm text-white/70">{forecast7d.toFixed(1)}%</div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, forecast7d)}%` }} />
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40">30d Forecast</div>
            <div className="mt-1 font-mono text-sm text-white/70">{forecast30d.toFixed(1)}%</div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${forecast30d > 80 ? 'bg-rose-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, forecast30d)}%` }} />
            </div>
          </div>
        </div>
        {warning && (
          <div className="mt-2 rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-xs text-rose-200">
            {warning.message}
          </div>
        )}
      </div>
    </div>
  );
}

export function CapacityForecastDashboard() {
  const { resources, warnings, diskGrowth, resourceFilter, setResourceFilter, isLoading, isError, SEVERITY_COLORS } = useCapacityForecast();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load capacity forecast data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Capacity Forecast
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Predictive Scaling
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {['all', 'cpu', 'memory', 'disk'].map((r) => (
          <button
            key={r}
            onClick={() => setResourceFilter(r as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              resourceFilter === r ? 'bg-cyan/20 text-cyan border border-cyan/30' : 'text-white/60 border border-white/10 hover:border-white/20'
            }`}
          >
            {r === 'all' ? 'All Resources' : r.toUpperCase()}
          </button>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {warnings.map((w) => (
            <div key={w.id} className="rounded-xl border p-3" style={{ background: SEVERITY_COLORS[w.severity].bg, borderColor: SEVERITY_COLORS[w.severity].border }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: SEVERITY_COLORS[w.severity].text }}>{w.resource.toUpperCase()} Warning</span>
                <span className="text-xs opacity-70">{w.service}</span>
              </div>
              <div className="mt-1 text-xs opacity-80">{w.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <TrendBar key={r.key} label={r.label} current={r.data.current} forecast7d={r.data.forecast7d} forecast30d={r.data.forecast30d} warning={r.data.warning} colors={SEVERITY_COLORS} />
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Disk Growth Forecast</h4>
        <div className="space-y-2">
          {diskGrowth.map((d) => (
            <div key={d.service} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-white/70">{d.service}</span>
                <span className="text-xs text-white/40">{d.growthRateGBPerDay.toFixed(2)} GB/day</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-white/60">{d.currentGB} GB</span>
                <span className="font-mono text-xs text-white/60">→</span>
                <span className="font-mono text-xs text-cyan">{d.forecastedGB} GB</span>
                <span className={`text-xs font-mono ${d.daysUntilFull < 14 ? 'text-rose-300' : 'text-white/50'}`}>
                  {d.daysUntilFull < 999 ? `${d.daysUntilFull}d to full` : 'stable'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
