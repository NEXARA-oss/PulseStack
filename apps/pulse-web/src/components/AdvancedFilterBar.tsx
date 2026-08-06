import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LogLevel, LogFilter } from '../hooks/useLogs';

type AdvancedFilterBarProps = {
  filters: LogFilter;
  LOG_LEVELS: LogLevel[];
  LOG_SOURCES: string[];
  hasActiveFilters: boolean;
  onUpdateFilter: <K extends keyof LogFilter>(key: K, value: LogFilter[K]) => void;
  onToggleLevel: (level: LogLevel) => void;
  onToggleSource: (source: string) => void;
  onClearFilters: () => void;
  onSaveFilter: () => void;
  savedFilters: Array<{ id: string; name: string; query: string; level: LogLevel[]; source: string[]; timeRange: string }>;
  onApplySavedFilter: (sf: any) => void;
  onDeleteSavedFilter: (id: string) => void;
};

const LEVEL_CONFIG: Record<LogLevel, { label: string; color: string; bg: string; border: string }> = {
  error: { label: 'ERROR', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  warn: { label: 'WARN', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' },
  info: { label: 'INFO', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  debug: { label: 'DEBUG', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' },
  trace: { label: 'TRACE', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)' },
};

export function AdvancedFilterBar({
  filters,
  LOG_LEVELS,
  LOG_SOURCES,
  hasActiveFilters,
  onUpdateFilter,
  onToggleLevel,
  onToggleSource,
  onClearFilters,
  onSaveFilter,
  savedFilters,
  onApplySavedFilter,
  onDeleteSavedFilter,
}: AdvancedFilterBarProps) {
  const [showSources, setShowSources] = useState(false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
  const [showSavedDropdown, setShowSavedDropdown] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [searchMode, setSearchMode] = useState<'text' | 'regex'>('text');
  const sourcesRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const customDateRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sourcesRef.current && !sourcesRef.current.contains(e.target as Node)) setShowSources(false);
      if (savedRef.current && !savedRef.current.contains(e.target as Node)) setShowSavedDropdown(false);
      if (customDateRef.current && !customDateRef.current.contains(e.target as Node)) setShowCustomDate(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSearchMode = useCallback(() => {
    setSearchMode((prev) => (prev === 'text' ? 'regex' : 'text'));
  }, []);

  const queryPlaceholder =
    searchMode === 'text'
      ? 'Search logs... (use "exact", -exclude, OR | syntax)'
      : 'Search with regex pattern...';

  return (
    <div className="space-y-3">
      {/* Search row with enhancements */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[250px]">
          <input
            type="text"
            value={filters.query}
            onChange={(e) => onUpdateFilter('query', e.target.value)}
            placeholder={queryPlaceholder}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-mono text-white placeholder-white/30 focus:border-cyan/40 focus:outline-none"
          />
          {filters.query && (
            <button
              onClick={() => onUpdateFilter('query', '')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-xs"
            >
              ✕
            </button>
          )}
          {/* Search mode toggle */}
          <button
            onClick={toggleSearchMode}
            className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider"
            style={{
              color: searchMode === 'regex' ? '#fbbf24' : '#9ca3af',
              backgroundColor: searchMode === 'regex' ? 'rgba(251,191,36,0.15)' : 'rgba(156,163,175,0.1)',
            }}
            title={searchMode === 'text' ? 'Switch to regex mode' : 'Switch to text mode'}
          >
            .*
          </button>
        </div>

        {/* Syntax help */}
        <div className="relative">
          <button
            onClick={() => setShowSyntaxHelp(!showSyntaxHelp)}
            className="px-2.5 py-2 rounded-lg text-[10px] font-mono border border-white/10 bg-black/30 text-white/40 hover:text-white"
            title="Search syntax help"
          >
            ?
          </button>
          <AnimatePresence>
            {showSyntaxHelp && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 mt-1 z-30 w-72 rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-3 shadow-xl"
              >
                <div className="text-[10px] font-mono text-white/70 font-semibold mb-2">Search Syntax</div>
                <div className="space-y-1.5 text-[10px] font-mono text-white/50">
                  <div><span className="text-cyan">"exact phrase"</span> — exact match</div>
                  <div><span className="text-amber-300">-exclude</span> — exclude term</div>
                  <div><span className="text-mint">term1 OR term2</span> — any match</div>
                  <div><span className="text-purple-300">field:value</span> — field search</div>
                  <div className="pt-1.5 border-t border-white/5 mt-1.5">
                    <span className="text-amber-300">.*regex.*</span> — regex mode
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Time range */}
        <div className="relative" ref={customDateRef}>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            {(['15m', '1h', '6h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  onUpdateFilter('timeRange', range);
                  setShowCustomDate(false);
                }}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all ${
                  filters.timeRange === range ? 'bg-cyan/20 text-cyan' : 'text-white/40 hover:text-white/60'
                }`}
              >
                {range}
              </button>
            ))}
            <button
              onClick={() => {
                onUpdateFilter('timeRange', 'custom');
                setShowCustomDate(true);
              }}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase transition-all ${
                filters.timeRange === 'custom' ? 'bg-purple/20 text-purple-300' : 'text-white/40 hover:text-white/60'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom date range picker */}
          <AnimatePresence>
            {showCustomDate && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 mt-1 z-30 w-64 rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-3 shadow-xl"
              >
                <div className="text-[10px] font-mono text-white/70 font-semibold mb-2">Custom Time Range</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-mono text-white/40 uppercase">Start</label>
                    <input
                      type="datetime-local"
                      value={filters.startDate?.slice(0, 16) ?? ''}
                      onChange={(e) => onUpdateFilter('startDate', new Date(e.target.value).toISOString())}
                      className="w-full mt-0.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-mono text-white focus:border-cyan/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-white/40 uppercase">End</label>
                    <input
                      type="datetime-local"
                      value={filters.endDate?.slice(0, 16) ?? ''}
                      onChange={(e) => onUpdateFilter('endDate', new Date(e.target.value).toISOString())}
                      className="w-full mt-0.5 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-mono text-white focus:border-cyan/40 focus:outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Level + Source + Saved + Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Level buttons */}
        <div className="flex gap-1 flex-wrap">
          {LOG_LEVELS.map((level) => {
            const cfg = LEVEL_CONFIG[level];
            const active = filters.level.includes(level);
            return (
              <button
                key={level}
                onClick={() => onToggleLevel(level)}
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
        <div className="relative" ref={sourcesRef}>
          <button
            onClick={() => setShowSources(!showSources)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 bg-black/30 text-white/60 hover:text-white"
          >
            {filters.source.length > 0 ? `Sources (${filters.source.length})` : 'All Sources'} ▾
          </button>
          <AnimatePresence>
            {showSources && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 mt-1 z-20 w-56 rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-2 shadow-xl"
              >
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  <button
                    onClick={() => {
                      // Toggle all
                      const allSelected = filters.source.length === LOG_SOURCES.length;
                      LOG_SOURCES.forEach((s) => {
                        if (allSelected && filters.source.includes(s)) onToggleSource(s);
                        else if (!allSelected && !filters.source.includes(s)) onToggleSource(s);
                      });
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-mono text-white/30 hover:text-white/60 border-b border-white/5 mb-1"
                  >
                    {filters.source.length === LOG_SOURCES.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {LOG_SOURCES.map((source) => (
                    <button
                      key={source}
                      onClick={() => onToggleSource(source)}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Saved filters dropdown */}
        <div className="relative" ref={savedRef}>
          <button
            onClick={() => setShowSavedDropdown(!showSavedDropdown)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 bg-black/30 text-white/60 hover:text-white"
          >
            📑 Saved ({savedFilters.length})
          </button>
          <AnimatePresence>
            {showSavedDropdown && savedFilters.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 mt-1 z-20 w-56 rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl p-2 shadow-xl"
              >
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {savedFilters.map((sf) => (
                    <div key={sf.id} className="flex items-center gap-1 group">
                      <button
                        onClick={() => {
                          onApplySavedFilter(sf);
                          setShowSavedDropdown(false);
                        }}
                        className="flex-1 text-left px-3 py-1.5 rounded-lg text-[10px] font-mono text-white/50 hover:text-white hover:bg-white/5"
                      >
                        {sf.name}
                      </button>
                      <button
                        onClick={() => onDeleteSavedFilter(sf.id)}
                        className="opacity-0 group-hover:opacity-100 px-1.5 py-1 text-[9px] text-rose-400 hover:text-rose-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5">
            <span className="w-px h-4 bg-white/10" />
            {filters.query && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-cyan/10 text-cyan border border-cyan/20">
                search: {filters.query.length > 20 ? filters.query.slice(0, 20) + '…' : filters.query}
                <button onClick={() => onUpdateFilter('query', '')} className="hover:text-white">✕</button>
              </span>
            )}
            {filters.level.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono"
                style={{
                  backgroundColor: LEVEL_CONFIG[l].bg,
                  color: LEVEL_CONFIG[l].color,
                  border: `1px solid ${LEVEL_CONFIG[l].border}`,
                }}
              >
                {LEVEL_CONFIG[l].label}
                <button onClick={() => onToggleLevel(l)} className="hover:text-white">✕</button>
              </span>
            ))}
            {filters.source.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-purple/10 text-purple-300 border border-purple-300/20"
              >
                {s.split('-')[0]}
                <button onClick={() => onToggleSource(s)} className="hover:text-white">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          {hasActiveFilters && (
            <>
              <button
                onClick={onSaveFilter}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono border border-white/10 text-white/50 hover:text-white"
              >
                💾 Save Filter
              </button>
              <button
                onClick={onClearFilters}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-white/40 hover:text-white/70"
              >
                Clear ✕
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}