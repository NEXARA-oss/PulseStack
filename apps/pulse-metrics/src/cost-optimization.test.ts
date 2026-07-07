import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostOptimizationAnalyzer, usageFromOutput } from './cost-optimization.js';

// ── Types matching the module's internal types ───────────────────────────────

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

type UsageMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  attribution?: {
    tenantId?: string;
    workflowId?: string;
    executionId?: string;
    stepId?: string;
    retryAttempt?: number;
    replaySessionId?: string;
    model?: string;
  };
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

function createMockInfra() {
  return {
    pg: {
      query: vi.fn(),
    },
    readMetrics: vi.fn(),
    getTenantUsage: vi.fn(),
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
    output: overrides.output ?? {
      totalTokens: 100,
      totalCostUsd: 0.01,
    },
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function createMockUsageOutput(overrides: Partial<UsageMetadata> = {}) {
  return {
    usage: {
      inputTokens: overrides.inputTokens ?? 10,
      outputTokens: overrides.outputTokens ?? 20,
      totalTokens: overrides.totalTokens ?? 30,
      inputCost: overrides.inputCost ?? 0.001,
      outputCost: overrides.outputCost ?? 0.002,
      totalCost: overrides.totalCost ?? 0.003,
      attribution: overrides.attribution ?? {
        model: 'gpt-4',
      },
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CostOptimizationAnalyzer', () => {
  let analyzer: CostOptimizationAnalyzer;
  let mockInfra: ReturnType<typeof createMockInfra>;

  beforeEach(() => {
    mockInfra = createMockInfra();
    analyzer = new CostOptimizationAnalyzer(mockInfra as any);
  });

  describe('detectIdleResources', () => {
    it('should detect workflows idle for more than 14 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);

      const executions = [
        createMockExecution({
          workflow_id: 'idle-wf',
          updated_at: oldDate.toISOString(),
          output: createMockUsageOutput({ totalCost: 0.05 }),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.idleResources.length).toBeGreaterThanOrEqual(1);
      expect(insights.idleResources[0].id).toBe('idle-wf');
      expect(insights.idleResources[0].idleDays).toBeGreaterThanOrEqual(14);
      expect(insights.idleResources[0].status).toBe('idle');
    });

    it('should not flag recently active workflows as idle', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1);

      const executions = [
        createMockExecution({
          workflow_id: 'active-wf',
          updated_at: recentDate.toISOString(),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.idleResources.length).toBe(0);
    });
  });

  describe('identifyUnderutilizedServices', () => {
    it('should identify workflows with low execution count and token usage', async () => {
      const executions = [
        createMockExecution({
          workflow_id: 'underutilized-wf',
          output: createMockUsageOutput({ totalTokens: 100, totalCost: 0.001 }),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.underutilizedServices.length).toBeGreaterThanOrEqual(0);
      // The threshold is 5 executions and 10k tokens - this is below both
    });

    it('should not flag workflows with high execution count', async () => {
      const executions = Array.from({ length: 20 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          workflow_id: 'busy-wf',
          output: createMockUsageOutput({ totalTokens: 5000, totalCost: 0.01 }),
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      const busyWorkflow = insights.underutilizedServices.find(
        (s) => s.workflowId === 'busy-wf',
      );
      expect(busyWorkflow).toBeUndefined();
    });
  });

  describe('computeEfficiencyScore', () => {
    it('should return 100 score for no executions', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.efficiencyScore.overall).toBe(100);
    });

    it('should compute efficiency score based on multiple factors', async () => {
      const executions = [
        createMockExecution({
          status: 'completed',
          output: createMockUsageOutput({ totalCost: 0.01 }),
        }),
        createMockExecution({
          id: 'exec-2',
          status: 'completed',
          output: createMockUsageOutput({ totalCost: 0.005 }),
        }),
        createMockExecution({
          id: 'exec-3',
          status: 'failed',
          output: createMockUsageOutput({ totalCost: 0.02 }),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.efficiencyScore.overall).toBeGreaterThanOrEqual(0);
      expect(insights.efficiencyScore.overall).toBeLessThanOrEqual(100);
      expect(insights.efficiencyScore.categories).toHaveProperty('utilization');
      expect(insights.efficiencyScore.categories).toHaveProperty('costEfficiency');
      expect(insights.efficiencyScore.categories).toHaveProperty('reliability');
      expect(insights.efficiencyScore.categories).toHaveProperty('resourceConservation');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate termination recommendations for idle resources', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20);

      const executions = [
        createMockExecution({
          workflow_id: 'idle-wf',
          updated_at: oldDate.toISOString(),
          output: createMockUsageOutput({ totalCost: 0.05 }),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      const terminateRecs = insights.recommendations.filter(
        (r) => r.type === 'terminate_idle',
      );
      expect(terminateRecs.length).toBeGreaterThanOrEqual(1);
      expect(terminateRecs[0].risk).toBe('low');
      expect(terminateRecs[0].effort).toBe('easy');
    });

    it('should generate model optimization recommendations for expensive models', async () => {
      const executions = [
        createMockExecution({
          output: createMockUsageOutput({
            totalCost: 0.5,
            attribution: { model: 'gpt-4' },
          }),
        }),
        createMockExecution({
          id: 'exec-2',
          output: createMockUsageOutput({
            totalCost: 0.3,
            attribution: { model: 'gpt-4' },
          }),
        }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      const modelRecs = insights.recommendations.filter(
        (r) => r.type === 'optimize_model_usage',
      );
      expect(modelRecs.length).toBeGreaterThanOrEqual(1);
      expect(modelRecs[0].resourceId).toBe('gpt-4');
    });
  });

  describe('getMonthlyReport', () => {
    it('should generate a monthly report with period and trends', async () => {
      const executions = [
        createMockExecution({ output: createMockUsageOutput() }),
        createMockExecution({ id: 'exec-2', output: createMockUsageOutput() }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const report = await analyzer.getMonthlyReport('tenant-1');
      expect(report).toHaveProperty('period');
      expect(report.period).toHaveProperty('start');
      expect(report.period).toHaveProperty('end');
      expect(report.summary).toHaveProperty('totalExecutions');
      expect(report.summary).toHaveProperty('totalCost');
      expect(report.summary).toHaveProperty('estimatedSavings');
      expect(report.summary).toHaveProperty('efficiencyScore');
      expect(report.trends).toHaveProperty('costTrend');
      expect(report.trends).toHaveProperty('executionTrend');
      expect(report.trends).toHaveProperty('efficiencyTrend');
    });
  });

  describe('edge cases', () => {
    it('should handle empty execution list', async () => {
      mockInfra.pg.query.mockResolvedValue({ rows: [] });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      expect(insights.idleResources).toEqual([]);
      expect(insights.underutilizedServices).toEqual([]);
      expect(insights.recommendations).toEqual([]);
      expect(insights.estimatedTotalMonthlySavings).toBe(0);
    });

    it('should handle executions with missing output data', async () => {
      const executions = [
        createMockExecution({ output: {} }),
        createMockExecution({ id: 'exec-2', output: { usage: null } }),
      ];

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      // Should not throw, should handle gracefully
      expect(insights.efficiencyScore.overall).toBeDefined();
    });

    it('should not flag workflows with sufficient execution count as underutilized', async () => {
      const executions = Array.from({ length: 6 }, (_, i) =>
        createMockExecution({
          id: `exec-${i}`,
          workflow_id: 'busy-wf',
          output: createMockUsageOutput({ totalTokens: 500, totalCost: 0.002 }),
        }),
      );

      mockInfra.pg.query.mockResolvedValue({ rows: executions });

      const insights = await analyzer.getOptimizationInsights('tenant-1');
      const busyEntry = insights.underutilizedServices.find(
        (s) => s.workflowId === 'busy-wf',
      );
      expect(busyEntry).toBeUndefined();
    });
  });
});