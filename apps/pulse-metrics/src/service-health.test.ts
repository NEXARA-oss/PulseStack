import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceHealthAnalyzer } from './service-health.js';

// ── Types ──────────────────────────────────────────────────────────────────────

type ExecutionRecord = {
  id: string;
  workflow_id: string;
  tenant_id: string;
  correlation_id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

function createMockInfra() {
  return {
    pg: { query: vi.fn() },
    clickhouse: { query: vi.fn() },
    readMetrics: vi.fn(),
    readRecentEvents: vi.fn(),
  } as any;
}

function createMockExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: overrides.id ?? 'exec-1',
    workflow_id: overrides.workflow_id ?? 'wf-1',
    tenant_id: overrides.tenant_id ?? 'tenant-1',
    correlation_id: overrides.correlation_id ?? 'corr-1',
    status: overrides.status ?? 'completed',
    input: overrides.input ?? {},
    output: overrides.output ?? {},
    created_at: overrides.created_at ?? new Date(Date.now() - 60000).toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ServiceHealthAnalyzer', () => {
  let analyzer: ServiceHealthAnalyzer;
  let mockInfra: ReturnType<typeof createMockInfra>;

  beforeEach(() => {
    mockInfra = createMockInfra();
    analyzer = new ServiceHealthAnalyzer(mockInfra as any);
  });

  describe('getDashboard', () => {
    it('should return dashboard with unknown health when no data exists', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard.overallHealth.status).toBe('unknown');
      expect(dashboard.summary.totalServices).toBe(0);
      expect(dashboard.services).toEqual([]);
      expect(dashboard.autoRefreshInterval).toBe(30);
    });

    it('should detect healthy services from successful executions', async () => {
      const execs = Array.from({ length: 10 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          workflow_id: 'wf-healthy',
          status: 'completed',
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      const service = dashboard.services.find((s) => s.serviceId === 'wf-healthy');
      expect(service).toBeDefined();
      expect(service!.status).toBe('healthy');
      expect(service!.uptimePercent).toBe(100);
      expect(service!.executionCount).toBe(10);
    });

    it('should detect degraded services with mixed success/failure', async () => {
      const execs = [
        ...Array.from({ length: 8 }, (_, i) =>
          createMockExecution({ id: `ok-${i}`, status: 'completed', workflow_id: 'wf-mixed' }),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          createMockExecution({ id: `fail-${i}`, status: 'failed', workflow_id: 'wf-mixed', output: { error: 'timeout' } }),
        ),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      const service = dashboard.services.find((s) => s.serviceId === 'wf-mixed');
      expect(service).toBeDefined();
      expect(service!.uptimePercent).toBe(80);
      expect(service!.successCount).toBe(8);
      expect(service!.failureCount).toBe(2);
    });

    it('should detect unhealthy services with high failure rate', async () => {
      const execs = Array.from({ length: 10 }, (_, i) =>
        createMockExecution({
          id: `fail-${i}`,
          workflow_id: 'wf-unhealthy',
          status: i < 3 ? 'completed' : 'failed',
          output: { error: 'crash' },
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      const service = dashboard.services.find((s) => s.serviceId === 'wf-unhealthy');
      expect(service).toBeDefined();
      expect(service!.status).toBe('unhealthy');
      expect(service!.uptimePercent).toBe(30);
    });

    it('should detect down services with all failures', async () => {
      const execs = Array.from({ length: 5 }, (_, i) =>
        createMockExecution({
          id: `fail-${i}`,
          workflow_id: 'wf-down',
          status: 'failed',
          output: { error: 'crash' },
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      const service = dashboard.services.find((s) => s.serviceId === 'wf-down');
      expect(service).toBeDefined();
      expect(service!.status).toBe('down');
      expect(service!.uptimePercent).toBe(0);
    });

    it('should compute correct summary stats', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'wf-a', status: 'completed' }),
        createMockExecution({ id: 'e2', workflow_id: 'wf-a', status: 'completed' }),
        createMockExecution({ id: 'e3', workflow_id: 'wf-b', status: 'failed', output: { error: 'err' } }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard.summary.totalServices).toBe(2);
      expect(dashboard.summary.totalExecutions).toBe(3);
      expect(dashboard.summary.healthyCount + dashboard.summary.degradedCount + dashboard.summary.unhealthyCount + dashboard.summary.downCount).toBe(2);
    });
  });

  describe('getServiceHealth', () => {
    it('should return null for non-existent service', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });
      const card = await analyzer.getServiceHealth('nonexistent', 'tenant-1');
      expect(card).toBeNull();
    });

    it('should return status card for existing service', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'wf-specific', status: 'completed' }),
        createMockExecution({ id: 'e2', workflow_id: 'wf-specific', status: 'completed' }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });

      const card = await analyzer.getServiceHealth('wf-specific', 'tenant-1');
      expect(card).not.toBeNull();
      expect(card!.serviceId).toBe('wf-specific');
      expect(card!.status).toBe('healthy');
      expect(card!.uptimePercent).toBe(100);
    });
  });

  describe('getSnapshot', () => {
    it('should return lightweight health snapshot', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'wf-snap', status: 'completed' }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const snapshot = await analyzer.getSnapshot('tenant-1');
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.services.length).toBeGreaterThanOrEqual(1);
      expect(snapshot.services[0]).toHaveProperty('serviceId');
      expect(snapshot.services[0]).toHaveProperty('status');
      expect(snapshot.services[0]).toHaveProperty('uptimePercent');
      expect(snapshot.services[0]).toHaveProperty('responseTimeMs');
      expect(snapshot.services[0]).toHaveProperty('errorRate');
    });
  });

  describe('searchServices', () => {
    it('should find services matching query', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'api-gateway', status: 'completed' }),
        createMockExecution({ id: 'e2', workflow_id: 'auth-service', status: 'completed' }),
        createMockExecution({ id: 'e3', workflow_id: 'data-pipeline', status: 'completed' }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const results = await analyzer.searchServices('api', 'tenant-1');
      expect(results.length).toBe(1);
      expect(results[0].serviceId).toBe('api-gateway');
    });

    it('should be case-insensitive', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'API-Gateway', status: 'completed' }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const results = await analyzer.searchServices('api', 'tenant-1');
      expect(results.length).toBe(1);
    });
  });

  describe('filterByStatus', () => {
    it('should return all services when filter is "all"', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'wf-a', status: 'completed' }),
        createMockExecution({ id: 'e2', workflow_id: 'wf-b', status: 'failed', output: { error: 'err' } }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const all = await analyzer.filterByStatus('all', 'tenant-1');
      expect(all.length).toBe(2);
    });

    it('should filter by specific status', async () => {
      const execs = [
        createMockExecution({ id: 'e1', workflow_id: 'wf-healthy', status: 'completed' }),
        createMockExecution({ id: 'e2', workflow_id: 'wf-down', status: 'failed', output: { error: 'err' } }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readMetrics.mockResolvedValue({});

      const downServices = await analyzer.filterByStatus('down', 'tenant-1');
      expect(downServices.length).toBe(1);
      expect(downServices[0].serviceId).toBe('wf-down');
    });
  });
});