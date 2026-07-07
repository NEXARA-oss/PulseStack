import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentAnalyzer } from './incident-dashboard.js';

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
    readRecentEvents: vi.fn(),
    readTrace: vi.fn(),
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
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('IncidentAnalyzer', () => {
  let analyzer: IncidentAnalyzer;
  let mockInfra: ReturnType<typeof createMockInfra>;

  beforeEach(() => {
    mockInfra = createMockInfra();
    analyzer = new IncidentAnalyzer(mockInfra as any);
  });

  describe('getDashboard', () => {
    it('should return dashboard with zero incidents when no executions exist', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });
      mockInfra.readRecentEvents.mockResolvedValue([]);

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard.stats.totalIncidents).toBe(0);
      expect(dashboard.activeIncidents).toEqual([]);
      expect(dashboard.recentIncidents).toEqual([]);
      expect(dashboard.stats.activeCount).toBe(0);
      expect(dashboard.stats.resolvedCount).toBe(0);
    });

    it('should detect incidents from failed executions', async () => {
      const failedExec = createMockExecution({
        id: 'exec-fail',
        status: 'failed',
        output: { error: 'Timeout error' },
      });

      mockInfra.pg.query.mockResolvedValue({ rows: [failedExec] });
      mockInfra.readRecentEvents.mockResolvedValue([]);

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard.stats.totalIncidents).toBeGreaterThanOrEqual(1);
      expect(dashboard.stats.openFailures).toBeGreaterThanOrEqual(1);
    });

    it('should compute severity distribution correctly', async () => {
      const executions = Array.from({ length: 12 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          workflow_id: `wf-${i}`,
          status: 'failed',
          output: { error: `Error ${i}` },
          correlation_id: `corr-${Math.floor(i / 3)}`,
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: executions });
      mockInfra.readRecentEvents.mockResolvedValue([]);

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard.incidentTrends.severityDistribution).toBeDefined();
      const severityKeys = Object.keys(dashboard.incidentTrends.severityDistribution);
      expect(severityKeys.length).toBeGreaterThan(0);
    });
  });

  describe('getIncident', () => {
    it('should return null for invalid incident ID', async () => {
      const incident = await analyzer.getIncident('invalid-id');
      expect(incident).toBeNull();
    });

    it('should return incident details for valid correlation ID', async () => {
      const failedExec = createMockExecution({
        id: 'exec-fail',
        correlation_id: 'corr-abc',
        status: 'failed',
        output: { error: 'Connection timeout' },
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date().toISOString(),
      });

      mockInfra.pg.query.mockResolvedValue({ rows: [failedExec] });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });

      const incident = await analyzer.getIncident('corr-abc:wf-1', 'tenant-1');
      expect(incident).not.toBeNull();
      expect(incident!.failures.length).toBeGreaterThanOrEqual(1);
      expect(incident!.failures[0].errorMessage).toContain('Connection timeout');
    });

    it('should include timeline entries for failures and recoveries', async () => {
      const execs = [
        createMockExecution({
          id: 'exec-fail',
          correlation_id: 'corr-xyz',
          status: 'failed',
          output: { error: 'Error occurred' },
          created_at: new Date(Date.now() - 120000).toISOString(),
          updated_at: new Date(Date.now() - 60000).toISOString(),
        }),
        createMockExecution({
          id: 'exec-success',
          correlation_id: 'corr-xyz',
          status: 'completed',
          created_at: new Date(Date.now() - 60000).toISOString(),
          updated_at: new Date().toISOString(),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });

      const incident = await analyzer.getIncident('corr-xyz:wf-1', 'tenant-1');
      expect(incident).not.toBeNull();
      expect(incident!.timeline.length).toBeGreaterThanOrEqual(2);
      expect(incident!.status).toBe('resolved');
    });
  });

  describe('exportIncidentReport', () => {
    it('should return null for non-existent incident', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });
      const report = await analyzer.exportIncidentReport('nonexistent:id');
      expect(report).toBeNull();
    });

    it('should generate structured report for valid incident', async () => {
      const failedExec = createMockExecution({
        id: 'exec-fail',
        correlation_id: 'corr-report',
        status: 'failed',
        output: { error: 'Database connection failed' },
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date().toISOString(),
      });

      mockInfra.pg.query.mockResolvedValue({ rows: [failedExec] });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });

      const report = await analyzer.exportIncidentReport('corr-report:wf-1', 'tenant-1');
      expect(report).not.toBeNull();
      expect(report!.report).toBeDefined();
      expect(report!.report.title).toContain('Incident Report');
      expect(report!.metadata.formatVersion).toBe('1.0');
    });
  });

  describe('addRootCauseNote', () => {
    it('should create a root cause note with generated ID and timestamp', async () => {
      const note = await analyzer.addRootCauseNote('inc-123', {
        author: 'John Doe',
        summary: 'Database connection pool exhausted',
        detail: 'The connection pool was exhausted due to a sudden spike in traffic...',
        impactedServices: ['wf-db-service'],
        contributingFactors: ['Traffic spike', 'Insufficient pool size'],
        resolution: 'Increased connection pool size and added auto-scaling',
        preventativeMeasures: ['Add connection pool monitoring', 'Implement auto-scaling'],
      });

      expect(note.id).toContain('rcn-');
      expect(note.incidentId).toBe('inc-123');
      expect(note.createdAt).toBeDefined();
      expect(note.author).toBe('John Doe');
      expect(note.summary).toBe('Database connection pool exhausted');
      expect(note.impactedServices).toEqual(['wf-db-service']);
      expect(note.contributingFactors).toHaveLength(2);
      expect(note.preventativeMeasures).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty execution list gracefully', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });
      mockInfra.readRecentEvents.mockResolvedValue([]);

      const dashboard = await analyzer.getDashboard('tenant-1');
      expect(dashboard).toBeDefined();
      expect(dashboard.stats.totalIncidents).toBe(0);
    });

    it('should handle executions with missing output gracefully', async () => {
      const execs = [
        createMockExecution({
          id: 'exec-1',
          status: 'failed',
          output: {} as any,
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: execs });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });

      const incident = await analyzer.getIncident('corr-1:wf-1', 'tenant-1');
      expect(incident).not.toBeNull();
      expect(incident!.failures.length).toBeGreaterThanOrEqual(1);
    });

    it('should treat all completed executions as recoveries', async () => {
      const successfulExec = createMockExecution({
        id: 'exec-success',
        status: 'completed',
        created_at: new Date(Date.now() - 5000).toISOString(),
        updated_at: new Date().toISOString(),
      });

      mockInfra.pg.query.mockResolvedValue({ rows: [successfulExec] });
      mockInfra.readRecentEvents.mockResolvedValue([]);
      mockInfra.clickhouse.query.mockResolvedValue({ json: () => Promise.resolve([]) });

      const incident = await analyzer.getIncident('corr-1:wf-1', 'tenant-1');
      expect(incident).not.toBeNull();
      expect(incident!.recoveries.length).toBeGreaterThanOrEqual(1);
      expect(incident!.recoveries[0].recoveryType).toBe('auto');
    });
  });
});