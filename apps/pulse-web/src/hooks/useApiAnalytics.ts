import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

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
  errorRate: number;
  successCount: number;
  successRate: number;
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

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#34d399',
  POST: '#60a5fa',
  PUT: '#fbbf24',
  DELETE: '#ef4444',
  PATCH: '#a78bfa',
};

export function useApiAnalytics() {
  const [isSimulated, setIsSimulated] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['api-analytics-summary'],
    queryFn: () => fetchJson<ApiSummary>('/api/api-analytics/summary'),
    refetchInterval: 10000,
    retry: 2,
  });

  const endpointsQuery = useQuery({
    queryKey: ['api-analytics-endpoints'],
    queryFn: () => fetchJson<EndpointStats[]>('/api/api-analytics/endpoints'),
    refetchInterval: 10000,
    retry: 2,
  });

  const slowestQuery = useQuery({
    queryKey: ['api-analytics-slowest'],
    queryFn: () => fetchJson<EndpointStats[]>('/api/api-analytics/slowest?limit=10'),
    refetchInterval: 15000,
    retry: 2,
  });

  const timeSeriesQuery = useQuery({
    queryKey: ['api-analytics-timeseries'],
    queryFn: () => fetchJson<TimeBucket[]>('/api/api-analytics/timeseries?hours=24&bucketMinutes=10'),
    refetchInterval: 30000,
    retry: 2,
  });

  const trendQuery = useQuery({
    queryKey: ['api-analytics-trend'],
    queryFn: () => fetchJson<{ trend: TrendDirection }>('/api/api-analytics/trend'),
    refetchInterval: 30000,
    retry: 2,
  });

  useEffect(() => {
    if (summaryQuery.isError && !isSimulated) setIsSimulated(true);
    if (summaryQuery.data && isSimulated) setIsSimulated(false);
  }, [summaryQuery.isError, summaryQuery.data, isSimulated]);

  const simulated = generateSimulatedAnalytics();

  const summary: ApiSummary = summaryQuery.data ?? (isSimulated ? simulated.summary : {
    totalEndpoints: 0, totalRequests: 0, totalErrors: 0,
    avgResponseTimeAll: 0, p50ResponseTimeAll: 0, p95ResponseTimeAll: 0, p99ResponseTimeAll: 0,
    overallErrorRate: 0, overallSuccessRate: 100, requestsPerMinute: 0,
    lastUpdated: new Date().toISOString(),
  });

  const endpoints: EndpointStats[] = endpointsQuery.data ?? (isSimulated ? simulated.endpoints : []);
  const slowest: EndpointStats[] = slowestQuery.data ?? (isSimulated ? simulated.slowest : []);
  const timeSeries: TimeBucket[] = timeSeriesQuery.data ?? (isSimulated ? simulated.timeSeries : []);
  const trend: TrendDirection = trendQuery.data?.trend ?? (isSimulated ? 'stable' : 'stable');

  return {
    summary,
    endpoints,
    slowest,
    timeSeries,
    trend,
    isLoading: summaryQuery.isLoading && !isSimulated,
    isError: summaryQuery.isError && !isSimulated,
    isSimulated,
    refetch: () => { summaryQuery.refetch(); endpointsQuery.refetch(); slowestQuery.refetch(); timeSeriesQuery.refetch(); trendQuery.refetch(); },
    METHOD_COLORS,
  };
}

function generateSimulatedAnalytics() {
  const now = Date.now();
  const services = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace'];

  const endpoints: EndpointStats[] = [
    {
      path: '/api/runtime/executions', method: 'GET', service: 'pulse-runtime',
      avgResponseTime: 85, p50ResponseTime: 62, p95ResponseTime: 210, p99ResponseTime: 450,
      maxResponseTime: 890, minResponseTime: 18, requestCount: 2847, errorCount: 12,
      errorRate: 0.42, successCount: 2835, successRate: 99.58, totalBytesSent: 2847000, totalBytesReceived: 14235000,
    },
    {
      path: '/api/runtime/executions', method: 'POST', service: 'pulse-runtime',
      avgResponseTime: 245, p50ResponseTime: 180, p95ResponseTime: 620, p99ResponseTime: 1200,
      maxResponseTime: 2400, minResponseTime: 45, requestCount: 1532, errorCount: 28,
      errorRate: 1.83, successCount: 1504, successRate: 98.17, totalBytesSent: 2298000, totalBytesReceived: 7650000,
    },
    {
      path: '/api/metrics/summary', method: 'GET', service: 'pulse-metrics',
      avgResponseTime: 42, p50ResponseTime: 35, p95ResponseTime: 98, p99ResponseTime: 180,
      maxResponseTime: 350, minResponseTime: 8, requestCount: 5621, errorCount: 3,
      errorRate: 0.05, successCount: 5618, successRate: 99.95, totalBytesSent: 2810500, totalBytesReceived: 28105000,
    },
    {
      path: '/api/graph/:executionId', method: 'GET', service: 'pulse-graph',
      avgResponseTime: 320, p50ResponseTime: 250, p95ResponseTime: 800, p99ResponseTime: 1500,
      maxResponseTime: 3200, minResponseTime: 55, requestCount: 987, errorCount: 45,
      errorRate: 4.56, successCount: 942, successRate: 95.44, totalBytesSent: 1480500, totalBytesReceived: 4935000,
    },
    {
      path: '/api/traces/:executionId', method: 'GET', service: 'pulse-trace',
      avgResponseTime: 180, p50ResponseTime: 120, p95ResponseTime: 480, p99ResponseTime: 920,
      maxResponseTime: 1800, minResponseTime: 25, requestCount: 1456, errorCount: 18,
      errorRate: 1.24, successCount: 1438, successRate: 98.76, totalBytesSent: 1456000, totalBytesReceived: 7280000,
    },
    {
      path: '/api/auth/login', method: 'POST', service: 'pulse-gateway',
      avgResponseTime: 56, p50ResponseTime: 42, p95ResponseTime: 130, p99ResponseTime: 280,
      maxResponseTime: 510, minResponseTime: 12, requestCount: 3891, errorCount: 8,
      errorRate: 0.21, successCount: 3883, successRate: 99.79, totalBytesSent: 1945500, totalBytesReceived: 5836500,
    },
    {
      path: '/api/auth/validate', method: 'GET', service: 'pulse-gateway',
      avgResponseTime: 28, p50ResponseTime: 22, p95ResponseTime: 65, p99ResponseTime: 120,
      maxResponseTime: 280, minResponseTime: 5, requestCount: 12450, errorCount: 15,
      errorRate: 0.12, successCount: 12435, successRate: 99.88, totalBytesSent: 4980000, totalBytesReceived: 12450000,
    },
    {
      path: '/api/replay/:executionId', method: 'POST', service: 'pulse-replay',
      avgResponseTime: 420, p50ResponseTime: 350, p95ResponseTime: 1050, p99ResponseTime: 2000,
      maxResponseTime: 3800, minResponseTime: 80, requestCount: 234, errorCount: 15,
      errorRate: 6.41, successCount: 219, successRate: 93.59, totalBytesSent: 468000, totalBytesReceived: 2340000,
    },
  ];

  const summary: ApiSummary = {
    totalEndpoints: 18,
    totalRequests: endpoints.reduce((s, e) => s + e.requestCount, 0),
    totalErrors: endpoints.reduce((s, e) => s + e.errorCount, 0),
    avgResponseTimeAll: 156,
    p50ResponseTimeAll: 95,
    p95ResponseTimeAll: 420,
    p99ResponseTimeAll: 890,
    overallErrorRate: 1.2,
    overallSuccessRate: 98.8,
    requestsPerMinute: 145,
    lastUpdated: new Date().toISOString(),
  };

  const timeSeries: TimeBucket[] = Array.from({ length: 24 }, (_, i) => ({
    timestamp: now - (24 - i) * 3600000,
    avgResponseTime: 80 + Math.random() * 120 + (i >= 10 && i <= 16 ? 60 : 0),
    requestCount: Math.round(80 + Math.random() * 100 + (i >= 10 && i <= 16 ? 50 : 0)),
    errorCount: Math.round(Math.random() * 3),
  }));

  const slowest = [...endpoints].sort((a, b) => b.avgResponseTime - a.avgResponseTime);

  return { summary, endpoints, slowest, timeSeries };
}