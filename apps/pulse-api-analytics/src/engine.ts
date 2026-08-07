/**
 * API Performance Analytics Engine
 *
 * Tracks and analyzes API endpoint performance metrics:
 * response time, error rate, request volume, success rate,
 * and historical trends for optimization insights.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type EndpointRecord = {
  path: string;
  method: HttpMethod;
  service: string;
  responseTime: number;       // ms
  statusCode: number;
  timestamp: number;
  bytesSent?: number;
  bytesReceived?: number;
};

export type EndpointStats = {
  path: string;
  method: HttpMethod;
  service: string;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestCount: number;
  errorCount: number;
  errorRate: number;          // 0-100
  successCount: number;
  successRate: number;        // 0-100
  totalBytesSent: number;
  totalBytesReceived: number;
};

export type ApiSummary = {
  totalEndpoints: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTimeAll: number;
  p50ResponseTimeAll: number;
  p95ResponseTimeAll: number;
  p99ResponseTimeAll: number;
  overallErrorRate: number;
  overallSuccessRate: number;
  requestsPerMinute: number;
  lastUpdated: string;
};

export type TimeBucket = {
  timestamp: number;
  avgResponseTime: number;
  requestCount: number;
  errorCount: number;
};

export type TrendDirection = 'improving' | 'stable' | 'degrading';

const INITIAL_ENDPOINTS = [
  { path: '/api/runtime/executions', method: 'GET' as HttpMethod, service: 'pulse-runtime' },
  { path: '/api/runtime/executions/:id', method: 'GET' as HttpMethod, service: 'pulse-runtime' },
  { path: '/api/runtime/executions', method: 'POST' as HttpMethod, service: 'pulse-runtime' },
  { path: '/api/graph/:executionId', method: 'GET' as HttpMethod, service: 'pulse-graph' },
  { path: '/api/metrics/summary', method: 'GET' as HttpMethod, service: 'pulse-metrics' },
  { path: '/api/traces/:executionId', method: 'GET' as HttpMethod, service: 'pulse-trace' },
  { path: '/api/replay/:executionId', method: 'POST' as HttpMethod, service: 'pulse-replay' },
  { path: '/api/replay/:executionId/snapshots', method: 'GET' as HttpMethod, service: 'pulse-replay' },
  { path: '/api/events', method: 'GET' as HttpMethod, service: 'pulse-events' },
  { path: '/api/logs', method: 'GET' as HttpMethod, service: 'pulse-metrics' },
  { path: '/api/anomaly/summary', method: 'GET' as HttpMethod, service: 'pulse-anomaly' },
  { path: '/api/anomaly/alerts', method: 'GET' as HttpMethod, service: 'pulse-anomaly' },
  { path: '/api/slo/compliance', method: 'GET' as HttpMethod, service: 'pulse-slo' },
  { path: '/api/slo/summary', method: 'GET' as HttpMethod, service: 'pulse-slo' },
  { path: '/api/notify/channels', method: 'GET' as HttpMethod, service: 'pulse-notify' },
  { path: '/ws/events', method: 'GET' as HttpMethod, service: 'pulse-gateway' },
  { path: '/api/auth/login', method: 'POST' as HttpMethod, service: 'pulse-gateway' },
  { path: '/api/auth/validate', method: 'GET' as HttpMethod, service: 'pulse-gateway' },
];

/**
 * ApiAnalyticsEngine - Tracks and analyzes API endpoint performance.
 */
export class ApiAnalyticsEngine {
  private records: EndpointRecord[] = [];
  private readonly maxRecords = 50000;
  private endpoints: Array<{ path: string; method: HttpMethod; service: string }> = [...INITIAL_ENDPOINTS];

  constructor() {
    this.seedInitialData();
  }

  /**
   * Record a new API request.
   */
  recordRequest(record: EndpointRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
  }

  /**
   * Record multiple requests at once.
   */
  recordBatch(records: EndpointRecord[]): void {
    for (const record of records) {
      this.recordRequest(record);
    }
  }

  /**
   * Register an endpoint for tracking.
   */
  registerEndpoint(path: string, method: HttpMethod, service: string): void {
    const exists = this.endpoints.some((e) => e.path === path && e.method === method);
    if (!exists) {
      this.endpoints.push({ path, method, service });
    }
  }

  /**
   * Get registered endpoints.
   */
  getEndpoints(): Array<{ path: string; method: HttpMethod; service: string }> {
    return [...this.endpoints];
  }

  /**
   * Get statistics for all endpoints.
   */
  getAllEndpointStats(): EndpointStats[] {
    return this.endpoints.map((ep) => this.computeStats(ep.path, ep.method));
  }

  /**
   * Get statistics for a specific endpoint.
   */
  getEndpointStats(path: string, method: HttpMethod): EndpointStats | null {
    const endpoint = this.endpoints.find((e) => e.path === path && e.method === method);
    if (!endpoint) return null;
    return this.computeStats(path, method);
  }

  /**
   * Get API summary with aggregate metrics.
   */
  getSummary(): ApiSummary {
    const stats = this.getAllEndpointStats();
    const totalRequests = stats.reduce((s, e) => s + e.requestCount, 0);
    const totalErrors = stats.reduce((s, e) => s + e.errorCount, 0);
    const responseTimes = this.records.map((r) => r.responseTime);
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const lastMinuteRequests = this.records.filter((r) => r.timestamp >= oneMinuteAgo);

    return {
      totalEndpoints: this.endpoints.length,
      totalRequests,
      totalErrors,
      avgResponseTimeAll: responseTimes.length > 0
        ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
        : 0,
      p50ResponseTimeAll: this.percentile(responseTimes, 50),
      p95ResponseTimeAll: this.percentile(responseTimes, 95),
      p99ResponseTimeAll: this.percentile(responseTimes, 99),
      overallErrorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
      overallSuccessRate: totalRequests > 0
        ? Math.round(((totalRequests - totalErrors) / totalRequests) * 10000) / 100
        : 100,
      requestsPerMinute: lastMinuteRequests.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get slowest endpoints sorted by average response time.
   */
  getSlowestEndpoints(limit: number = 10): EndpointStats[] {
    return this.getAllEndpointStats()
      .filter((s) => s.requestCount > 0)
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit);
  }

  /**
   * Get endpoints with highest error rates.
   */
  getWorstErrorEndpoints(limit: number = 10): EndpointStats[] {
    return this.getAllEndpointStats()
      .filter((s) => s.requestCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit);
  }

  /**
   * Get time-series data for response time trends.
   */
  getTimeSeries(hours: number = 24, bucketMinutes: number = 5): TimeBucket[] {
    const cutoff = Date.now() - hours * 3600000;
    const windowed = this.records.filter((r) => r.timestamp >= cutoff);

    const bucketMs = bucketMinutes * 60000;
    const buckets = new Map<number, { times: number[]; errors: number; count: number }>();

    for (const record of windowed) {
      const bucket = Math.floor(record.timestamp / bucketMs) * bucketMs;
      const existing = buckets.get(bucket) ?? { times: [], errors: 0, count: 0 };
      existing.times.push(record.responseTime);
      if (record.statusCode >= 400) existing.errors++;
      existing.count++;
      buckets.set(bucket, existing);
    }

    return Array.from(buckets.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        avgResponseTime: data.times.length > 0
          ? Math.round(data.times.reduce((s, t) => s + t, 0) / data.times.length)
          : 0,
        requestCount: data.count,
        errorCount: data.errors,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get trend direction for overall API health.
   */
  getTrend(): TrendDirection {
    const series = this.getTimeSeries(2, 30); // 2 hours, 30-min buckets
    if (series.length < 4) return 'stable';

    const midpoint = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, midpoint);
    const secondHalf = series.slice(midpoint);

    const firstAvg = firstHalf.reduce((s, b) => s + b.avgResponseTime, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, b) => s + b.avgResponseTime, 0) / secondHalf.length;

    const firstErrors = firstHalf.reduce((s, b) => s + b.errorCount, 0);
    const secondErrors = secondHalf.reduce((s, b) => s + b.errorCount, 0);

    const latencyChange = (secondAvg - firstAvg) / (firstAvg || 1);
    const errorChange = secondErrors - firstErrors;

    if (latencyChange > 0.1 || errorChange > 5) return 'degrading';
    if (latencyChange < -0.1 && errorChange < -2) return 'improving';
    return 'stable';
  }

  /**
   * Get mock data for demonstration.
   */
  getMockEndpointHistory(path: string, method: HttpMethod): number[] {
    const stats = this.getEndpointStats(path, method);
    if (!stats) return [];

    const series = this.getTimeSeries(24, 60);
    return series.map((b) => {
      // Simulate daily pattern
      const hour = new Date(b.timestamp).getHours();
      const peakMultiplier = hour >= 10 && hour <= 16 ? 1.5 : 0.8;
      const baseTime = stats.avgResponseTime * (0.7 + Math.random() * 0.6);
      return Math.round(baseTime * peakMultiplier);
    });
  }

  private computeStats(path: string, method: HttpMethod): EndpointStats {
    const endpointRecords = this.records.filter(
      (r) => r.path === path && r.method === method,
    );

    if (endpointRecords.length === 0) {
      // Generate baseline mock data
      const mockRecords = this.generateMockRecords(path, method, 50);
      this.records.push(...mockRecords);
      return this.computeStatsFromRecords(mockRecords);
    }

    return this.computeStatsFromRecords(endpointRecords);
  }

  private computeStatsFromRecords(records: EndpointRecord[]): EndpointStats {
    const responseTimes = records.map((r) => r.responseTime).sort((a, b) => a - b);
    const errors = records.filter((r) => r.statusCode >= 400);
    const successes = records.filter((r) => r.statusCode < 400);
    const totalBytesSent = records.reduce((s, r) => s + (r.bytesSent ?? 0), 0);
    const totalBytesReceived = records.reduce((s, r) => s + (r.bytesReceived ?? 0), 0);

    return {
      path: records[0].path,
      method: records[0].method,
      service: records[0].service,
      avgResponseTime: Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length),
      p50ResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      maxResponseTime: responseTimes[responseTimes.length - 1] ?? 0,
      minResponseTime: responseTimes[0] ?? 0,
      requestCount: records.length,
      errorCount: errors.length,
      errorRate: records.length > 0 ? Math.round((errors.length / records.length) * 10000) / 100 : 0,
      successCount: successes.length,
      successRate: records.length > 0 ? Math.round((successes.length / records.length) * 10000) / 100 : 100,
      totalBytesSent,
      totalBytesReceived,
    };
  }

  private generateMockRecords(path: string, method: HttpMethod, count: number): EndpointRecord[] {
    const endpoint = this.endpoints.find((e) => e.path === path && e.method === method);
    const service = endpoint?.service ?? 'unknown';
    const now = Date.now();
    const records: EndpointRecord[] = [];

    for (let i = 0; i < count; i++) {
      const isError = Math.random() < 0.05;
      let baseLatency: number;

      // Different endpoints have different latency profiles
      if (path.includes('/graph') || path.includes('/traces')) {
        baseLatency = 80 + Math.random() * 300;
      } else if (path.includes('/replay') || path.includes('/runtime/executions')) {
        baseLatency = 40 + Math.random() * 150;
      } else if (path.includes('/logs') || path.includes('/anomaly') || path.includes('/slo')) {
        baseLatency = 20 + Math.random() * 80;
      } else {
        baseLatency = 10 + Math.random() * 60;
      }

      records.push({
        path,
        method,
        service,
        responseTime: isError ? baseLatency * (1 + Math.random() * 2) : baseLatency,
        statusCode: isError ? (Math.random() > 0.5 ? 500 : 429) : (Math.random() > 0.8 ? 304 : 200),
        timestamp: now - (count - i) * 120000 + Math.random() * 60000, // ~2 min intervals
        bytesSent: Math.round(200 + Math.random() * 1800),
        bytesReceived: Math.round(500 + Math.random() * 4500),
      });
    }

    return records;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * Seed initial data for the dashboard to display.
   */
  private seedInitialData() {
    for (const ep of this.endpoints) {
      this.generateMockRecords(ep.path, ep.method, 80 + Math.floor(Math.random() * 40));
    }
  }
}