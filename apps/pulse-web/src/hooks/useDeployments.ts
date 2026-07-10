import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
export type RollbackIndicator = 'none' | 'in_progress' | 'completed' | 'failed';

export type Deployment = {
  id: string;
  service: string;
  environment: string;
  version: string;
  commit: string;
  status: DeploymentStatus;
  rollback: RollbackIndicator;
  deployedAt: string;
  completedAt?: string;
  deployedBy: string;
};

export type DeploymentEvent = {
  id: string;
  deploymentId: string;
  type: 'started' | 'completed' | 'failed' | 'rolled_back';
  message: string;
  timestamp: string;
};

export type ImpactAnalysis = {
  deploymentId: string;
  regressionDetected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedMetrics: string[];
  errorSpike: boolean;
  latencyIncrease: number;
  suggestedAction: string;
};

export type DeploymentSummary = {
  totalDeployments: number;
  failedDeployments: number;
  rolledBackDeployments: number;
  regressionsDetected: number;
  successRate: number;
};

const STATUS_COLORS: Record<DeploymentStatus, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  running: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  success: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  failed: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  rolled_back: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.3)' },
};

const ROLLBACK_COLORS: Record<RollbackIndicator, { bg: string; text: string }> = {
  none: { bg: 'transparent', text: '#94a3b8' },
  in_progress: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24' },
  completed: { bg: 'rgba(52,211,153,0.12)', text: '#34d399' },
  failed: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
};

export function useDeployments() {
  const [serviceFilter, setServiceFilter] = useState('all');
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);

  const pollInterval = 15000;

  const deploymentsQuery = useQuery({
    queryKey: ['deployments', serviceFilter, environmentFilter],
    queryFn: () => fetchJson<Deployment[]>(`/api/deployments?service=${serviceFilter}&environment=${environmentFilter}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ['deployments-summary'],
    queryFn: () => fetchJson<DeploymentSummary>('/api/deployments/summary'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const eventsQuery = useQuery({
    queryKey: ['deployment-events', selectedDeploymentId],
    queryFn: () => fetchJson<DeploymentEvent[]>(`/api/deployments/${selectedDeploymentId}/events`),
    enabled: Boolean(selectedDeploymentId),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const impactQuery = useQuery({
    queryKey: ['deployment-impact', selectedDeploymentId],
    queryFn: () => fetchJson<ImpactAnalysis>(`/api/deployments/${selectedDeploymentId}/impact`),
    enabled: Boolean(selectedDeploymentId),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const servicesQuery = useQuery({
    queryKey: ['deployment-services'],
    queryFn: () => fetchJson<string[]>('/api/deployments/services'),
    retry: 2,
    retryDelay: 1000,
  });

  const summary: DeploymentSummary = summaryQuery.data ?? {
    totalDeployments: 0,
    failedDeployments: 0,
    rolledBackDeployments: 0,
    regressionsDetected: 0,
    successRate: 100,
  };

  return {
    deployments: deploymentsQuery.data ?? [],
    events: eventsQuery.data ?? [],
    impact: impactQuery.data,
    summary,
    services: servicesQuery.data ?? [],
    serviceFilter,
    environmentFilter,
    selectedDeploymentId,
    isLoading: deploymentsQuery.isLoading,
    isError: deploymentsQuery.isError,
    setServiceFilter,
    setEnvironmentFilter,
    setSelectedDeploymentId,
    STATUS_COLORS,
    ROLLBACK_COLORS,
  };
}
