import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSloCompliance } from '../hooks/useSloCompliance';

export function SloDashboard() {
  const {
    summary,
    compliance,
    services,
    serviceFilter,
    typeFilter,
    report,
    violations,
    isLoading,
    isError,
    isSimulated,
    setServiceFilter,
    setTypeFilter,
    refetch,
    STATUS_COLORS,
    METRIC_LABELS,
    METRIC_UNITS,
  } = useSloCompliance();

  const [expandedSlo, setExpandedSlo] = useState<string | null>(null);

  const complianceColor = summary.overallCompliance >= 95 ? '#34d399' : summary.overallCompliance >= 80 ? '#fbbf24' : '#ef4444';

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
            <h2 className="text-lg font-bold text-white">SLO/SLA Compliance Dashboard</h2>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
              isSimulated ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' : 'bg-mint/10 text-mint border-mint/30'
            }`}>
              {isSimulated ? '🔬 Demo' : '🟢 Live'}
            </span>
          </div>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {summary.totalTargets} SLO targets · {summary.compliantCount} compliant · {summary.warningCount} warning · {summary.breachedCount} breached
            {isSimulated && ' · Demo data'}
          </p>
        </div>
        <button onClick={refetch} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        {/* Overall Compliance */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center justify-center">
          <div className="relative h-20 w-20 flex items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <motion.circle
                cx="40" cy="40" r="32" fill="none"
                stroke={complianceColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - summary.overallCompliance / 100) }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <span className="font-mono text-2xl font-bold" style={{ color: complianceColor }}>
              {summary.overallCompliance}%
            </span>
          </div>
          <div className="mt-1 text-[10px] font-mono text-white/40 uppercase tracking-wider">Compliance</div>
        </div>

        {/* Uptime */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Avg Uptime</div>
          <div className="mt-1 font-mono text-2xl font-bold text-cyan">{summary.uptimePercentage.toFixed(2)}%</div>
          <div className="text-[9px] font-mono text-white/30 mt-0.5">across all services</div>
        </div>

        {/* Error Budget */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Error Budget</div>
          <div className="mt-1 font-mono text-2xl font-bold" style={{ color: summary.errorBudgetHealth >= 50 ? '#34d399' : '#fbbf24' }}>
            {summary.errorBudgetHealth}%
          </div>
          <div className="text-[9px] font-mono text-white/30 mt-0.5">remaining</div>
        </div>

        {/* Trend */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Compliance Trend</div>
          <div className="mt-1 font-mono text-lg font-bold flex items-center gap-2" style={{
            color: summary.complianceTrend === 'improving' ? '#34d399' : summary.complianceTrend === 'degrading' ? '#ef4444' : '#fbbf24',
          }}>
            {summary.complianceTrend === 'improving' ? '↗ Improving' : summary.complianceTrend === 'degrading' ? '↘ Degrading' : '→ Stable'}
          </div>
          <div className="text-[9px] font-mono text-white/30 mt-0.5">30-day trend</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Service filter */}
        <div className="flex gap-1 flex-wrap">
          {services.map((service) => (
            <button
              key={service}
              onClick={() => setServiceFilter(service)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
                serviceFilter === service
                  ? 'bg-cyan/20 text-cyan border border-cyan/30'
                  : 'text-white/40 border border-transparent hover:text-white/60'
              }`}
            >
              {service === 'all' ? 'All' : service.replace('pulse-', '')}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          {(['all', 'uptime', 'latency_p99', 'latency_p95', 'error_rate', 'success_rate', 'throughput'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
                typeFilter === type
                  ? 'bg-cyan/20 text-cyan border border-cyan/30'
                  : 'text-white/40 border border-transparent hover:text-white/60'
              }`}
            >
              {type === 'all' ? 'All' : METRIC_LABELS[type].replace(' ', '\u00A0')}
            </button>
          ))}
        </div>
      </div>

      {/* SLO Compliance Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <tr className="border-b border-white/10">
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Status</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Type</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Service</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell">Target</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell">Current</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-28">Compliance</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-24 hidden lg:table-cell">Budget</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-16">Trend</th>
              </tr>
            </thead>
            <tbody>
              {compliance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <div className="text-sm text-white/40">No SLO targets match your filters</div>
                    {serviceFilter !== 'all' && (
                      <button onClick={() => setServiceFilter('all')} className="mt-2 text-xs text-cyan hover:text-cyan/80">
                        Clear service filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                compliance.map((slo) => {
                  const colors = STATUS_COLORS[slo.status];
                  const isExpanded = expandedSlo === slo.targetId;

                  return (
                    <motion.tr
                      key={slo.targetId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setExpandedSlo(isExpanded ? null : slo.targetId)}
                      className={`border-b border-white/5 transition-colors cursor-pointer ${
                        slo.status === 'breached' ? 'hover:bg-rose-500/5' : slo.status === 'warning' ? 'hover:bg-amber-500/5' : 'hover:bg-white/[0.02]'
                      } ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                    >
                      <td className="p-2.5">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase"
                          style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                          {slo.status}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-mono text-white/70">{METRIC_LABELS[slo.type]}</span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-mono text-white/50">{slo.service}</span>
                      </td>
                      <td className="p-2.5 hidden md:table-cell">
                        <span className="text-[10px] font-mono text-white/50">
                          {slo.operator === 'gte' ? '≥' : '≤'} {slo.target}{METRIC_UNITS[slo.type]}
                        </span>
                      </td>
                      <td className="p-2.5 hidden md:table-cell">
                        <span className="text-[10px] font-mono" style={{ color: slo.status === 'breached' ? '#ef4444' : slo.status === 'warning' ? '#fbbf24' : '#34d399' }}>
                          {slo.currentValue}{METRIC_UNITS[slo.type]}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 max-w-[60px]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${slo.compliance}%` }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: colors.text }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-white/50">{slo.compliance}%</span>
                        </div>
                      </td>
                      <td className="p-2.5 hidden lg:table-cell">
                        <span className={`text-[9px] font-mono ${
                          slo.errorBudget.remainingPercentage >= 50 ? 'text-mint' : slo.errorBudget.remainingPercentage >= 20 ? 'text-amber-300' : 'text-rose-300'
                        }`}>
                          {slo.errorBudget.remainingPercentage}%
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] ${
                          slo.trend === 'improving' ? 'text-mint' : slo.trend === 'degrading' ? 'text-rose-300' : 'text-white/40'
                        }`}>
                          {slo.trend === 'improving' ? '↗' : slo.trend === 'degrading' ? '↘' : '→'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expanded SLO Detail */}
      {expandedSlo && (() => {
        const slo = compliance.find((c) => c.targetId === expandedSlo);
        if (!slo) return null;
        const colors = STATUS_COLORS[slo.status];

        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="inline-block px-2 py-1 rounded text-[10px] font-mono font-bold uppercase"
                  style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                  {slo.status}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{METRIC_LABELS[slo.type]}</h3>
                  <p className="text-[10px] font-mono text-white/40 mt-0.5">{slo.service} · {slo.description}</p>
                </div>
              </div>
              <button onClick={() => setExpandedSlo(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
            </div>

            <div className="grid gap-3 md:grid-cols-4 mb-4">
              <SloDetailField label="Target" value={`${slo.operator === 'gte' ? '≥' : '≤'} ${slo.target}${METRIC_UNITS[slo.type]}`} color="#9ca3af" />
              <SloDetailField label="Current Value" value={`${slo.currentValue}${METRIC_UNITS[slo.type]}`} color={colors.text} />
              <SloDetailField label="Compliance" value={`${slo.compliance}%`} color={colors.text} />
              <SloDetailField label="Period" value={slo.period} color="#86d9ff" />
            </div>

            {/* Error Budget */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-4">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Error Budget</div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <div className="text-[9px] font-mono text-white/30 uppercase">Total</div>
                  <div className="text-xs font-mono text-white/60 mt-0.5">{slo.errorBudget.total}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-white/30 uppercase">Consumed</div>
                  <div className="text-xs font-mono text-rose-300 mt-0.5">{slo.errorBudget.consumed}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-white/30 uppercase">Remaining</div>
                  <div className="text-xs font-mono text-mint mt-0.5">{slo.errorBudget.remaining}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-white/30 uppercase">Remaining %</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: slo.errorBudget.remainingPercentage >= 50 ? '#34d399' : slo.errorBudget.remainingPercentage >= 20 ? '#fbbf24' : '#ef4444' }}>
                    {slo.errorBudget.remainingPercentage}%
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Monthly Report */}
      {report && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">
            📊 Monthly Compliance Report · {report.month} {report.year}
          </div>
          <div className="grid gap-3 md:grid-cols-4 mb-3">
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <div className="text-[9px] font-mono text-white/40 uppercase">Total SLOs</div>
              <div className="font-mono text-lg font-bold text-white">{report.totalSLOs}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <div className="text-[9px] font-mono text-white/40 uppercase">Compliant</div>
              <div className="font-mono text-lg font-bold text-mint">{report.compliant}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <div className="text-[9px] font-mono text-white/40 uppercase">Warning</div>
              <div className="font-mono text-lg font-bold text-amber-300">{report.warning}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
              <div className="text-[9px] font-mono text-white/40 uppercase">Breached</div>
              <div className="font-mono text-lg font-bold text-rose-300">{report.breached}</div>
            </div>
          </div>

          {/* Service breakdown */}
          <div className="space-y-1.5">
            {report.byService.map((svc: { service: string; compliance: number; sloCount: number }) => (
              <div key={svc.service} className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-white/50 w-24 truncate">{svc.service.replace('pulse-', '')}</span>
                <div className="flex-1 h-2 rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${svc.compliance}%` }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: svc.compliance >= 95 ? '#34d399' : svc.compliance >= 80 ? '#fbbf24' : '#ef4444' }}
                  />
                </div>
                <span className="text-[9px] font-mono text-white/50 w-10 text-right">{svc.compliance}%</span>
                <span className="text-[9px] font-mono text-white/30 w-8 text-right">{svc.sloCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violation History */}
      {violations.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">🚩 SLO Violation History (30 days)</div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {violations.map((v: { severity: string; message: string; date: string; service: string }, i: number) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                  v.severity === 'critical' ? 'text-rose-300 bg-rose-300/10' : v.severity === 'high' ? 'text-orange-300 bg-orange-300/10' : 'text-amber-300 bg-amber-300/10'
                }`}>
                  {v.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-white/70 truncate">{v.message}</div>
                  <div className="text-[8px] font-mono text-white/30">{formatDate(v.date)} · {v.service}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SloDetailField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs font-semibold truncate" style={{ color }}>{value}</div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}