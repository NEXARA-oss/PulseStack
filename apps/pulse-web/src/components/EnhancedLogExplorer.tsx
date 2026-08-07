import { useState, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogs, generateMockLogs, type LogLevel, type LogEntry, type LogResponse } from '../hooks/useLogs';
import { useSmartSearch, useLogTimeDistribution, type SmartSearchOptions } from '../hooks/useSmartSearch';
import { AdvancedFilterBar } from './AdvancedFilterBar';
import { LogTimeDistribution } from './LogTimeDistribution';

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; bg: string; border: string }> = {
  error: { label: 'ERROR', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  warn: { label: 'WARN', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  info: { label: 'INFO', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  debug: { label: 'DEBUG', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  trace: { label: 'TRACE', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
};

export function EnhancedLogExplorer() {
  const [mockData] = useState<LogResponse>(() => generateMockLogs(1, 50));
  const logHook = useLogs();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchMode] = useState<'text' | 'regex'>('text');
  const [bookmarkedLogs, setBookmarkedLogs] = useState<Set<string>>(new Set());
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    level: true,
    timestamp: true,
    message: true,
    source: true,
    traceId: true,
    executionId: false,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = logHook.logs.length > 0 ? logHook.logs : mockData.logs;
  const stats = logHook.stats ?? mockData.stats;
  const total = logHook.total || mockData.total;
  const { filters, LOG_LEVELS, LOG_SOURCES } = logHook;
  const totalPages = Math.ceil(total / logHook.pageSize);

  // Smart search integration
  const smartSearchOptions: SmartSearchOptions = useMemo(() => ({
    query: filters.query,
    mode: searchMode,
    enabled: filters.query.length > 0,
  }), [filters.query, searchMode]);

  const { filteredLogs: smartFilteredLogs } = useSmartSearch(logs, smartSearchOptions);

  // Apply level + source filters on top of smart search
  const finalLogs = useMemo(() => {
    let result = smartFilteredLogs;

    if (filters.level.length > 0) {
      result = result.filter((log) => filters.level.includes(log.level));
    }
    if (filters.source.length > 0) {
      result = result.filter((log) => filters.source.includes(log.source));
    }
    if (bookmarkedLogs.size > 0 && showBookmarksOnly) {
      result = result.filter((log) => bookmarkedLogs.has(log.id));
    }

    return result;
  }, [smartFilteredLogs, filters.level, filters.source, bookmarkedLogs, showBookmarksOnly]);

  // Time distribution
  const timeBuckets = useLogTimeDistribution(finalLogs, 60000);
  const maxBucketCount = useMemo(() => Math.max(...timeBuckets.map((b) => b.count), 1), [timeBuckets]);

  // Derived stats for current view
  const viewStats = useMemo(() => ({
    error: finalLogs.filter((l) => l.level === 'error').length,
    warn: finalLogs.filter((l) => l.level === 'warn').length,
    info: finalLogs.filter((l) => l.level === 'info').length,
    debug: finalLogs.filter((l) => l.level === 'debug').length,
    trace: finalLogs.filter((l) => l.level === 'trace').length,
  }), [finalLogs]);

  const handleSaveFilter = useCallback(() => {
    if (!saveFilterName.trim()) return;
    logHook.saveCurrentFilter(saveFilterName.trim());
    setSaveFilterName('');
    setShowSaveDialog(false);
  }, [saveFilterName, logHook]);

  const toggleBookmark = useCallback((logId: string) => {
    setBookmarkedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  }, []);

  const exportLogs = useCallback(() => {
    const data = JSON.stringify(finalLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [finalLogs]);

  const bookmarkCount = bookmarkedLogs.size;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Advanced Log Explorer</h2>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {finalLogs.length} of {total} entries
            {bookmarkCount > 0 && ` · ${bookmarkCount} bookmarked`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bookmark filter toggle */}
          {bookmarkCount > 0 && (
            <button
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-semibold border transition-all ${
                showBookmarksOnly
                  ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                  : 'bg-white/[0.03] text-white/40 border-white/10'
              }`}
            >
              🔖 {showBookmarksOnly ? 'Bookmarks' : `Bookmarks (${bookmarkCount})`}
            </button>
          )}

          {/* Export */}
          <button
            onClick={exportLogs}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 bg-white/[0.03] text-white/50 hover:text-white"
          >
            ⬇ Export
          </button>

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
        <>
          {/* Aggregate stats */}
          <div className="grid grid-cols-5 gap-2">
            <LevelStatCard label="Error" value={viewStats.error} color={LEVEL_CONFIG.error.color} pulse={viewStats.error > 0} />
            <LevelStatCard label="Warn" value={viewStats.warn} color={LEVEL_CONFIG.warn.color} />
            <LevelStatCard label="Info" value={viewStats.info} color={LEVEL_CONFIG.info.color} />
            <LevelStatCard label="Debug" value={viewStats.debug} color={LEVEL_CONFIG.debug.color} />
            <LevelStatCard label="Trace" value={viewStats.trace} color={LEVEL_CONFIG.trace.color} />
          </div>

          {/* Time distribution heatmap */}
          <LogTimeDistribution
            buckets={timeBuckets}
            maxCount={maxBucketCount}
          />
        </>
      )}

      {/* Advanced Filter Bar */}
      <AdvancedFilterBar
        filters={filters}
        LOG_LEVELS={LOG_LEVELS}
        LOG_SOURCES={LOG_SOURCES}
        hasActiveFilters={logHook.hasActiveFilters}
        onUpdateFilter={logHook.updateFilter}
        onToggleLevel={logHook.toggleLevel}
        onToggleSource={logHook.toggleSource}
        onClearFilters={logHook.clearFilters}
        onSaveFilter={() => setShowSaveDialog(true)}
        savedFilters={logHook.savedFilters}
        onApplySavedFilter={logHook.applySavedFilter}
        onDeleteSavedFilter={logHook.deleteSavedFilter}
      />

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

      {/* Column visibility toggles */}
      <div className="flex items-center gap-2 text-[9px] font-mono text-white/40">
        <span className="uppercase tracking-wider">Columns:</span>
        {(Object.keys(columnVisibility) as Array<keyof typeof columnVisibility>).map((key) => (
          <button
            key={key}
            onClick={() => setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }))}
            className={`px-2 py-0.5 rounded transition-all ${
              columnVisibility[key] ? 'bg-white/10 text-white/70' : 'text-white/30 hover:text-white/50'
            }`}
          >
            {String(key).replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>

      {/* Log Table */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div ref={scrollRef} className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <tr className="border-b border-white/10">
                <th className="p-2.5 w-8">
                  <span className="text-[10px] text-white/30">🔖</span>
                </th>
                {columnVisibility.level && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider w-16">Level</th>
                )}
                {columnVisibility.timestamp && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Timestamp</th>
                )}
                {columnVisibility.message && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider">Message</th>
                )}
                {columnVisibility.source && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden md:table-cell w-40">Source</th>
                )}
                {columnVisibility.traceId && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden lg:table-cell w-28">Trace ID</th>
                )}
                {columnVisibility.executionId && (
                  <th className="p-2.5 text-[10px] font-mono uppercase text-white/40 tracking-wider hidden xl:table-cell w-28">Execution</th>
                )}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {finalLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="text-sm text-white/40">No logs match your filters</div>
                      <button
                        onClick={logHook.clearFilters}
                        className="mt-2 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-white"
                      >
                        Clear Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  finalLogs.map((log) => {
                    const cfg = LEVEL_CONFIG[log.level];
                    const isExpanded = expandedLog === log.id;
                    const isBookmarked = bookmarkedLogs.has(log.id);

                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout
                        className={`border-b border-white/5 transition-colors cursor-pointer ${
                          log.level === 'error' ? 'hover:bg-rose-500/5' : 'hover:bg-white/[0.02]'
                        } ${isExpanded ? 'bg-white/[0.03]' : ''} ${isBookmarked ? 'bg-amber-400/[0.03]' : ''}`}
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      >
                        <td className="p-2.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(log.id); }}
                            className={`text-xs transition-all ${isBookmarked ? 'text-amber-400' : 'text-white/20 hover:text-white/50'}`}
                            title={isBookmarked ? 'Remove bookmark' : 'Bookmark log'}
                          >
                            {isBookmarked ? '★' : '☆'}
                          </button>
                        </td>
                        {columnVisibility.level && (
                          <td className="p-2.5">
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase leading-tight"
                              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                              {cfg.label}
                            </span>
                          </td>
                        )}
                        {columnVisibility.timestamp && (
                          <td className="p-2.5">
                            <span className="text-[10px] font-mono text-white/50 whitespace-nowrap">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </td>
                        )}
                        {columnVisibility.message && (
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              {log.level === 'error' && <span className="text-red-400 text-xs flex-shrink-0">⚠</span>}
                              <span className={`text-xs font-mono truncate max-w-[500px] ${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-white/80'}`}>
                                {log.message}
                              </span>
                            </div>
                          </td>
                        )}
                        {columnVisibility.source && (
                          <td className="p-2.5 hidden md:table-cell">
                            <span className="text-[10px] font-mono text-white/50">{log.source}</span>
                          </td>
                        )}
                        {columnVisibility.traceId && (
                          <td className="p-2.5 hidden lg:table-cell">
                            {log.traceId ? (
                              <span className="text-[9px] font-mono text-white/30">{log.traceId.slice(0, 12)}...</span>
                            ) : (
                              <span className="text-[9px] text-white/20">—</span>
                            )}
                          </td>
                        )}
                        {columnVisibility.executionId && (
                          <td className="p-2.5 hidden xl:table-cell">
                            {log.executionId ? (
                              <span className="text-[9px] font-mono text-white/30">{log.executionId.slice(0, 12)}...</span>
                            ) : (
                              <span className="text-[9px] text-white/20">—</span>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-white/10 p-3">
          <div className="text-[10px] font-mono text-white/40">
            Showing {finalLogs.length} of {total}
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
                  {isBookmarked(bookmarkedLogs, log.id) && (
                    <span className="text-amber-400 text-xs">★ Bookmarked</span>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white">{highlightErrorText(log.message, searchMode)}</h3>
                    <p className="text-[10px] font-mono text-white/40 mt-0.5">{log.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBookmark(log.id)}
                    className={`text-xs px-2 py-1 rounded border ${bookmarkedLogs.has(log.id) ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' : 'text-white/40 border-white/10 hover:text-white'}`}
                  >
                    {bookmarkedLogs.has(log.id) ? '★ Bookmarked' : '☆ Bookmark'}
                  </button>
                  <button onClick={() => setExpandedLog(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <DetailField label="Timestamp" value={new Date(log.timestamp).toLocaleString()} color="#9ca3af" />
                <DetailField label="Source" value={log.source} color="#86d9ff" />
                <DetailField label="Service" value={log.service} color="#86d9ff" />
                <DetailField label="Trace ID" value={log.traceId ?? '—'} color={log.traceId ? '#a78bfa' : '#6b7280'} />
                <DetailField label="Span ID" value={log.spanId ?? '—'} color={log.spanId ? '#a78bfa' : '#6b7280'} />
                <DetailField label="Execution ID" value={log.executionId ?? '—'} color={log.executionId ? '#60a5fa' : '#6b7280'} />
                <DetailField label="Workflow ID" value={log.workflowId ?? '—'} color={log.workflowId ? '#34d399' : '#6b7280'} />
                <DetailField label="Correlation ID" value={log.correlationId ?? '—'} color={log.correlationId ? '#f472b6' : '#6b7280'} />
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
              <div className="flex gap-2 mt-3 flex-wrap">
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

function isBookmarked(bookmarks: Set<string>, id: string): boolean {
  return bookmarks.has(id);
}

function highlightErrorText(text: string, _mode: 'text' | 'regex'): ReactNode {
  // Detect common error patterns and highlight them
  const errorPatterns = [
    /(error|exception|failed|timeout|denied|rejected)/gi,
    /(\d+ms)/g,
    /("(?:[^"\\]|\\.)*")/g,
  ];

  for (const pattern of errorPatterns) {
    const parts = text.split(pattern);
    if (parts.length > 1) {
      return (
        <>
          {parts.map((part, i) =>
            pattern.test(part) ? (
              <span key={i} className="text-amber-300/80 font-semibold">{part}</span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </>
      );
    }
  }

  return text;
}

function LevelStatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 hover:bg-white/[0.05] transition-all">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5 flex items-center gap-1.5" style={{ color }}>
        {pulse && value > 0 && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
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