import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'suppressed';
export type AlertCategory = 'performance' | 'error' | 'availability' | 'resource' | 'security' | 'cost';

export type Alert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  source: string;
  serviceId?: string;
  serviceName?: string;
  metric?: string;
  threshold?: string;
  currentValue?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  groupId?: string;
  groupName?: string;
  eventCount?: number;
  tags: Record<string, string>;
};

export type AlertFilter = {
  severity: AlertSeverity[];
  status: AlertStatus[];
  category: AlertCategory[];
  searchQuery: string;
  source: string;
  dateRange: '24h' | '7d' | '30d' | 'all';
};

export type AlertStats = {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  byService: Array<{ name: string; count: number; severity: AlertSeverity }>;
  byCategory: Array<{ category: AlertCategory; count: number }>;
};

export type AlertResponse = {
  alerts: Alert[];
  stats: AlertStats;
  total: number;
  page: number;
  pageSize: number;
};

export function useAlerts(initialFilters?: Partial<AlertFilter>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<AlertFilter>({
    severity: [],
    status: [],
    category: [],
    searchQuery: '',
    source: '',
    dateRange: '7d',
    ...initialFilters,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    params.set('dateRange', filters.dateRange);
    if (filters.severity.length) params.set('severity', filters.severity.join(','));
    if (filters.status.length) params.set('status', filters.status.join(','));
    if (filters.category.length) params.set('category', filters.category.join(','));
    if (filters.searchQuery) params.set('search', filters.searchQuery);
    if (filters.source) params.set('source', filters.source);
    return params.toString();
  }, [page, pageSize, filters]);

  const query = useQuery({
    queryKey: ['alerts', queryParams],
    queryFn: () => fetchJson<AlertResponse>(`/api/alerts?${queryParams}`),
    refetchInterval: 10000,
    retry: 2,
    retryDelay: 1000,
    staleTime: 5000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => postJson(`/api/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => postJson(`/api/alerts/${alertId}/resolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: (alertIds: string[]) => postJson('/api/alerts/acknowledge-batch', { alertIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const updateFilter = useCallback(<K extends keyof AlertFilter>(key: K, value: AlertFilter[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const toggleFilter = useCallback(<K extends 'severity' | 'status' | 'category'>(key: K, value: string) => {
    setFilters((prev) => {
      const arr = prev[key] as string[];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [key]: next };
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ severity: [], status: [], category: [], searchQuery: '', source: '', dateRange: '7d' });
    setPage(1);
  }, []);

  const hasActiveFilters = filters.severity.length > 0 || filters.status.length > 0 ||
    filters.category.length > 0 || filters.searchQuery !== '' || filters.source !== '';

  return {
    data: query.data,
    alerts: query.data?.alerts ?? [],
    stats: query.data?.stats ?? null,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    page,
    pageSize,
    filters,
    setPage,
    updateFilter,
    toggleFilter,
    clearFilters,
    hasActiveFilters,
    acknowledge: (alertId: string) => acknowledgeMutation.mutate(alertId),
    resolve: (alertId: string) => resolveMutation.mutate(alertId),
    acknowledgeAll: (alertIds: string[]) => acknowledgeAllMutation.mutate(alertIds),
    isAcknowledging: acknowledgeMutation.isPending,
    isResolving: resolveMutation.isPending,
    refetch: () => void query.refetch(),
  };
}

// Mock data generator
export function generateMockAlerts(page: number, pageSize: number): AlertResponse {
  const severities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const statuses: AlertStatus[] = ['open', 'acknowledged', 'resolved', 'suppressed'];
  const categories: AlertCategory[] = ['performance', 'error', 'availability', 'resource', 'security', 'cost'];
  const sources = ['execution-service', 'workflow-service', 'api-gateway', 'auth-service', 'redis-cache', 'user-db', 'execution-db', 'queue-service', 'notification-service', 'analytics-service'];
  
  const templateAlerts = [
    { title: 'High error rate detected', message: 'Error rate exceeded threshold of 5% for the last 5 minutes' },
    { title: 'Service latency spike', message: 'P95 latency increased by 300% over the baseline' },
    { title: 'Memory usage critical', message: 'Memory utilization crossed 90% threshold' },
    { title: 'CPU saturation', message: 'CPU usage sustained above 85% for 10 minutes' },
    { title: 'Database connection pool exhausted', message: 'All connections in pool are in use, queuing requests' },
    { title: 'Cache hit rate dropped', message: 'Cache hit rate fell below 80% threshold' },
    { title: 'Authentication failures spike', message: 'Multiple authentication failures detected from unknown IPs' },
    { title: 'Queue backlog growing', message: 'Message queue backlog exceeded 10,000 messages' },
    { title: 'Disk space low', message: 'Available disk space is below 10% on /data partition' },
    { title: 'SSL certificate expiring', message: 'SSL certificate for api-gateway expires in 7 days' },
    { title: 'Deployment failed', message: 'Latest deployment to execution-service failed during health check' },
    { title: 'Cost anomaly detected', message: 'Daily compute costs increased by 45% compared to 7-day average' },
    { title: 'Dependency unavailable', message: 'External payment provider is returning 503 errors' },
    { title: 'Throughput degradation', message: 'Requests per second dropped by 60% on workflow-service' },
    { title: 'Replica count mismatch', message: 'Expected 3 replicas, found only 2 running for auth-service' },
  ];

  const alerts: Alert[] = [];
  const startDate = Date.now() - 7 * 86400000;

  for (let i = 0; i < pageSize; i++) {
    const idx = (page * pageSize + i) % templateAlerts.length;
    const template = templateAlerts[idx];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const createdAt = new Date(startDate + Math.random() * 7 * 86400000).toISOString();
    
    const alert: Alert = {
      id: `alert-${page}-${i}-${Date.now()}`,
      title: template.title,
      message: template.message,
      severity,
      status,
      category,
      source,
      serviceName: source,
      createdAt,
      updatedAt: createdAt,
      tags: { environment: Math.random() > 0.5 ? 'production' : 'staging', region: 'us-east-1' },
      eventCount: Math.floor(Math.random() * 50),
      metric: category === 'performance' ? 'latency' : category === 'error' ? 'error_rate' : category === 'resource' ? 'cpu_usage' : undefined,
      threshold: severity === 'critical' ? '95%' : severity === 'high' ? '90%' : '80%',
      currentValue: `${(Math.random() * 100).toFixed(1)}%`,
    };

    if (status === 'acknowledged') {
      alert.acknowledgedBy = 'admin@example.com';
      alert.acknowledgedAt = new Date(new Date(createdAt).getTime() + 300000).toISOString();
    }
    if (status === 'resolved') {
      alert.resolvedBy = 'devops@example.com';
      alert.resolvedAt = new Date(new Date(createdAt).getTime() + 600000).toISOString();
    }

    alerts.push(alert);
  }

  const total = 245;
  const byService: Array<{ name: string; count: number; severity: AlertSeverity }> = sources.map((s) => ({
    name: s,
    count: Math.floor(Math.random() * 20) + 1,
    severity: severities[Math.floor(Math.random() * severities.length)],
  }));

  return {
    alerts,
    stats: {
      total,
      open: Math.floor(total * 0.35),
      acknowledged: Math.floor(total * 0.25),
      resolved: Math.floor(total * 0.30),
      critical: Math.floor(total * 0.10),
      high: Math.floor(total * 0.20),
      medium: Math.floor(total * 0.35),
      low: Math.floor(total * 0.25),
      byService,
      byCategory: categories.map((c) => ({ category: c, count: Math.floor(Math.random() * 30) + 5 })),
    },
    total,
    page,
    pageSize,
  };
}