import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type MetricName = 'cpu' | 'memory' | 'network' | 'disk' | 'latency' | 'error_rate' | 'throughput';

export type MetricSeries = {
  name: MetricName;
  source: string;
  points: Array<{ timestamp: string; value: number }>;
  color: string;
};

export type CorrelationData = {
  metricA: MetricName;
  metricB: MetricName;
  coefficient: number;
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative' | 'none';
  sampleSize: number;
};

export type ComparisonView = {
  id: string;
  name: string;
  metrics: MetricName[];
  source: string;
};

const METRIC_COLORS: Record<MetricName, string> = {
  cpu: '#60a5fa',
  memory: '#34d399',
  network: '#fbbf24',
  disk: '#f87171',
  latency: '#a78bfa',
  error_rate: '#f472b6',
  throughput: '#22d3ee',
};

export function useMetricCorrelation() {
  const [metricA, setMetricA] = useState<MetricName>('cpu');
  const [metricB, setMetricB] = useState<MetricName>('memory');
  const [sourceFilter, setSourceFilter] = useState('all');

  const pollInterval = 15000;

  const seriesQuery = useQuery({
    queryKey: ['correlation-series', metricA, metricB, sourceFilter],
    queryFn: () => fetchJson<MetricSeries[]>(`/api/correlate/series?metric=${metricA}&source=${sourceFilter}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const matrixQuery = useQuery({
    queryKey: ['correlation-matrix', metricA, sourceFilter],
    queryFn: () => fetchJson<CorrelationData[]>(`/api/correlate/matrix?metric=${metricA}&source=${sourceFilter}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const metricsQuery = useQuery({
    queryKey: ['available-metrics'],
    queryFn: () => fetchJson<MetricName[]>('/api/correlate/metrics'),
    retry: 2,
    retryDelay: 1000,
  });

  const sourcesQuery = useQuery({
    queryKey: ['available-sources'],
    queryFn: () => fetchJson<string[]>('/api/correlate/sources'),
    retry: 2,
    retryDelay: 1000,
  });

  return {
    metricA,
    setMetricA,
    metricB,
    setMetricB,
    sourceFilter,
    setSourceFilter,
    series: seriesQuery.data ?? [],
    matrix: matrixQuery.data ?? [],
    metrics: metricsQuery.data ?? [],
    sources: sourcesQuery.data ?? [],
    isLoading: seriesQuery.isLoading && matrixQuery.isLoading,
    isError: seriesQuery.isError || matrixQuery.isError,
    METRIC_COLORS,
  };
}
