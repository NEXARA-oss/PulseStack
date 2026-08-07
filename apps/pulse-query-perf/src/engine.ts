/**
 * Query Performance Analyzer Engine
 *
 * Provides execution statistics and optimization hints for monitoring queries.
 */

export type QueryExecution = {
  id: string;
  queryText: string;
  endpoint: string;
  executionTimeMs: number;
  rowsScanned: number;
  rowsReturned: number;
  resourceUsage: {
    cpuMs: number;
    memoryMb: number;
  };
  executedAt: string;
  isSlow: boolean;
};

export type OptimizationHint = {
  id: string;
  queryId: string;
  hint: string;
  category: 'index' | 'filter' | 'aggregation' | 'join';
  impact: 'low' | 'medium' | 'high';
  description: string;
};

export type SlowQueryAlert = {
  queryId: string;
  thresholdMs: number;
  actualMs: number;
  message: string;
  detectedAt: string;
};

const DEFAULT_QUERIES: QueryExecution[] = Array.from({ length: 25 }, (_, i) => {
  const endpoints = ['/api/metrics/summary', '/api/traces/search', '/api/slo/compliance', '/api/deployments', '/api/runtime/executions'];
  const queries = ['SELECT * FROM metrics', 'SELECT * FROM traces WHERE tenant_id = ?', 'SELECT * FROM slo_targets', 'SELECT * FROM deployments ORDER BY timestamp DESC', 'SELECT * FROM executions LIMIT 100'];
  const duration = 50 + Math.random() * 950 + (i % 5 === 0 ? 400 : 0);
  return {
    id: `qry-${i + 1}`,
    queryText: queries[i % queries.length],
    endpoint: endpoints[i % endpoints.length],
    executionTimeMs: Math.round(duration),
    rowsScanned: Math.round(500 + Math.random() * 5000),
    rowsReturned: Math.round(5 + Math.random() * 100),
    resourceUsage: {
      cpuMs: Math.round(duration * 0.7),
      memoryMb: Math.round(10 + Math.random() * 90),
    },
    executedAt: new Date(Date.now() - (25 - i) * 120000).toISOString(),
    isSlow: duration > 400,
  };
});

const DEFAULT_HINTS: OptimizationHint[] = [
  { id: 'hint-1', queryId: 'qry-3', hint: 'Add index on tenant_id', category: 'index', impact: 'high', description: 'Current query scans entire table. Adding an index on tenant_id could reduce scan time by 80%.' },
  { id: 'hint-2', queryId: 'qry-5', hint: 'Use LIMIT with OFFSET', category: 'filter', impact: 'medium', description: 'Large result sets without pagination cause high memory usage. Consider adding LIMIT and OFFSET.' },
  { id: 'hint-3', queryId: 'qry-1', hint: 'Avoid SELECT *', category: 'aggregation', impact: 'low', description: 'Select only required columns to reduce data transfer and memory usage.' },
];

export class QueryPerformanceEngine {
  private queries: QueryExecution[] = [...DEFAULT_QUERIES];
  private hints: OptimizationHint[] = [...DEFAULT_HINTS];
  private slowThresholdMs = 300;

  getQueries(limit = 20, onlySlow = false): QueryExecution[] {
    let results = [...this.queries].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    if (onlySlow) results = results.filter((q) => q.isSlow);
    return results.slice(0, limit);
  }

  getQuery(id: string): QueryExecution | undefined {
    return this.queries.find((q) => q.id === id);
  }

  getSlowQueries(): QueryExecution[] {
    return this.queries.filter((q) => q.isSlow);
  }

  getHints(queryId?: string): OptimizationHint[] {
    const hints = queryId ? this.hints.filter((h) => h.queryId === queryId) : [...this.hints];
    return hints.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  getStats() {
    const total = this.queries.length;
    const slow = this.queries.filter((q) => q.isSlow).length;
    const avgDuration = this.queries.reduce((s, q) => s + q.executionTimeMs, 0) / (total || 1);
    const avgCpu = this.queries.reduce((s, q) => s + q.resourceUsage.cpuMs, 0) / (total || 1);
    const avgMemory = this.queries.reduce((s, q) => s + q.resourceUsage.memoryMb, 0) / (total || 1);
    const totalRows = this.queries.reduce((s, q) => s + q.rowsScanned, 0);

    return {
      totalQueries: total,
      slowQueryCount: slow,
      avgExecutionTimeMs: Math.round(avgDuration),
      avgCpuMs: Math.round(avgCpu),
      avgMemoryMb: Math.round(avgMemory),
      totalRowsScanned: totalRows,
      slowPercentage: total > 0 ? Math.round((slow / total) * 100) : 0,
    };
  }

  compareQueries(a: string, b: string) {
    const qA = this.getQuery(a);
    const qB = this.getQuery(b);
    if (!qA || !qB) return null;
    return {
      a: { executionTimeMs: qA.executionTimeMs, rowsScanned: qA.rowsScanned, memoryMb: qA.resourceUsage.memoryMb },
      b: { executionTimeMs: qB.executionTimeMs, rowsScanned: qB.rowsScanned, memoryMb: qB.resourceUsage.memoryMb },
      timeDeltaMs: qB.executionTimeMs - qA.executionTimeMs,
      memoryDeltaMb: qB.resourceUsage.memoryMb - qA.resourceUsage.memoryMb,
    };
  }

  getQueryHistory(endpoint?: string): QueryExecution[] {
    let results = [...this.queries].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    if (endpoint) results = results.filter((q) => q.endpoint === endpoint);
    return results;
  }
}
