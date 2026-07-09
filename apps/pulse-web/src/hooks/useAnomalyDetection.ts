import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type MetricType = 'cpu' | 'memory' | 'network' | 'disk' | 'latency' | 'error_rate' | 'throughput';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyResult = {
  id: string;
  type: MetricType;
  source: string;
  severity: AnomalySeverity;
  score: number;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  trend: 'spike' | 'drop' | 'sustained_high' | 'sustained_low' | 'volatile';
  message: string;
  insight: string;
  detectedAt: number;
  samples: Array<{ timestamp: number; value: number; type: MetricType; source: string }>;
  tags?: Record<string, string>;
};

export type AnomalySummary = {
  totalAnomalies: number;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<MetricType, number>;
  activeAlerts: AnomalyResult[];
  topInsights: string[];
  healthScore: number;
  lastUpdated: number;
};

const SEVERITY_COLORS: Record<AnomalySeverity, { bg: string; text: string; border: string; glow: string }> = {
  critical: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.4)', glow: 'rgba(239,68,68,0.3)' },
  high: { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.4)', glow: 'rgba(249,115,22,0.3)' },
  medium: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.4)', glow: 'rgba(234,179,8,0.3)' },
  low: { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.4)', glow: 'rgba(96,165,250,0.3)' },
};

const METRIC_LABELS: Record<MetricType, string> = {
  cpu: 'CPU Usage',
  memory: 'Memory Usage',
  network: 'Network Traffic',
  disk: 'Disk I/O',
  latency: 'Latency',
  error_rate: 'Error Rate',
  throughput: 'Throughput',
};

const METRIC_UNITS: Record<MetricType, string> = {
  cpu: '%',
  memory: '%',
  network: 'MB/s',
  disk: '%',
  latency: 'ms',
  error_rate: '%',
  throughput: 'req/s',
};

export function useAnomalyDetection() {
  const [isSimulated, setIsSimulated] = useState(false);
  const pollInterval = 10000; // 10 seconds

  const summaryQuery = useQuery({
    queryKey: ['anomaly-summary'],
    queryFn: () => fetchJson<AnomalySummary>('/api/anomaly/summary'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const alertsQuery = useQuery({
    queryKey: ['anomaly-alerts'],
    queryFn: () => fetchJson<AnomalyResult[]>('/api/anomaly/alerts'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const historyQuery = useQuery({
    queryKey: ['anomaly-history'],
    queryFn: () => fetchJson<AnomalyResult[]>('/api/anomaly/history?window=3600000'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  // Fallback to simulated data when API unavailable
  useEffect(() => {
    if (summaryQuery.isError && !isSimulated) {
      setIsSimulated(true);
    }
    if (summaryQuery.data && isSimulated) {
      setIsSimulated(false);
    }
  }, [summaryQuery.isError, summaryQuery.data, isSimulated]);

  // Simulated data as fallback
  const simulatedData = generateSimulatedAnomalyData();

  const summary: AnomalySummary = summaryQuery.data ?? (isSimulated ? simulatedData.summary : {
    totalAnomalies: 0,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    byType: { cpu: 0, memory: 0, network: 0, disk: 0, latency: 0, error_rate: 0, throughput: 0 },
    activeAlerts: [],
    topInsights: ['No data available. Connect anomaly detection service for real-time monitoring.'],
    healthScore: 100,
    lastUpdated: Date.now(),
  });

  const activeAlerts: AnomalyResult[] = alertsQuery.data ?? (isSimulated ? simulatedData.alerts : []);
  const history: AnomalyResult[] = historyQuery.data ?? (isSimulated ? simulatedData.history : []);

  return {
    summary,
    activeAlerts,
    history,
    isLoading: summaryQuery.isLoading && !isSimulated,
    isError: summaryQuery.isError && !isSimulated,
    isSimulated,
    refetch: () => {
      summaryQuery.refetch();
      alertsQuery.refetch();
      historyQuery.refetch();
    },
    SEVERITY_COLORS,
    METRIC_LABELS,
    METRIC_UNITS,
  };
}

/**
 * Generate simulated anomaly data for when the backend API is unavailable.
 */
function generateSimulatedAnomalyData() {
  const now = Date.now();
  const types: MetricType[] = ['cpu', 'memory', 'network', 'disk', 'latency', 'error_rate', 'throughput'];
  const sources = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];

  const alerts: AnomalyResult[] = [
    {
      id: 'anomaly-1',
      type: 'cpu',
      source: 'pulse-runtime',
      severity: 'critical',
      score: 0.92,
      currentValue: 94.5,
      baselineValue: 42.3,
      deviation: 5.2,
      trend: 'sustained_high',
      message: 'CPU sustained high on pulse-runtime: 94.5% vs baseline 42.3% (5.2σ)',
      insight: '🚨 CPU sustained spike: 123.4% above baseline. Possible runaway process or insufficient capacity.',
      detectedAt: now - 120000,
      samples: Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 60000,
        value: 40 + Math.random() * 60,
        type: 'cpu' as MetricType,
        source: 'pulse-runtime',
      })),
    },
    {
      id: 'anomaly-2',
      type: 'memory',
      source: 'pulse-graph',
      severity: 'high',
      score: 0.78,
      currentValue: 88.2,
      baselineValue: 55.1,
      deviation: 3.8,
      trend: 'sustained_high',
      message: 'MEMORY elevated on pulse-graph: 88.2% vs baseline 55.1% (3.8σ)',
      insight: '⚠️ Memory pressure detected: 60.1% above normal. Potential memory leak or increased workload.',
      detectedAt: now - 300000,
      samples: Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 60000,
        value: 50 + Math.random() * 40,
        type: 'memory' as MetricType,
        source: 'pulse-graph',
      })),
    },
    {
      id: 'anomaly-3',
      type: 'latency',
      source: 'pulse-gateway',
      severity: 'high',
      score: 0.71,
      currentValue: 1250,
      baselineValue: 145,
      deviation: 4.1,
      trend: 'spike',
      message: 'LATENCY spike on pulse-gateway: 1250.0ms vs baseline 145.0ms (4.1σ)',
      insight: '⚠️ Latency spike: 762.1% increase. Service degradation or resource contention likely.',
      detectedAt: now - 600000,
      samples: Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 60000,
        value: 100 + Math.random() * 1200,
        type: 'latency' as MetricType,
        source: 'pulse-gateway',
      })),
    },
    {
      id: 'anomaly-4',
      type: 'error_rate',
      source: 'pulse-runtime',
      severity: 'medium',
      score: 0.55,
      currentValue: 7.8,
      baselineValue: 1.2,
      deviation: 2.9,
      trend: 'spike',
      message: 'ERROR_RATE spike on pulse-runtime: 7.8% vs baseline 1.2% (2.9σ)',
      insight: '🔍 Error rate surge: 550.0% above normal. Monitor closely for escalation.',
      detectedAt: now - 900000,
      samples: Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 60000,
        value: 0.5 + Math.random() * 8,
        type: 'error_rate' as MetricType,
        source: 'pulse-runtime',
      })),
    },
    {
      id: 'anomaly-5',
      type: 'network',
      source: 'pulse-gateway',
      severity: 'medium',
      score: 0.48,
      currentValue: 850,
      baselineValue: 320,
      deviation: 2.5,
      trend: 'sustained_high',
      message: 'NETWORK elevated on pulse-gateway: 850.0 vs baseline 320.0 (2.5σ)',
      insight: '🔍 Network throughput surge: 165.6% deviation. Possible DDoS or data pipeline issue.',
      detectedAt: now - 1200000,
      samples: Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 60000,
        value: 200 + Math.random() * 700,
        type: 'network' as MetricType,
        source: 'pulse-gateway',
      })),
    },
  ];

  const summary: AnomalySummary = {
    totalAnomalies: 47,
    bySeverity: { low: 18, medium: 15, high: 10, critical: 4 },
    byType: {
      cpu: 8, memory: 7, network: 9, disk: 5, latency: 10, error_rate: 4, throughput: 4,
    },
    activeAlerts: alerts.filter((a) => a.severity === 'high' || a.severity === 'critical'),
    topInsights: [
      '🚨 4 critical anomalies detected across 2 services. Immediate action recommended.',
      '⚠️ 3 high-severity alerts on pulse-runtime. Resource contention likely.',
      '🔗 Multiple metrics affected (cpu, memory, latency). Possible cascading failure.',
    ],
    healthScore: 67,
    lastUpdated: Date.now(),
  };

  const history: AnomalyResult[] = [
    ...alerts,
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `anomaly-hist-${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      severity: (['low', 'medium'] as AnomalySeverity[])[Math.floor(Math.random() * 2)],
      score: 0.2 + Math.random() * 0.4,
      currentValue: 50 + Math.random() * 50,
      baselineValue: 30 + Math.random() * 30,
      deviation: 1.5 + Math.random() * 2,
      trend: 'spike' as const,
      message: 'Historical anomaly',
      insight: '🔍 Minor anomaly detected. No action required.',
      detectedAt: now - (3600000 * (i + 1)),
      samples: [],
    })),
  ];

  return { summary, alerts, history };
}