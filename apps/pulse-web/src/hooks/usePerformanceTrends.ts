import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type TrendMetric = {
  timestamp: string;
  value: number;
};

export type TrendDataPoint = {
  date: string;
  cpuUsage: number;
  memoryUtilization: number;
  responseTime: number;
  errorRate: number;
  executions: number;
  tokensUsed: number;
  cost: number;
};

export type TrendSummary = {
  cpu: { avg: number; max: number; min: number; trend: 'up' | 'down' | 'stable' };
  memory: { avg: number; max: number; min: number; trend: 'up' | 'down' | 'stable' };
  responseTime: { avg: number; max: number; min: number; trend: 'up' | 'down' | 'stable' };
  errorRate: { avg: number; max: number; min: number; trend: 'up' | 'down' | 'stable' };
};

export type PerformanceTrendsResponse = {
  daily: TrendDataPoint[];
  hourly: TrendDataPoint[];
  weekly: TrendDataPoint[];
  comparison: {
    previousPeriod: TrendDataPoint[];
    currentPeriod: TrendDataPoint[];
  };
  summary: TrendSummary;
};

export type TimeRange = '24h' | '7d' | '30d' | '90d';

export function usePerformanceTrends(timeRange: TimeRange = '7d') {
  return useQuery({
    queryKey: ['performance-trends', timeRange],
    queryFn: () => fetchJson<PerformanceTrendsResponse>(`/api/metrics/trends?range=${timeRange}`),
    refetchInterval: 60000,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useTrendExport(timeRange: TimeRange = '7d') {
  return useQuery({
    queryKey: ['trend-export', timeRange],
    queryFn: () =>
      fetchJson<{ csv: string }>(`/api/metrics/trends/export?range=${timeRange}`),
    enabled: false,
    retry: 1,
    retryDelay: 1000,
  });
}

export function generateMockTrendData(timeRange: TimeRange): PerformanceTrendsResponse {
  const now = Date.now();
  const getPointCount = (range: TimeRange): number => {
    switch (range) {
      case '24h': return 24;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
    }
  };

  const pointCount = getPointCount(timeRange);
  const daily: TrendDataPoint[] = [];
  const hourly: TrendDataPoint[] = [];
  const weekly: TrendDataPoint[] = [];

  // Generate daily data
  for (let i = pointCount - 1; i >= 0; i--) {
    const date = new Date(now - i * 86400000);
    const dateStr = date.toISOString().split('T')[0];
    daily.push({
      date: dateStr,
      cpuUsage: 35 + Math.random() * 40 + Math.sin(i * 0.3) * 10,
      memoryUtilization: 45 + Math.random() * 30 + Math.sin(i * 0.5) * 8,
      responseTime: 120 + Math.random() * 200 + Math.sin(i * 0.2) * 50,
      errorRate: Math.max(0, 1 + Math.random() * 4 + Math.sin(i * 0.7) * 1.5),
      executions: Math.floor(500 + Math.random() * 1500 + Math.sin(i * 0.4) * 300),
      tokensUsed: Math.floor(10000 + Math.random() * 90000 + Math.sin(i * 0.3) * 20000),
      cost: parseFloat((0.05 + Math.random() * 0.45 + Math.sin(i * 0.3) * 0.1).toFixed(4)),
    });
  }

  // Generate hourly data (last 24h)
  for (let i = 23; i >= 0; i--) {
    const date = new Date(now - i * 3600000);
    hourly.push({
      date: date.toISOString(),
      cpuUsage: 30 + Math.random() * 50 + Math.sin(i * 0.5) * 12,
      memoryUtilization: 40 + Math.random() * 35 + Math.sin(i * 0.7) * 10,
      responseTime: 100 + Math.random() * 250 + Math.sin(i * 0.3) * 60,
      errorRate: Math.max(0, 0.5 + Math.random() * 5 + Math.sin(i * 0.9) * 2),
      executions: Math.floor(50 + Math.random() * 200 + Math.sin(i * 0.6) * 50),
      tokensUsed: Math.floor(1000 + Math.random() * 15000 + Math.sin(i * 0.4) * 3000),
      cost: parseFloat((0.01 + Math.random() * 0.08 + Math.sin(i * 0.4) * 0.02).toFixed(4)),
    });
  }

  // Generate weekly data
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now - i * 604800000);
    weekly.push({
      date: date.toISOString().split('T')[0],
      cpuUsage: 30 + Math.random() * 45 + Math.sin(i * 0.4) * 12,
      memoryUtilization: 40 + Math.random() * 35 + Math.sin(i * 0.6) * 10,
      responseTime: 110 + Math.random() * 220 + Math.sin(i * 0.25) * 55,
      errorRate: Math.max(0, 0.8 + Math.random() * 4.5 + Math.sin(i * 0.8) * 1.8),
      executions: Math.floor(3000 + Math.random() * 10000 + Math.sin(i * 0.5) * 2000),
      tokensUsed: Math.floor(50000 + Math.random() * 500000 + Math.sin(i * 0.35) * 100000),
      cost: parseFloat((0.25 + Math.random() * 2.5 + Math.sin(i * 0.35) * 0.5).toFixed(4)),
    });
  }

  const previousPeriod: TrendDataPoint[] = daily.map((d) => ({
    ...d,
    cpuUsage: d.cpuUsage * (0.8 + Math.random() * 0.4),
    memoryUtilization: d.memoryUtilization * (0.85 + Math.random() * 0.3),
    responseTime: d.responseTime * (0.9 + Math.random() * 0.3),
    errorRate: d.errorRate * (0.7 + Math.random() * 0.6),
    executions: Math.floor(d.executions * (0.85 + Math.random() * 0.3)),
    tokensUsed: Math.floor(d.tokensUsed * (0.8 + Math.random() * 0.4)),
    cost: parseFloat((d.cost * (0.8 + Math.random() * 0.4)).toFixed(4)),
  }));

  const currentPeriod = [...daily];

  const calcSummary = (data: TrendDataPoint[], key: keyof TrendDataPoint): { avg: number; max: number; min: number; trend: 'up' | 'down' | 'stable' } => {
    const values = data.map((d) => d[key] as number);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
    const trend: 'up' | 'down' | 'stable' = diff > 5 ? 'up' : diff < -5 ? 'down' : 'stable';
    return { avg: parseFloat(avg.toFixed(2)), max: parseFloat(max.toFixed(2)), min: parseFloat(min.toFixed(2)), trend };
  };

  return {
    daily,
    hourly,
    weekly,
    comparison: { previousPeriod, currentPeriod },
    summary: {
      cpu: calcSummary(daily, 'cpuUsage'),
      memory: calcSummary(daily, 'memoryUtilization'),
      responseTime: calcSummary(daily, 'responseTime'),
      errorRate: calcSummary(daily, 'errorRate'),
    },
  };
}