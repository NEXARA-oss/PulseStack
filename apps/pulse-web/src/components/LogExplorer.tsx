import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogs, generateMockLogs, type LogLevel, type LogEntry, type LogResponse } from '../hooks/useLogs';

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; bg: string; border: string }> = {
  error: { label: 'ERROR', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  warn: { label: 'WARN', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  info: { label: 'INFO', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  debug: { label: 'DEBUG', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  trace: { label: 'TRACE', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
};

export function LogExplorer() {
  const [mockData] = useState<LogResponse>(() => generateMockLogs(1, 50));
  const logHook = useLogs();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = logHook.logs.length > 0 ? logHook.logs : mockData.logs;
  const stats = logHook.stats ?? mockData.stats;
  const total = logHook.total || mockData.total;
  const { filters, LOG_LEVELS, LOG_SOURCES } = logHook;
  const totalPages = Math.ceil(total / logHook.pageSize);

  const filteredLogs = useMemo(() => {
    if (!filters.query) return logs;
    const q = filters.query.toLowerCase();
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        l.traceId?.toLowerCase().includes(q) ||
        l.executionId?.toLowerCase().includes(q)
    );
  }, [logs, filters.query]);

  const handleSaveFilter = useCallback(() => {
    if (!saveFilterName.trim()) return;
    logHook.saveCurrentFilter(saveFilterName.trim());
    setSaveFilterName('');
    setShowSaveDialog(false);
  }, [saveFilterName, logHook]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Log Explorer</h2>
          <p className="text-xs text-white/50 font-mono mt-0.5">{total} total log entries</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => logHook.setAutoRefresh(!logHook.autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
              logHook.autoRefresh
                ? 'bg-mint/10 text-mint border-mint/30'
                : 'bg-white/[0.03] text-white/40 border-white/10'
            }`}
          >
            {logHook.autoRefresh ? '⟳ Live' : '⟳ Paused'}
          </button>
          <button onClick={() => logHook.refetch()} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">
            Refresh
          </button>
        </div>
      </div>

      {/* Log Level Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <LevelStatCard label="Error" value={stats.error} color={LEVEL_CONFIG.error.color} pulse />
          <LevelStatCard label="Warn" value={stats.warn} color={LEVEL_CONFIG.warn.color} />
          <LevelStatCard label="Info" value={stats.info} color={LEVEL_CONFIG.info.color} />
          <LevelStatCard label="Debug" value={stats.debug} color={LEVEL_CONFIG.debug.color} />
          <LevelStatCard label="Trace" value={stats.trace} color={LEVEL_CONFIG.trace.color} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[250px]">
            <input
              type="text"
              value={filters.query}
              onChange={(e) => logHook.updateFilter('query', e.target.value)}
              placeholder="Search logs by message, ID, trace, execution..."
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-mono text-white placeholder-white/30 focus:border-cyan/40 focus:outline-none"
            />
            {filters.query && (
              <button onClick={() => logHook.updateFilter('query', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-xs">✕</button>
            )}
          </div>

          {/* Time range */}
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            {(['15m', '1h', '6h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => logHook.updateFilter('timeRange', range)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all ${
                  filters.timeRange === range ? 'bg-cyan/20 text-cyan' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Level + Source filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Level buttons */}
          <div className="flex gap-1">
            {LOG_LEVELS.map((level) => {
              const cfg = LEVEL_CONFIG[level];
              const active = filters.level.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => logHook.toggleLevel(level)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${
                    active ? 'text-white' : 'text-white/40 border-transparent hover:text-white/60'
                  }`}
                  style={active ? { backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color } : {}}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div className="w-px h-5 bg-white/10" />

          {/* Source dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSources(!showSources)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 bg-black/30 text-white/60 hover:text-white"
            >
              {filters.source.length > 0 ? `Sources (${filters.source.length})` : 'All Sources'} ▾
            </button>
            {showSources && (
              <div className="absolute top-full left-0 mt-1 z-20 w-52 rounded-xl border border-white/10 bg-black/90 backdrop-blur-xl p-2 shadow-xl">
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {LOG_SOURCES.map((source) => (
                    <button
                      key={source}
                      onClick={() => logHook.toggleSource(source)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-mono transition-all ${
                        filters.source.includes(source)
                          ? 'bg-cyan/10 text-cyan'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Saved filters */}
          {logHook.savedFilters.length > 0 && (
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-white/40 font-mono">Saved:</span>
              {logHook.savedFilters.map((sf) => (
                <button
                  key={sf.id}
                  onClick={() => logHook.applySavedFilter(sf)}
                  className="px-2 py-1 rounded text-[9px] font-mono border border-white/10 text-white/50 hover:text-white"
                >
                  {sf.name}
                </button>
              ))}
            </div>
          )}

          {/* Save filter / Clear */}
          <div className="flex items-center gap-1 ml-auto">
            {logHook.hasActiveFilters && (
              <>
                <button onClick={() => setShowSaveDialog(true)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-white/50 hover:text-white">
                  💾 Save
                </button>
                <button onClick={logHook.clearFilters} className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-white/40 hover:text-white/70">
                  Clear ✕
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save Filter Dialog */}
      <AnimatePresence>
        {showSaveDialog && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-xl border border-white/10 bg-black/60 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveFilterName}
                onChange={(e) => setSaveFilterName(e.target.value)}
                placeholder="Filter name..."
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:border-cyan/40 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
              />
              <button onClick={handleSaveFilter} disabled={!saveFilterName.trim()} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30 disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <tr className="border-b border-white/10">
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-16">Level</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Timestamp</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Message</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell w-40">Source</th>
                <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden lg:table-cell w-28">Trace ID</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filteredLogs.map((log) => {
                  const cfg = LEVEL_CONFIG[log.level];
                  const isExpanded = expandedLog === log.id;

                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-white/5 transition-colors cursor-pointer ${
                        log.level === 'error' ? 'hover:bg-rose-500/5' : 'hover:bg-white/[0.02]'
                      } ${isExpanded ? 'bg-white/[0.03]' : ''}`}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <td className="p-2.5">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase leading-tight"
                          style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-mono text-white/50 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          {log.level === 'error' && <span className="text-red-400 text-xs flex-shrink-0">⚠</span>}
                          <span className={`text-xs font-mono truncate max-w-[500px] ${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-white/80'}`}>
                            {log.message}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 hidden md:table-cell">
                        <span className="text-[10px] font-mono text-white/50">{log.source}</span>
                      </td>
                      <td className="p-2.5 hidden lg:table-cell">
                        {log.traceId ? (
                          <span className="text-[9px] font-mono text-white/30">{log.traceId.slice(0, 12)}...</span>
                        ) : (
                          <span className="text-[9px] text-white/20">—</span>
                        )}
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
            Showing {filteredLogs.length} of {total}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => logHook.setPage(Math.max(1, logHook.page - 1))}
              disabled={logHook.page <= 1}
              className="px-3 py-1 rounded text-[10px] font-mono text-white/50 border border-white/10 hover:text-white disabled:opacity-30"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-[10px] font-mono text-white/40">
              {logHook.page} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => logHook.setPage(Math.min(totalPages, logHook.page + 1))}
              disabled={logHook.page >= totalPages}
              className="px-3 py-1 rounded text-[10px] font-mono text-white/50 border border-white/10 hover:text-white disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Log Detail */}
      <AnimatePresence>
        {expandedLog && (() => {
          const log = logs.find((l) => l.id === expandedLog);
          if (!log) return null;
          const cfg = LEVEL_CONFIG[log.level];

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold uppercase px-2 py-1 rounded" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{log.message}</h3>
                    <p className="text-[10px] font-mono text-white/40 mt-0.5">{log.id}</p>
                  </div>
                </div>
                <button onClick={() => setExpandedLog(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <DetailField label="Timestamp" value={new Date(log.timestamp).toLocaleString()} color="#9ca3af" />
                <DetailField label="Source" value={log.source} color="#86d9ff" />
                <DetailField label="Service" value={log.service} color="#86d9ff" />
                <DetailField label="Trace ID" value={log.traceId ?? '—'} color={log.traceId ? '#a78bfa' : '#6b7280'} />
                <DetailField label="Span ID" value={log.spanId ?? '—'} color={log.spanId ? '#a78bfa' : '#6b7280'} />
                <DetailField label="Execution ID" value={log.executionId ?? '—'} color={log.executionId ? '#60a5fa' : '#6b7280'} />
              </div>

              {/* Error stack trace */}
              {log.error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 mb-4">
                  <div className="text-[10px] font-mono text-rose-300 uppercase tracking-wider mb-1">Error: {log.error.type}</div>
                  <pre className="text-[10px] font-mono text-rose-200/70 whitespace-pre-wrap leading-relaxed">{log.error.stack}</pre>
                </div>
              )}

              {/* Metadata */}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-2">Metadata</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <div key={key} className="text-[10px] font-mono">
                        <span className="text-white/40">{key}: </span>
                        <span className="text-white/70">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                {log.traceId && (
                  <button
                    onClick={() => logHook.updateFilter('traceId', log.traceId!)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-white/50 hover:text-white"
                  >
                    🔍 Filter by this trace
                  </button>
                )}
                {log.executionId && (
                  <button
                    onClick={() => logHook.updateFilter('executionId', log.executionId!)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-white/50 hover:text-white"
                  >
                    🔍 Filter by this execution
                  </button>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                  }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-white/50 hover:text-white"
                >
                  📋 Copy JSON
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

function LevelStatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 hover:bg-white/[0.05] transition-all">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color }}>
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

function formatTimestamp(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}