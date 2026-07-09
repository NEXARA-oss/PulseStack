import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/api';

export type ServiceNode = {
  id: string;
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue' | 'external' | 'gateway';
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  metrics: {
    latency: number;
    errorRate: number;
    requestsPerMin: number;
    uptime: number;
  };
  dependencies: string[];
  metadata?: Record<string, string>;
};

export type ServiceDependency = {
  source: string;
  target: string;
  type: 'sync' | 'async' | 'stream';
  avgLatency: number;
  errorRate: number;
};

export type ServiceTopology = {
  nodes: ServiceNode[];
  edges: ServiceDependency[];
  lastUpdated: string;
};

export type ServiceDependencyGraphData = {
  topology: ServiceTopology;
  layout: 'force' | 'hierarchical' | 'radial';
};

type AutoRefreshConfig = {
  enabled: boolean;
  interval: number;
};

export function useServiceDependencies(
  autoRefresh: AutoRefreshConfig = { enabled: true, interval: 15000 }
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'force' | 'hierarchical' | 'radial'>('force');

  const query = useQuery({
    queryKey: ['service-dependencies'],
    queryFn: () => fetchJson<ServiceTopology>('/api/graph/services/topology'),
    refetchInterval: autoRefresh.enabled ? autoRefresh.interval : false,
    retry: 2,
    retryDelay: 1000,
    staleTime: autoRefresh.interval,
  });

  // Filter nodes based on search
  const filteredData = (() => {
    if (!query.data) return null;
    if (!searchQuery.trim()) return query.data;

    const q = searchQuery.toLowerCase();
    const matchedIds = new Set<string>();

    // Find matching nodes
    query.data.nodes.forEach((node) => {
      if (
        node.name.toLowerCase().includes(q) ||
        node.id.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q)
      ) {
        matchedIds.add(node.id);
      }
    });

    // Include dependencies of matched nodes
    query.data.edges.forEach((edge) => {
      if (matchedIds.has(edge.source) || matchedIds.has(edge.target)) {
        matchedIds.add(edge.source);
        matchedIds.add(edge.target);
      }
    });

    return {
      ...query.data,
      nodes: query.data.nodes.filter((n) => matchedIds.has(n.id)),
      edges: query.data.edges.filter((e) => matchedIds.has(e.source) && matchedIds.has(e.target)),
    };
  })();

  return {
    data: filteredData,
    raw: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
    searchQuery,
    setSearchQuery,
    selectedNodeId,
    setSelectedNodeId,
    layout,
    setLayout,
  };
}

// Mock data generator for offline/demo
export function generateMockServiceTopology(): ServiceTopology {
  const nodes: ServiceNode[] = [
    { id: 'api-gateway', name: 'API Gateway', type: 'gateway', status: 'healthy', metrics: { latency: 12, errorRate: 0.1, requestsPerMin: 15000, uptime: 99.99 }, dependencies: ['auth-service', 'workflow-service', 'execution-service'] },
    { id: 'auth-service', name: 'Auth Service', type: 'service', status: 'healthy', metrics: { latency: 8, errorRate: 0.05, requestsPerMin: 8000, uptime: 99.98 }, dependencies: ['user-db'] },
    { id: 'workflow-service', name: 'Workflow Service', type: 'service', status: 'healthy', metrics: { latency: 25, errorRate: 0.3, requestsPerMin: 5000, uptime: 99.95 }, dependencies: ['workflow-db', 'redis-cache', 'execution-service'] },
    { id: 'execution-service', name: 'Execution Service', type: 'service', status: 'degraded', metrics: { latency: 45, errorRate: 1.2, requestsPerMin: 3500, uptime: 99.80 }, dependencies: ['execution-db', 'redis-cache', 'queue-service'] },
    { id: 'queue-service', name: 'Queue Service', type: 'queue', status: 'healthy', metrics: { latency: 5, errorRate: 0.01, requestsPerMin: 12000, uptime: 99.99 }, dependencies: [] },
    { id: 'redis-cache', name: 'Redis Cache', type: 'cache', status: 'healthy', metrics: { latency: 2, errorRate: 0.0, requestsPerMin: 25000, uptime: 99.99 }, dependencies: [] },
    { id: 'user-db', name: 'User Database', type: 'database', status: 'healthy', metrics: { latency: 15, errorRate: 0.1, requestsPerMin: 6000, uptime: 99.97 }, dependencies: [] },
    { id: 'workflow-db', name: 'Workflow Database', type: 'database', status: 'healthy', metrics: { latency: 20, errorRate: 0.2, requestsPerMin: 4000, uptime: 99.95 }, dependencies: [] },
    { id: 'execution-db', name: 'Execution Database', type: 'database', status: 'degraded', metrics: { latency: 55, errorRate: 0.8, requestsPerMin: 3000, uptime: 99.70 }, dependencies: [] },
    { id: 'analytics-service', name: 'Analytics Service', type: 'service', status: 'healthy', metrics: { latency: 30, errorRate: 0.4, requestsPerMin: 2000, uptime: 99.90 }, dependencies: ['execution-db', 'redis-cache'] },
    { id: 'notification-service', name: 'Notification Service', type: 'service', status: 'down', metrics: { latency: 0, errorRate: 100, requestsPerMin: 0, uptime: 85.50 }, dependencies: ['queue-service'] },
    { id: 'external-payment', name: 'Payment Provider', type: 'external', status: 'unknown', metrics: { latency: 80, errorRate: 2.5, requestsPerMin: 500, uptime: 99.50 }, dependencies: [] },
  ];

  const edges: ServiceDependency[] = [
    { source: 'api-gateway', target: 'auth-service', type: 'sync', avgLatency: 10, errorRate: 0.1 },
    { source: 'api-gateway', target: 'workflow-service', type: 'sync', avgLatency: 28, errorRate: 0.3 },
    { source: 'api-gateway', target: 'execution-service', type: 'sync', avgLatency: 50, errorRate: 1.5 },
    { source: 'auth-service', target: 'user-db', type: 'sync', avgLatency: 15, errorRate: 0.1 },
    { source: 'workflow-service', target: 'workflow-db', type: 'sync', avgLatency: 20, errorRate: 0.2 },
    { source: 'workflow-service', target: 'redis-cache', type: 'sync', avgLatency: 2, errorRate: 0.0 },
    { source: 'workflow-service', target: 'execution-service', type: 'async', avgLatency: 35, errorRate: 0.5 },
    { source: 'execution-service', target: 'execution-db', type: 'sync', avgLatency: 55, errorRate: 0.8 },
    { source: 'execution-service', target: 'redis-cache', type: 'sync', avgLatency: 2, errorRate: 0.0 },
    { source: 'execution-service', target: 'queue-service', type: 'async', avgLatency: 5, errorRate: 0.01 },
    { source: 'analytics-service', target: 'execution-db', type: 'sync', avgLatency: 55, errorRate: 0.8 },
    { source: 'analytics-service', target: 'redis-cache', type: 'sync', avgLatency: 2, errorRate: 0.0 },
    { source: 'notification-service', target: 'queue-service', type: 'async', avgLatency: 5, errorRate: 0.01 },
  ];

  return {
    nodes,
    edges,
    lastUpdated: new Date().toISOString(),
  };
}
