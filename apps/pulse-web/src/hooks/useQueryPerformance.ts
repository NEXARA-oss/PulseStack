import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type QueryExecution = {
  id: string;
  queryText: string;
  endpoint: string;
  executionTimeMs: number;
  rowsScanned: number;
  rowsReturned: number;
  resourceUsage: { cpuMs: number; memoryMb: number };
  executedAt: string;
  isSlow: boolean;
};

export type OptimizationHint = {
  id: string;
  queryId: string;
  hint: string;
  category: string;
  impact: string;
  description: string;
};

export type QueryStats = {
  totalQueries: number;
  slowQueryCount: number;
  avgExecutionTimeMs: number;
  avgCpuMs: number;
  avgMemoryMb: number;
  totalRowsScanned: number;
  slowPercentage: number;
};

export function useQueryPerformance() {
  const [filterSlow, setFilterSlow] = useState(false);

  const queriesQuery = useQuery({
    queryKey: ['query-performance', filterSlow],
    queryFn: () => fetchJson<QueryExecution[]>(`/api/queries/performance?limit=25&onlySlow=${filterSlow ? 'true' : 'false'}`),
    refetchInterval: 15000,
    retry: 2,
    retryDelay: 1000,
  });

  const slowQueryQuery = useQuery({
    queryKey: ['slow-queries'],
    queryFn: () => fetchJson<QueryExecution[]>('/api/queries/slow'),
    refetchInterval: 15000,
    retry: 2,
    retryDelay: 1000,
  });

  const statsQuery = useQuery({
    queryKey: ['query-stats'],
    queryFn: () => fetchJson<QueryStats>('/api/queries/stats'),
    refetchInterval: 15000,
    retry: 2,
    retryDelay: 1000,
  });

  return {
    queries: queriesQuery.data ?? [],
    slowQueries: slowQueryQuery.data ?? [],
    stats: statsQuery.data,
    filterSlow,
    setFilterSlow,
    isLoading: queriesQuery.isLoading && statsQuery.isLoading,
    isError: queriesQuery.isError || statsQuery.isError,
  };
}
