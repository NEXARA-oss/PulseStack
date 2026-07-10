import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type RecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly';

export type MaintenanceWindow = {
  id: string;
  name: string;
  description: string;
  service: string;
  startAt: string;
  endAt: string;
  recurrence: RecurrenceRule;
  alertPaused: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceHistory = {
  id: string;
  windowId: string;
  event: 'created' | 'activated' | 'completed' | 'cancelled';
  timestamp: string;
  message: string;
};

export type MaintenanceIndicator = {
  inMaintenance: boolean;
  nextWindow?: MaintenanceWindow;
};

const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: 'No Recurrence',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function useMaintenanceScheduler() {
  const [serviceFilter, setServiceFilter] = useState('all');

  const windowsQuery = useQuery({
    queryKey: ['maintenance-windows', serviceFilter],
    queryFn: () => fetchJson<MaintenanceWindow[]>(`/api/maintenance/windows?service=${serviceFilter}`),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const historyQuery = useQuery({
    queryKey: ['maintenance-history'],
    queryFn: () => fetchJson<MaintenanceHistory[]>('/api/maintenance/history'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const indicatorsQuery = useQuery({
    queryKey: ['maintenance-indicators'],
    queryFn: async () => {
      const services = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];
      const results = await Promise.all(
        services.map((s) => fetchJson<MaintenanceIndicator>(`/api/maintenance/indicator/${s}`)),
      );
      return results;
    },
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const servicesQuery = useQuery({
    queryKey: ['maintenance-services'],
    queryFn: () => fetchJson<string[]>('/api/maintenance/services'),
    retry: 2,
    retryDelay: 1000,
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (window: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'updatedAt'>) =>
      postJson('/api/maintenance/windows', window),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-indicators'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => postJson(`/api/maintenance/windows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-windows'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-indicators'] });
    },
  });

  return {
    windows: windowsQuery.data ?? [],
    history: historyQuery.data ?? [],
    indicators: indicatorsQuery.data ?? [],
    services: servicesQuery.data ?? [],
    serviceFilter,
    isLoading: windowsQuery.isLoading && historyQuery.isLoading,
    isError: windowsQuery.isError || historyQuery.isError,
    setServiceFilter,
    createWindow: createMutation.mutate,
    deleteWindow: deleteMutation.mutate,
    RECURRENCE_LABELS,
  };
}
