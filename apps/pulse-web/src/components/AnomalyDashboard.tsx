import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnomalyDetection, type AnomalyResult, type AnomalySeverity, type MetricType } from '../hooks/useAnomalyDetection';

export function AnomalyDashboard() {
  const {
    summary,
    activeAlerts,
    history,
    isLoading,
    isError,
    isSimulated,
    refetch,
    SEVERITY_COLORS,
    METRIC_LABELS,
    METRIC_UNITS,
  } = useAnomalyDetection();

  const [selectedAlert, setSelectedAlert] = useState<AnomalyResult | null>(null);
  const [typeFilter, setTypeFilter] = useState<MetricType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | 'all'>('all');

  const filteredAlerts = useMemo(() => {
    let result = activeAlerts;
    if (typeFilter !== 'all') result = result.filter((a) => a.type === typeFilter);
    if (severityFilter !== 'all') result = result.filter((a) => a.severity === severityFilter);
    return result;
  }, [activeAlerts, typeFilter, severityFilter]);

  const healthScoreColor = summary.healthScore >= 80 ? '#34d399' : summary.healthScore >= 60 ? '#fbbf24' : '#ef4444';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">AI Infrastructure Anomaly Detection</h2>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
              isSimulated ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' : 'bg-mint/10 text-mint border-mint/30'
            }`}>
              {isSimulated ? '🔬 Demo Mode' : '🟢 Live'}
            </span>
          </div>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {summary.totalAnomalies} anomalies tracked · {activeAlerts.length} active alerts
            {isSimulated && ' · Using simulated data (API unavailable)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">
            Refresh
          </button>
        </div>
      </div>

      {/* Health Score + Active Alerts Overview */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* Health Score Gauge */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center justify-center">
          <div className="relative h-20 w-20 flex items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="32" fill="none"
                stroke={healthScoreColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 32 * (1 - summary.healthScore / 100),
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <span className="font-mono text-2xl font-bold" style={{ color: healthScoreColor }}>
              {summary.healthScore}
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-white/40 uppercase tracking-wider">Health Score</div>
        </div>

        {/* Severity breakdown */}
        {(['critical', 'high', 'medium', 'low'] as AnomalySeverity[]).map((severity) => {
          const count = summary.bySeverity[severity];
          const colors = SEVERITY_COLORS[severity];
          return (
            <motion.button
              key={severity}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setSeverityFilter(severityFilter === severity ? 'all' : severity)}
              className={`rounded-xl border p-3 text-left transition-all ${
                severityFilter === severity ? 'ring-1 ring-white/30' : ''
              }`}
              style={{
                backgroundColor: colors.bg,
                borderColor: severityFilter === severity ? colors.text : colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider" style={{ color: colors.text }}>
                  {severity}
                </span>
                {count > 0 && severity === 'critical' && (
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: colors.text, boxShadow: `0 0 6px ${colors.glow}` }} />
                )}
              </div>
              <div className="mt-1 font-mono text-2xl font-bold" style={{ color: colors.text }}>
                {count}
              </div>
              <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mt-0.5">alerts</div>
            </motion.button>
          );
        })}
      </div>

      {/* AI Insights */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">🧠 AI-Generated Insights</div>
        <div className="space-y-1.5">
          {summary.topInsights.length > 0 ? (
            summary.topInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="text-[11px] font-mono text-white/70 leading-relaxed"
              >
                {insight}
              </motion.div>
            ))
          ) : (
            <div className="text-[11px] font-mono text-white/40">No insights available.</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex gap-1">
          {(['all', 'cpu', 'memory', 'network', 'disk', 'latency', 'error_rate', 'throughput'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
                typeFilter === type
                  ? 'bg-cyan/20 text-cyan border border-cyan/30'
                  : 'text-white/40 border border-transparent hover:text-white/60'
              }`}
            >
              {type === 'all' ? 'All' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Active Alerts Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <tr className="border-b border-white/10">
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-8"></th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-20">Severity</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Type</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Source</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell">Message</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-24 hidden lg:table-cell">Confidence</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-20">Time</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filteredAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="text-sm text-white/40">No active alerts</div>
                      <div className="text-[10px] text-white/30 mt-1">System operating within normal parameters</div>
                    </td>
                  </tr>
                ) : (
                  filteredAlerts.map((alert) => {
                    const colors = SEVERITY_COLORS[alert.severity];
                    const isSelected = selectedAlert?.id === alert.id;

                    return (
                      <motion.tr
                        key={alert.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        onClick={() => setSelectedAlert(isSelected ? null : alert)}
                        className={`border-b border-white/5 transition-colors cursor-pointer ${
                          alert.severity === 'critical' ? 'hover:bg-rose-500/5' : 'hover:bg-white/[0.02]'
                        } ${isSelected ? 'bg-white/[0.03]' : ''}`}
                      >
                        <td className="p-2.5">
                          {alert.severity === 'critical' && (
                            <span className="h-2 w-2 rounded-full block animate-pulse" style={{ backgroundColor: colors.text, boxShadow: `0 0 6px ${colors.glow}` }} />
                          )}
                        </td>
                        <td className="p-2.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase"
                            style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                          >
                            {alert.severity}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-mono text-white/60">{METRIC_LABELS[alert.type]}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-mono text-white/50">{alert.source}</span>
                        </td>
                        <td className="p-2.5 hidden md:table-cell">
                          <span className="text-[10px] font-mono text-white/70 truncate max-w-[300px] block">
                            {alert.message}
                          </span>
                        </td>
                        <td className="p-2.5 hidden lg:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 max-w-[60px]">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${alert.score * 100}%` }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: colors.text }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-white/50">{(alert.score * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[9px] font-mono text-white/40 whitespace-nowrap">
                            {formatRelativeTime(alert.detectedAt)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Alert Detail */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block px-2 py-1 rounded text-[10px] font-mono font-bold uppercase"
                  style={{
                    backgroundColor: SEVERITY_COLORS[selectedAlert.severity].bg,
                    color: SEVERITY_COLORS[selectedAlert.severity].text,
                    border: `1px solid ${SEVERITY_COLORS[selectedAlert.severity].border}`,
                  }}
                >
                  {selectedAlert.severity}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{METRIC_LABELS[selectedAlert.type]}</h3>
                  <p className="text-[10px] font-mono text-white/40 mt-0.5">{selectedAlert.source} · {selectedAlert.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
            </div>

            {/* Insight */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-4">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">AI Insight</div>
              <div className="text-xs font-mono text-white/80 leading-relaxed">{selectedAlert.insight}</div>
            </div>

            {/* Metrics */}
            <div className="grid gap-3 md:grid-cols-4 mb-4">
              <MetricDetail
                label="Current Value"
                value={`${selectedAlert.currentValue.toFixed(1)} ${METRIC_UNITS[selectedAlert.type]}`}
                color={SEVERITY_COLORS[selectedAlert.severity].text}
              />
              <MetricDetail
                label="Baseline"
                value={`${selectedAlert.baselineValue.toFixed(1)} ${METRIC_UNITS[selectedAlert.type]}`}
                color="#9ca3af"
              />
              <MetricDetail
                label="Deviation"
                value={`${selectedAlert.deviation.toFixed(1)}σ`}
                color="#86d9ff"
              />
              <MetricDetail
                label="Confidence"
                value={`${(selectedAlert.score * 100).toFixed(0)}%`}
                color="#34d399"
              />
            </div>

            {/* Trend indicator */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono text-white/40 uppercase">Trend:</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                selectedAlert.trend === 'sustained_high' || selectedAlert.trend === 'spike'
                  ? 'text-rose-300 border-rose-300/30 bg-rose-300/10'
                  : selectedAlert.trend === 'sustained_low' || selectedAlert.trend === 'drop'
                    ? 'text-blue-300 border-blue-300/30 bg-blue-300/10'
                    : 'text-amber-300 border-amber-300/30 bg-amber-300/10'
              }`}>
                {selectedAlert.trend.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-white/30">{formatRelativeTime(selectedAlert.detectedAt)}</span>
            </div>

            {/* Sparkline chart from samples */}
            {selectedAlert.samples.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Recent Values</div>
                <div className="h-20 flex items-end gap-[2px]">
                  {selectedAlert.samples.map((sample, i) => {
                    const maxVal = Math.max(...selectedAlert.samples.map((s) => s.value), 1);
                    const height = (sample.value / maxVal) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${Math.max(height, 3)}%`,
                          backgroundColor: sample.value > selectedAlert.baselineValue
                            ? `rgba(239, 68, 68, ${0.2 + (height / 100) * 0.6})`
                            : 'rgba(96, 165, 250, 0.3)',
                        }}
                        title={`${sample.value.toFixed(1)} ${METRIC_UNITS[selectedAlert.type]}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-mono text-white/30">
                  <span>{selectedAlert.samples.length > 0 ? formatTimeShort(selectedAlert.samples[0].timestamp) : ''}</span>
                  <span className="text-white/40">Baseline: {selectedAlert.baselineValue.toFixed(1)} {METRIC_UNITS[selectedAlert.type]}</span>
                  <span>{selectedAlert.samples.length > 0 ? formatTimeShort(selectedAlert.samples[selectedAlert.samples.length - 1].timestamp) : ''}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetricDetail({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs font-semibold truncate" style={{ color }}>{value}</div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatTimeShort(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}