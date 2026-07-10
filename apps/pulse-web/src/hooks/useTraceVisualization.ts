import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type SpanStatus = 'ok' | 'error' | 'unset';

export type TraceSpan = {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  status: SpanStatus;
  startedAt: string;
  durationMs: number;
  attributes?: Record<string, unknown>;
  serviceName: string;
};

export type TraceTree = {
  traceId: string;
  rootSpan: TraceSpan;
  children: TraceTree[];
  depth: number;
  totalDurationMs: number;
};

export type ServiceLatency = {
  service: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  spanCount: number;
  errorRate: number;
};

export type TraceSearchResult = {
  traceId: string;
  service: string;
  spanCount: number;
  durationMs: number;
  errorCount: number;
  startedAt: string;
};

const STATUS_COLORS: Record<SpanStatus, { bg: string; text: string; border: string }> = {
  ok: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  error: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  unset: { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
};

export function useTraceVisualization() {
  const [searchTraceId, setSearchTraceId] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  const pollInterval = 15000;

  const treeQuery = useQuery({
    queryKey: ['trace-tree', searchTraceId],
    queryFn: () => fetchJson<TraceTree>(`/api/traces/${encodeURIComponent(searchTraceId)}/tree`),
    enabled: Boolean(searchTraceId),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const searchQuery = useQuery({
    queryKey: ['trace-search', serviceFilter],
    queryFn: () => fetchJson<TraceSearchResult[]>(`/api/traces/search?service=${serviceFilter}`),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const latencyQuery = useQuery({
    queryKey: ['trace-latency'],
    queryFn: () => fetchJson<ServiceLatency[]>('/api/traces/latency'),
    refetchInterval: pollInterval,
    retry: 2,
    retryDelay: 1000,
  });

  const servicesQuery = useQuery({
    queryKey: ['trace-services'],
    queryFn: () => fetchJson<string[]>('/api/traces/services'),
    retry: 2,
    retryDelay: 1000,
  });

  return {
    searchTraceId,
    setSearchTraceId,
    serviceFilter,
    setServiceFilter,
    traceTree: treeQuery.data,
    searchResults: searchQuery.data ?? [],
    serviceLatencies: latencyQuery.data ?? [],
    services: servicesQuery.data ?? [],
    isLoading: treeQuery.isLoading || searchQuery.isLoading || latencyQuery.isLoading,
    isError: treeQuery.isError || searchQuery.isError || latencyQuery.isError,
    STATUS_COLORS,
  };
}
