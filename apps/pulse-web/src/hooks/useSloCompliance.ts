import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type SloTargetType = 'uptime' | 'latency_p99' | 'latency_p95' | 'error_rate' | 'success_rate' | 'throughput';
export type SloPeriod = '28d' | '30d' | '90d' | 'custom';
export type SloStatus = 'compliant' | 'warning' | 'breached';
export type SloTrend = 'improving' | 'stable' | 'degrading';
export type SloSeverity = 'critical' | 'high' | 'medium';

export type SloTarget = {
  id: string;
  service: string;
  type: SloTargetType;
  target: number;
  operator: 'gte' | 'lte';
  period: SloPeriod;
  description: string;
  severity: SloSeverity;
  createdAt: string;
  updatedAt: string;
};

export type SloCompliance = {
  targetId: string;
  service: string;
  type: SloTargetType;
  target: number;
  operator: 'gte' | 'lte';
  currentValue: number;
  compliance: number;
  status: SloStatus;
  period: SloPeriod;
  errorBudget: {
    total: number;
    consumed: number;
    remaining: number;
    remainingPercentage: number;
  };
  trend: SloTrend;
  description: string;
  severity: SloSeverity;
};

export type MonthlyReport = {
  month: string;
  year: number;
  totalSLOs: number;
  compliant: number;
  warning: number;
  breached: number;
  overallCompliance: number;
  uptimeAverage: number;
  latencyP99Average: number;
  errorRateAverage: number;
  byService: Array<{
    service: string;
    compliance: number;
    sloCount: number;
  }>;
};

export type SloSummary = {
  totalTargets: number;
  compliantCount: number;
  warningCount: number;
  breachedCount: number;
  overallCompliance: number;
  uptimePercentage: number;
  errorBudgetHealth: number;
  complianceTrend: SloTrend;
  lastUpdated: string;
};

export type ViolationRecord = {
  date: string;
  service: string;
  type: SloTargetType;
  message: string;
  severity: string;
};

const STATUS_COLORS: Record<SloStatus, { bg: string; text: string; border: string }> = {
  compliant: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  warning: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  breached: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

const METRIC_LABELS: Record<SloTargetType, string> = {
  uptime: 'Uptime',
  latency_p99: 'P99 Latency',
  latency_p95: 'P95 Latency',
  error_rate: 'Error Rate',
  success_rate: 'Success Rate',
  throughput: 'Throughput',
};

const METRIC_UNITS: Record<SloTargetType, string> = {
  uptime: '%',
  latency_p99: 'ms',
  latency_p95: 'ms',
  error_rate: '%',
  success_rate: '%',
  throughput: 'req/s',
};

export function useSloCompliance() {
  const [isSimulated, setIsSimulated] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<SloTargetType | 'all'>('all');

  const pollInterval = 15000;

  const summaryQuery = useQuery({
    queryKey: ['slo-summary'],
    queryFn: () => fetchJson<SloSummary>('/api/slo/summary'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const complianceQuery = useQuery({
    queryKey: ['slo-compliance', serviceFilter],
    queryFn: () => fetchJson<SloCompliance[]>(`/api/slo/compliance${serviceFilter !== 'all' ? `?service=${serviceFilter}` : ''}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const targetsQuery = useQuery({
    queryKey: ['slo-targets', serviceFilter],
    queryFn: () => fetchJson<SloTarget[]>(`/api/slo/targets${serviceFilter !== 'all' ? `?service=${serviceFilter}` : ''}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const reportQuery = useQuery({
    queryKey: ['slo-report'],
    queryFn: () => fetchJson<MonthlyReport>('/api/slo/report'),
    retry: 2,
    retryDelay: 1000,
  });

  const violationsQuery = useQuery({
    queryKey: ['slo-violations'],
    queryFn: () => fetchJson<ViolationRecord[]>('/api/slo/violations?days=30'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  // Fallback to simulated data
  useEffect(() => {
    if (summaryQuery.isError && !isSimulated) setIsSimulated(true);
    if (summaryQuery.data && isSimulated) setIsSimulated(false);
  }, [summaryQuery.isError, summaryQuery.data, isSimulated]);

  const simulated = generateSimulatedSloData(serviceFilter);

  const summary: SloSummary = summaryQuery.data ?? (isSimulated ? simulated.summary : {
    totalTargets: 0,
    compliantCount: 0,
    warningCount: 0,
    breachedCount: 0,
    overallCompliance: 100,
    uptimePercentage: 100,
    errorBudgetHealth: 100,
    complianceTrend: 'stable',
    lastUpdated: new Date().toISOString(),
  });

  const compliance: SloCompliance[] = complianceQuery.data ?? (isSimulated ? simulated.compliance : []);

  const services = ['all', ...new Set(compliance.map((c) => c.service))];

  const filteredCompliance = compliance.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  return {
    summary,
    compliance: filteredCompliance,
    allCompliance: compliance,
    services,
    serviceFilter,
    typeFilter,
    report: reportQuery.data ?? (isSimulated ? simulated.report : null),
    violations: violationsQuery.data ?? (isSimulated ? simulated.violations : []),
    isLoading: summaryQuery.isLoading && !isSimulated,
    isError: summaryQuery.isError && !isSimulated,
    isSimulated,
    setServiceFilter,
    setTypeFilter,
    refetch: () => {
      summaryQuery.refetch();
      complianceQuery.refetch();
      targetsQuery.refetch();
      reportQuery.refetch();
      violationsQuery.refetch();
    },
    STATUS_COLORS,
    METRIC_LABELS,
    METRIC_UNITS,
  };
}

function generateSimulatedSloData(serviceFilter: string) {
  const services = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];
  const types: SloTargetType[] = ['uptime', 'latency_p99', 'latency_p95', 'error_rate', 'success_rate', 'throughput'];

  const compliance: SloCompliance[] = [];

  for (const service of services) {
    if (serviceFilter !== 'all' && service !== serviceFilter) continue;

    // Uptime SLO
    const uptime = 99.5 + Math.random() * 0.5;
    compliance.push({
      targetId: `slo-${service}-uptime`,
      service,
      type: 'uptime',
      target: 99.9,
      operator: 'gte',
      currentValue: Math.round(uptime * 100) / 100,
      compliance: Math.round((uptime / 99.9) * 100),
      status: uptime >= 99.9 ? 'compliant' : uptime >= 99.5 ? 'warning' : 'breached',
      period: '30d',
      errorBudget: {
        total: 0.1,
        consumed: Math.max(0, 99.9 - uptime),
        remaining: Math.max(0, 0.1 - Math.max(0, 99.9 - uptime)),
        remainingPercentage: Math.round((Math.max(0, 0.1 - Math.max(0, 99.9 - uptime)) / 0.1) * 100),
      },
      trend: Math.random() > 0.5 ? 'improving' : 'stable',
      description: `${service} uptime`,
      severity: 'critical',
    });

    // Latency P99 SLO
    const latency = 100 + Math.random() * 500;
    compliance.push({
      targetId: `slo-${service}-latency`,
      service,
      type: 'latency_p99',
      target: 500,
      operator: 'lte',
      currentValue: Math.round(latency),
      compliance: Math.round((500 / Math.max(latency, 1)) * 100),
      status: latency <= 500 ? 'compliant' : latency <= 600 ? 'warning' : 'breached',
      period: '30d',
      errorBudget: {
        total: 100,
        consumed: Math.max(0, latency - 400),
        remaining: Math.max(0, 100 - Math.max(0, latency - 400)),
        remainingPercentage: Math.round((Math.max(0, 100 - Math.max(0, latency - 400)) / 100) * 100),
      },
      trend: Math.random() > 0.5 ? 'stable' : 'degrading',
      description: `P99 latency for ${service}`,
      severity: 'high',
    });

    // Error rate SLO
    const errorRate = Math.random() * 3;
    compliance.push({
      targetId: `slo-${service}-error-rate`,
      service,
      type: 'error_rate',
      target: 1.0,
      operator: 'lte',
      currentValue: Math.round(errorRate * 100) / 100,
      compliance: Math.round((1 / Math.max(errorRate, 0.01)) * 100),
      status: errorRate <= 1.0 ? 'compliant' : errorRate <= 2.0 ? 'warning' : 'breached',
      period: '30d',
      errorBudget: {
        total: 1,
        consumed: Math.max(0, errorRate - 0.5),
        remaining: Math.max(0, 1 - Math.max(0, errorRate - 0.5)),
        remainingPercentage: Math.round((Math.max(0, 1 - Math.max(0, errorRate - 0.5)) / 1) * 100),
      },
      trend: Math.random() > 0.6 ? 'stable' : 'degrading',
      description: `${service} error rate`,
      severity: 'medium',
    });
  }

  const compliant = compliance.filter((c) => c.status === 'compliant').length;
  const warning = compliance.filter((c) => c.status === 'warning').length;
  const breached = compliance.filter((c) => c.status === 'breached').length;

  const summary: SloSummary = {
    totalTargets: compliance.length,
    compliantCount: compliant,
    warningCount: warning,
    breachedCount: breached,
    overallCompliance: compliance.length > 0 ? Math.round((compliant / compliance.length) * 100) : 100,
    uptimePercentage: 99.7 + Math.random() * 0.2,
    errorBudgetHealth: 75 + Math.random() * 20,
    complianceTrend: Math.random() > 0.6 ? 'stable' : Math.random() > 0.5 ? 'improving' : 'degrading',
    lastUpdated: new Date().toISOString(),
  };

  const report: MonthlyReport = {
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear(),
    totalSLOs: compliance.length,
    compliant,
    warning,
    breached,
    overallCompliance: summary.overallCompliance,
    uptimeAverage: 99.8,
    latencyP99Average: 280,
    errorRateAverage: 0.8,
    byService: services.map((s) => ({
      service: s,
      compliance: Math.round(70 + Math.random() * 30),
      sloCount: 3,
    })),
  };

  const violations: ViolationRecord[] = [
    {
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      service: 'pulse-runtime',
      type: 'latency_p99',
      message: 'pulse-runtime latency p99 SLO breached: 3.2% deviation',
      severity: 'high',
    },
    {
      date: new Date(Date.now() - 5 * 86400000).toISOString(),
      service: 'pulse-graph',
      type: 'error_rate',
      message: 'pulse-graph error rate SLO near-violation: 2.1% deviation',
      severity: 'medium',
    },
    {
      date: new Date(Date.now() - 8 * 86400000).toISOString(),
      service: 'pulse-gateway',
      type: 'uptime',
      message: 'pulse-gateway uptime SLO breached: 0.15% below target',
      severity: 'critical',
    },
    {
      date: new Date(Date.now() - 12 * 86400000).toISOString(),
      service: 'pulse-runtime',
      type: 'uptime',
      message: 'pulse-runtime uptime SLO near-violation: 0.08% below target',
      severity: 'high',
    },
    {
      date: new Date(Date.now() - 15 * 86400000).toISOString(),
      service: 'pulse-trace',
      type: 'error_rate',
      message: 'pulse-trace error rate SLO breached: 4.5% deviation',
      severity: 'medium',
    },
  ];

  return { summary, compliance, report, violations };
}