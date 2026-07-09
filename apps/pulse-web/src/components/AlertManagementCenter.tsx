import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import {
  useAlerts,
  generateMockAlerts,
  type Alert,
  type AlertSeverity,
  type AlertStatus,
  type AlertCategory,
  type AlertResponse,
} from '../hooks/useAlerts';

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; color: string; bg: string; border: string; icon: string }> = {
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', icon: '🔴' },
  high: { label: 'High', color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.3)', icon: '🟠' },
  medium: { label: 'Medium', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', icon: '🟡' },
  low: { label: 'Low', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)', icon: '🔵' },
  info: { label: 'Info', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.3)', icon: '⚪' },
};

const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#f87171' },
  acknowledged: { label: 'Acknowledged', color: '#fbbf24' },
  resolved: { label: 'Resolved', color: '#4ade80' },
  suppressed: { label: 'Suppressed', color: '#9ca3af' },
};

const CATEGORY_CONFIG: Record<AlertCategory, { label: string; color: string }> = {
  performance: { label: 'Performance', color: '#a78bfa' },
  error: { label: 'Error', color: '#f87171' },
  availability: { label: 'Availability', color: '#60a5fa' },
  resource: { label: 'Resource', color: '#fbbf24' },
  security: { label: 'Security', color: '#f472b6' },
  cost: { label: 'Cost', color: '#34d399' },
};

export function AlertManagementCenter() {
  const [mockData] = useState<AlertResponse>(() => generateMockAlerts(1, 20));
  const alertsHook = useAlerts();
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const alerts = alertsHook.alerts.length > 0 ? alertsHook.alerts : mockData.alerts;
  const stats = alertsHook.stats ?? mockData.stats;
  const total = alertsHook.total || mockData.total;
  const { filters, page, pageSize } = alertsHook;

  const toggleSelect = (id: string) => {
    setSelectedAlerts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedAlerts.size === alerts.length) setSelectedAlerts(new Set());
    else setSelectedAlerts(new Set(alerts.map((a) => a.id)));
  };

  const totalPages = Math.ceil(total / pageSize);
  const dateRangeOptions = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: 'all', label: 'All' },
  ] as const;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Alert Management Center</h2>
          <p className="text-xs text-white/50 font-mono mt-0.5">{total} total alerts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedAlerts.size > 0 && (
            <>
              <span className="text-xs text-white/50 font-mono">{selectedAlerts.size} selected</span>
              <button
                onClick={() => { alertsHook.acknowledgeAll(Array.from(selectedAlerts)); setSelectedAlerts(new Set()); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              >
                Acknowledge All
              </button>
            </>
          )}
          <button onClick={() => alertsHook.refetch()} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">Refresh</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard label="Open" value={stats.open} color="#f87171" />
        <StatCard label="Acknowledged" value={stats.acknowledged} color="#fbbf24" />
        <StatCard label="Resolved" value={stats.resolved} color="#4ade80" />
        <StatCard label="Critical" value={stats.critical} color="#f87171" pulse />
        <StatCard label="High" value={stats.high} color="#fb923c" />
        <StatCard label="Medium" value={stats.medium} color="#fbbf24" />
        <StatCard label="Low" value={stats.low} color="#60a5fa" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Filters */}
          <div className="flex gap-1">
            {(Object.entries(SEVERITY_CONFIG) as [AlertSeverity, typeof SEVERITY_CONFIG[AlertSeverity]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => alertsHook.toggleFilter('severity', key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all ${
                  filters.severity.includes(key)
                    ? 'bg-opacity-30 text-white border-white/20'
                    : 'text-white/40 border-transparent hover:text-white/60'
                }`}
                style={filters.severity.includes(key) ? { backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color } : {}}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-white/10" />
          {/* Status Filters */}
          {(Object.entries(STATUS_CONFIG) as [AlertStatus, typeof STATUS_CONFIG[AlertStatus]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => alertsHook.toggleFilter('status', key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition-all ${
                filters.status.includes(key)
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-white/40 border-transparent hover:text-white/60'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range */}
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            {dateRangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => alertsHook.updateFilter('dateRange', opt.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono uppercase transition-all ${
                  filters.dateRange === opt.value ? 'bg-cyan/20 text-cyan' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => alertsHook.updateFilter('searchQuery', e.target.value)}
            placeholder="Search alerts..."
            className="flex-1 min-w-[200px] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:border-cyan/40 focus:outline-none"
          />
          {/* Clear filters */}
          {alertsHook.hasActiveFilters && (
            <button onClick={alertsHook.clearFilters} className="text-xs text-white/40 hover:text-white/70 font-mono">
              Clear filters ✕
            </button>
          )}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <tr className="border-b border-white/10">
                <th className="p-3 w-8">
                  <input type="checkbox" onChange={selectAll} checked={selectedAlerts.size === alerts.length && alerts.length > 0} className="rounded border-white/20" />
                </th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider">Severity</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider">Alert</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell">Source</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden lg:table-cell">Category</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider">Status</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden sm:table-cell">Time</th>
                <th className="p-3 text-[10px] font-mono uppercase text-white/40 tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {alerts.map((alert) => {
                  const sevCfg = SEVERITY_CONFIG[alert.severity];
                  const statCfg = STATUS_CONFIG[alert.status];
                  const catCfg = CATEGORY_CONFIG[alert.category];
                  const isExpanded = expandedAlert === alert.id;

                  return (
                    <motion.tr
                      key={alert.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer ${selectedAlerts.has(alert.id) ? 'bg-cyan/5' : ''}`}
                      onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedAlerts.has(alert.id)} onChange={() => toggleSelect(alert.id)} className="rounded border-white/20" />
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-mono font-bold" style={{ color: sevCfg.color }}>{sevCfg.icon}</span>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-white font-medium">{alert.title}</div>
                        <div className="text-[10px] text-white/40 font-mono mt-0.5">{alert.id}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-xs text-white/60 font-mono">{alert.serviceName ?? alert.source}</span>
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: `${catCfg.color}20`, color: catCfg.color }}>
                          {catCfg.label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: `${statCfg.color}20`, color: statCfg.color }}>
                          {statCfg.label}
                        </span>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className="text-[10px] font-mono text-white/40">{timeAgo(alert.createdAt)}</span>
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {alert.status === 'open' && (
                            <button
                              onClick={() => alertsHook.acknowledge(alert.id)}
                              className="px-2 py-1 rounded text-[9px] font-mono uppercase border border-amber-400/30 text-amber-300 hover:bg-amber-500/10"
                            >
                              Ack
                            </button>
                          )}
                          {(alert.status === 'open' || alert.status === 'acknowledged') && (
                            <button
                              onClick={() => alertsHook.resolve(alert.id)}
                              className="px-2 py-1 rounded text-[9px] font-mono uppercase border border-mint/30 text-mint hover:bg-mint/10"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-white/10 p-3">
          <div className="text-[10px] font-mono text-white/40">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => alertsHook.setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded text-[10px] font-mono text-white/50 border border-white/10 hover:text-white disabled:opacity-30"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => alertsHook.setPage(p)}
                  className={`px-3 py-1 rounded text-[10px] font-mono border ${p === page ? 'bg-cyan/20 text-cyan border-cyan/30' : 'text-white/50 border-white/10 hover:text-white'}`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => alertsHook.setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded text-[10px] font-mono text-white/50 border border-white/10 hover:text-white disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Alert Details */}
      <AnimatePresence>
        {expandedAlert && (() => {
          const alert = alerts.find((a) => a.id === expandedAlert);
          if (!alert) return null;
          const sevCfg = SEVERITY_CONFIG[alert.severity];
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{sevCfg.icon}</span>
                  <div>
                    <h3 className="text-base font-bold text-white">{alert.title}</h3>
                    <p className="text-xs text-white/60 mt-0.5">{alert.id}</p>
                  </div>
                </div>
                <button onClick={() => setExpandedAlert(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <DetailField label="Severity" value={sevCfg.label} color={sevCfg.color} />
                <DetailField label="Status" value={STATUS_CONFIG[alert.status].label} color={STATUS_CONFIG[alert.status].color} />
                <DetailField label="Category" value={CATEGORY_CONFIG[alert.category].label} color={CATEGORY_CONFIG[alert.category].color} />
                <DetailField label="Source" value={alert.serviceName ?? alert.source} color="#86d9ff" />
                <DetailField label="Created" value={new Date(alert.createdAt).toLocaleString()} color="#9ca3af" />
                <DetailField label="Metric" value={alert.metric ?? 'N/A'} color="#9ca3af" />
                <DetailField label="Threshold" value={alert.threshold ?? 'N/A'} color="#9ca3af" />
                <DetailField label="Current Value" value={alert.currentValue ?? 'N/A'} color={alert.status === 'open' ? '#f87171' : '#4ade80'} />
                {alert.acknowledgedBy && <DetailField label="Acknowledged By" value={alert.acknowledgedBy} color="#fbbf24" />}
                {alert.resolvedBy && <DetailField label="Resolved By" value={alert.resolvedBy} color="#4ade80" />}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-4">
                <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">Message</div>
                <p className="text-sm text-white/80">{alert.message}</p>
              </div>
              {alert.eventCount && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-1">Event Count</div>
                  <span className="font-mono text-lg text-white font-bold">{alert.eventCount}</span>
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.05] transition-all">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-lg font-bold flex items-center gap-1.5" style={{ color }}>
        {pulse && <span className="h-2 w-2 rounded-full bg-current animate-pulse" />}
        {value}
      </div>
    </div>
  );
}

function DetailField({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-semibold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}