import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type LogSource = 'execution-service' | 'workflow-service' | 'api-gateway' | 'auth-service' | 'pulse-metrics' | 'pulse-graph' | 'pulse-runtime' | 'pulse-events' | 'pulse-trace' | 'pulse-replay';

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  service: string;
  traceId?: string;
  spanId?: string;
  executionId?: string;
  workflowId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    type: string;
    stack?: string;
  };
};

export type SavedFilter = {
  id: string;
  name: string;
  query: string;
  level: LogLevel[];
  source: string[];
  timeRange: string;
  createdAt: string;
};

export type LogFilter = {
  query: string;
  level: LogLevel[];
  source: string[];
  timeRange: '15m' | '1h' | '6h' | '24h' | '7d' | 'custom';
  startDate?: string;
  endDate?: string;
  traceId?: string;
  executionId?: string;
};

export type LogResponse = {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  stats: {
    total: number;
    error: number;
    warn: number;
    info: number;
    debug: number;
    trace: number;
    bySource: Array<{ source: string; count: number }>;
  };
};

const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
const LOG_SOURCES: LogSource[] = ['execution-service', 'workflow-service', 'api-gateway', 'auth-service', 'pulse-metrics', 'pulse-graph', 'pulse-runtime', 'pulse-events', 'pulse-trace', 'pulse-replay'];

export function useLogs() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState<LogFilter>({
    query: '',
    level: [],
    source: [],
    timeRange: '1h',
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pulsestack-saved-filters') ?? '[]');
    } catch { return []; }
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    params.set('timeRange', filters.timeRange);
    if (filters.query) params.set('query', filters.query);
    if (filters.level.length) params.set('level', filters.level.join(','));
    if (filters.source.length) params.set('source', filters.source.join(','));
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.traceId) params.set('traceId', filters.traceId);
    if (filters.executionId) params.set('executionId', filters.executionId);
    return params.toString();
  }, [page, pageSize, filters]);

  const query = useQuery({
    queryKey: ['logs', queryParams],
    queryFn: () => fetchJson<LogResponse>(`/api/logs?${queryParams}`),
    refetchInterval: autoRefresh ? 5000 : false,
    retry: 2,
    retryDelay: 1000,
    staleTime: 3000,
  });

  const updateFilter = useCallback(<K extends keyof LogFilter>(key: K, value: LogFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const toggleLevel = useCallback((level: LogLevel) => {
    setFilters((prev) => {
      const next = prev.level.includes(level)
        ? prev.level.filter((l) => l !== level)
        : [...prev.level, level];
      return { ...prev, level: next };
    });
    setPage(1);
  }, []);

  const toggleSource = useCallback((source: string) => {
    setFilters((prev) => {
      const next = prev.source.includes(source)
        ? prev.source.filter((s) => s !== source)
        : [...prev.source, source];
      return { ...prev, source: next };
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ query: '', level: [], source: [], timeRange: '1h' });
    setPage(1);
  }, []);

  const saveCurrentFilter = useCallback((name: string) => {
    const saved: SavedFilter = {
      id: `filter-${Date.now()}`,
      name,
      query: filters.query,
      level: filters.level,
      source: filters.source,
      timeRange: filters.timeRange,
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedFilters, saved];
    setSavedFilters(updated);
    localStorage.setItem('pulsestack-saved-filters', JSON.stringify(updated));
  }, [filters, savedFilters]);

  const deleteSavedFilter = useCallback((id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('pulsestack-saved-filters', JSON.stringify(updated));
  }, [savedFilters]);

  const applySavedFilter = useCallback((saved: SavedFilter) => {
    setFilters({
      query: saved.query,
      level: saved.level,
      source: saved.source,
      timeRange: saved.timeRange as LogFilter['timeRange'],
    });
    setPage(1);
  }, []);

  const hasActiveFilters = filters.query !== '' || filters.level.length > 0 || filters.source.length > 0;

  return {
    logs: query.data?.logs ?? [],
    total: query.data?.total ?? 0,
    stats: query.data?.stats ?? null,
    hasMore: query.data?.hasMore ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    page,
    pageSize,
    filters,
    savedFilters,
    autoRefresh,
    setPage,
    updateFilter,
    toggleLevel,
    toggleSource,
    clearFilters,
    hasActiveFilters,
    saveCurrentFilter,
    deleteSavedFilter,
    applySavedFilter,
    setAutoRefresh,
    refetch: () => void query.refetch(),
    LOG_LEVELS,
    LOG_SOURCES,
  };
}

// Mock data generator
export function generateMockLogs(page: number, pageSize: number, filters?: Partial<LogFilter>): LogResponse {
  const levels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
  const sources = ['execution-service', 'workflow-service', 'api-gateway', 'auth-service', 'pulse-metrics', 'pulse-graph', 'pulse-runtime', 'pulse-events', 'pulse-trace', 'pulse-replay'];
  const errorMessages = [
    'Connection refused to database at host:5432',
    'NullPointerException: Cannot invoke method on null object',
    'Timeout exceeded: 30000ms waiting for response from workflow-service',
    'Failed to parse request body: Unexpected token at position 42',
    'OutOfMemoryError: Java heap space',
    'Rate limit exceeded for API key sk-xxx...',
    'SSL handshake failed: certificate_expired',
    'Disk quota exceeded for tenant partition',
    'Unhandled promise rejection: TypeError: Cannot read properties of undefined',
    'Deadlock detected on table "executions" in database',
  ];
  const warnMessages = [
    'High memory usage detected: 85% of allocated heap',
    'Slow query detected: 5200ms for SELECT * FROM executions',
    'Deprecated API endpoint /v1/execute will be removed in next release',
    'Retry attempt 2/3 for execution exec-xxx',
    'Cache eviction rate increasing: 45% in last 5 minutes',
    'Connection pool nearing capacity: 18/20 connections in use',
    'Response time degradation: P95 latency at 1200ms',
    'Certificate will expire in 14 days: api.pulsestack.io',
  ];
  const infoMessages = [
    'Execution completed successfully: exec-abc123',
    'Workflow deployed: workflow-payment-v2',
    'New service registered: analytics-service at 10.0.1.42:8080',
    'Configuration reloaded from remote source',
    'Health check passed: all 12 services operational',
    'Scaling up replicas from 3 to 5 for execution-service',
    'Cache warmed up: 15000 keys loaded in 2.3s',
    'WebSocket connection established: client-xyz',
    'New tenant onboarded: acme-corp',
    'Scheduled maintenance completed for user-db',
  ];
  const debugMessages = [
    'Request headers: { authorization: "Bearer ***", content-type: "application/json" }',
    'Query parameters: { limit: 50, offset: 0, status: "active" }',
    'Cache lookup: key=workflow:def:abc123, hit=true, ttl=340s',
    'Middleware chain: auth → rate-limit → body-parser → router',
    'SQL: SELECT * FROM executions WHERE tenant_id = $1 AND status = $2',
    'Serializing response: 2.3KB payload in 12ms',
    'Event published: execution.completed on topic: runtime-events',
    'Span context: trace_id=abc123, parent_span_id=def456',
  ];
  const traceMessages = [
    'Entering function: handleExecutionRequest',
    'Exiting function: handleExecutionRequest with result: success',
    'RPC call: workflow-service.getDefinition(exec-abc123)',
    'Awaiting promise: db.query()',
    'Callback registered: onExecutionComplete',
    'Stream opened: /api/events?type=execution',
    'Timer started: execution-timeout=30000ms',
    'Resource acquired: connection #12 from pool',
  ];

  const logs: LogEntry[] = [];
  const now = Date.now();
  const timeRange = filters?.timeRange === '24h' ? 86400000 : filters?.timeRange === '7d' ? 604800000 : 3600000;

  for (let i = 0; i < pageSize; i++) {
    const levelWeights = filters?.level?.length ? filters.level : levels;
    const level = levelWeights[Math.floor(Math.random() * levelWeights.length)];
    const source = filters?.source?.length
      ? filters.source[Math.floor(Math.random() * filters.source.length)]
      : sources[Math.floor(Math.random() * sources.length)];

    let messagePool: string[];
    switch (level) {
      case 'error': messagePool = errorMessages; break;
      case 'warn': messagePool = warnMessages; break;
      case 'info': messagePool = infoMessages; break;
      case 'debug': messagePool = debugMessages; break;
      default: messagePool = traceMessages;
    }
    const message = messagePool[Math.floor(Math.random() * messagePool.length)];
    const timestamp = new Date(now - Math.random() * timeRange).toISOString();

    const log: LogEntry = {
      id: `log-${page}-${i}-${Date.now()}`,
      timestamp,
      level,
      message,
      source,
      service: source,
      traceId: `trace-${Math.random().toString(36).slice(2, 10)}`,
      spanId: `span-${Math.random().toString(36).slice(2, 10)}`,
      executionId: Math.random() > 0.5 ? `exec-${Math.random().toString(36).slice(2, 10)}` : undefined,
      metadata: {
        environment: Math.random() > 0.7 ? 'production' : 'staging',
        region: 'us-east-1',
        host: `pod-${Math.floor(Math.random() * 10)}`,
      },
    };

    if (level === 'error') {
      log.error = {
        type: ['RuntimeError', 'NetworkError', 'ValidationError', 'TimeoutError'][Math.floor(Math.random() * 4)],
        stack: `Error: ${message}\n    at handleRequest (/app/src/handler.ts:42:17)\n    at processTicksAndRejections (internal/process/task_queues.js:95:5)`,
      };
    }

    logs.push(log);
  }

  // Sort by timestamp descending
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const total = 1250;
  const bySource = sources.map((s) => ({ source: s, count: Math.floor(Math.random() * 80) + 5 }));

  return {
    logs,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    stats: {
      total,
      error: Math.floor(total * 0.08),
      warn: Math.floor(total * 0.15),
      info: Math.floor(total * 0.40),
      debug: Math.floor(total * 0.25),
      trace: Math.floor(total * 0.12),
      bySource,
    },
  };
}