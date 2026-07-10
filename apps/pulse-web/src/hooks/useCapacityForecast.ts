import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type ResourceType = 'cpu' | 'memory' | 'disk';

export type CapacityWarning = {
  id: string;
  resource: ResourceType;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  forecastedAt: string;
  threshold: number;
  predictedValue: number;
};

export type DiskGrowth = {
  service: string;
  currentGB: number;
  forecastedGB: number;
  daysUntilFull: number;
  growthRateGBPerDay: number;
};

export type ForecastReport = {
  cpu: { current: number; forecast7d: number; forecast30d: number; warning?: CapacityWarning };
  memory: { current: number; forecast7d: number; forecast30d: number; warning?: CapacityWarning };
  disk: { current: number; forecast7d: number; forecast30d: number; growth: DiskGrowth[] };
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  medium: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
  high: { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
  critical: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

export function useCapacityForecast() {
  const [resourceFilter, setResourceFilter] = useState<ResourceType | 'all'>('all');

  const forecastQuery = useQuery({
    queryKey: ['capacity-forecast'],
    queryFn: () => fetchJson<ForecastReport>('/api/forecast'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const warningsQuery = useQuery({
    queryKey: ['capacity-warnings'],
    queryFn: () => fetchJson<CapacityWarning[]>('/api/forecast/warnings'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const diskQuery = useQuery({
    queryKey: ['capacity-disk'],
    queryFn: () => fetchJson<DiskGrowth[]>('/api/forecast/disk'),
    refetchInterval: 30000,
    retry: 2,
    retryDelay: 1000,
  });

  const forecast = forecastQuery.data ?? {
    cpu: { current: 0, forecast7d: 0, forecast30d: 0 },
    memory: { current: 0, forecast7d: 0, forecast30d: 0 },
    disk: { current: 0, forecast7d: 0, forecast30d: 0, growth: [] },
  };

  const warnings = warningsQuery.data ?? [];

  const resources: Array<{ key: ResourceType; label: string; data: { current: number; forecast7d: number; forecast30d: number; warning?: CapacityWarning } }> = [
    { key: 'cpu', label: 'CPU', data: forecast.cpu },
    { key: 'memory', label: 'Memory', data: forecast.memory },
    { key: 'disk', label: 'Disk', data: forecast.disk },
  ];

  const filteredResources = resourceFilter === 'all' ? resources : resources.filter((r) => r.key === resourceFilter);

  return {
    resources: filteredResources,
    warnings,
    diskGrowth: forecast.disk.growth,
    resourceFilter,
    setResourceFilter,
    isLoading: forecastQuery.isLoading && warningsQuery.isLoading && diskQuery.isLoading,
    isError: forecastQuery.isError || warningsQuery.isError || diskQuery.isError,
    SEVERITY_COLORS,
  };
}
