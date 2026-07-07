// ── Inline Types (no external package imports needed for testability) ──────────

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

type PgQueryResult<T> = { rows: T[] };

type PulseInfraLike = {
  pg: {
    query: <T>(text: string, params?: unknown[]) => Promise<PgQueryResult<T>>;
  };
  readMetrics: (tenantId?: string) => Promise<unknown>;
};

// ── Exported Types ─────────────────────────────────────────────────────────────

export type ResourceStatus = 'idle' | 'underutilized' | 'efficient' | 'unknown';

export type IdleResource = {
  type: 'workflow' | 'execution' | 'tenant';
  id: string;
  name: string;
  lastActiveAt: string;
  idleDays: number;
  estimatedMonthlyCost: number;
  status: ResourceStatus;
};

export type UnderutilizedService = {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  totalTokens: number;
  totalCost: number;
  avgCostPerExecution: number;
  utilizationScore: number;
  status: ResourceStatus;
};

export type CostSavingRecommendation = {
  type: 'terminate_idle' | 'rightsize_underutilized' | 'consolidate_workflows' | 'optimize_model_usage';
  resourceId: string;
  resourceName: string;
  description: string;
  estimatedMonthlySavings: number;
  risk: 'low' | 'medium' | 'high';
  effort: 'easy' | 'moderate' | 'complex';
};

export type ResourceEfficiencyScore = {
  overall: number;
  categories: {
    utilization: number;
    costEfficiency: number;
    reliability: number;
    resourceConservation: number;
  };
  breakdown: {
    totalExecutions: number;
    successRate: number;
    avgCostPerExecution: number;
    idleResourceRatio: number;
    underutilizedRatio: number;
  };
};

export type MonthlyOptimizationReport = {
  period: {
    start: string;
    end: string;
  };
  tenantId?: string;
  summary: {
    totalExecutions: number;
    totalCost: number;
    estimatedSavings: number;
    efficiencyScore: ResourceEfficiencyScore;
  };
  idleResources: IdleResource[];
  underutilizedServices: UnderutilizedService[];
  recommendations: CostSavingRecommendation[];
  trends: {
    costTrend: 'increasing' | 'decreasing' | 'stable';
    executionTrend: 'increasing' | 'decreasing' | 'stable';
    efficiencyTrend: 'improving' | 'declining' | 'stable';
  };
};

export type OptimizationInsights = {
  tenantId?: string;
  generatedAt: string;
  efficiencyScore: ResourceEfficiencyScore;
  idleResources: IdleResource[];
  underutilizedServices: UnderutilizedService[];
  recommendations: CostSavingRecommendation[];
  estimatedTotalMonthlySavings: number;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const IDLE_THRESHOLD_DAYS = 14;
const UNDERUTILIZED_EXECUTION_THRESHOLD = 5;
const UNDERUTILIZED_TOKEN_THRESHOLD = 10_000;
const EFFICIENCY_WEIGHT_UTILIZATION = 0.3;
const EFFICIENCY_WEIGHT_COST = 0.3;
const EFFICIENCY_WEIGHT_RELIABILITY = 0.2;
const EFFICIENCY_WEIGHT_CONSERVATION = 0.2;

// ── Pure Helper Functions ──────────────────────────────────────────────────────

export function usageFromOutput(
  output: Record<string, unknown> | undefined,
  attribution?: UsageMetadata['attribution'],
): UsageMetadata {
  const usage = output?.usage;
  if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
    return {
      ...(usage as UsageMetadata),
      attribution: {
        ...attribution,
        ...(usage as UsageMetadata).attribution,
      },
    };
  }
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: Number(output?.totalTokens ?? 0),
    inputCost: 0,
    outputCost: 0,
    totalCost: Number(output?.totalCostUsd ?? 0),
    ...(attribution ? { attribution } : {}),
  };
}

export function aggregateUsage(
  items: Array<UsageMetadata | undefined>,
  attribution?: UsageMetadata['attribution'],
): UsageMetadata {
  type UsageTotals = {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  const totals = items.reduce(
    (sum: UsageTotals, item): UsageTotals => ({
      inputTokens: sum.inputTokens + Number(item?.inputTokens ?? 0),
      outputTokens: sum.outputTokens + Number(item?.outputTokens ?? 0),
      totalTokens: sum.totalTokens + Number(item?.totalTokens ?? 0),
      inputCost: sum.inputCost + Number(item?.inputCost ?? 0),
      outputCost: sum.outputCost + Number(item?.outputCost ?? 0),
      totalCost: sum.totalCost + Number(item?.totalCost ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0 },
  );
  return {
    inputTokens: totals.inputTokens,
    outputTokens: totals.outputTokens,
    totalTokens: totals.totalTokens,
    inputCost: totals.inputCost,
    outputCost: totals.outputCost,
    totalCost: totals.totalCost,
    ...(attribution ? { attribution } : {}),
  };
}

// ── Cost Optimization Analyzer ─────────────────────────────────────────────────

export class CostOptimizationAnalyzer {
  constructor(private infra: PulseInfraLike) {}

  async getOptimizationInsights(tenantId?: string): Promise<OptimizationInsights> {
    const executions = await this.getExecutions(tenantId);

    if (executions.length === 0) {
      return {
        tenantId,
        generatedAt: new Date().toISOString(),
        efficiencyScore: {
          overall: 100,
          categories: { utilization: 100, costEfficiency: 100, reliability: 100, resourceConservation: 100 },
          breakdown: {
            totalExecutions: 0,
            successRate: 1,
            avgCostPerExecution: 0,
            idleResourceRatio: 0,
            underutilizedRatio: 0,
          },
        },
        idleResources: [],
        underutilizedServices: [],
        recommendations: [],
        estimatedTotalMonthlySavings: 0,
      };
    }

    const usageData = this.extractUsageData(executions);
    const idleResources = this.detectIdleResources(executions, usageData);
    const underutilizedServices = this.identifyUnderutilizedServices(executions, usageData);
    const efficiencyScore = this.computeEfficiencyScore(executions, idleResources, underutilizedServices);
    const recommendations = this.generateRecommendations(idleResources, underutilizedServices, usageData);
    const estimatedTotalMonthlySavings = recommendations.reduce(
      (sum, r) => sum + r.estimatedMonthlySavings,
      0,
    );

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      efficiencyScore,
      idleResources,
      underutilizedServices,
      recommendations,
      estimatedTotalMonthlySavings,
    };
  }

  async getMonthlyReport(tenantId?: string): Promise<MonthlyOptimizationReport> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const insights = await this.getOptimizationInsights(tenantId);
    const executions = await this.getExecutions(tenantId);

    const trends = this.computeTrends(executions);

    return {
      period: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
      tenantId,
      summary: {
        totalExecutions: insights.efficiencyScore.breakdown.totalExecutions,
        totalCost: this.computeTotalCost(executions),
        estimatedSavings: insights.estimatedTotalMonthlySavings,
        efficiencyScore: insights.efficiencyScore,
      },
      idleResources: insights.idleResources,
      underutilizedServices: insights.underutilizedServices,
      recommendations: insights.recommendations,
      trends,
    };
  }

  // ── Data Access ──────────────────────────────────────────────────────────────

  private async getExecutions(tenantId?: string): Promise<ExecutionRecord[]> {
    const result = await this.infra.pg.query<ExecutionRecord>(
      tenantId
        ? 'select * from executions where tenant_id = $1 order by created_at desc'
        : 'select * from executions order by created_at desc',
      tenantId ? [tenantId] : [],
    );
    return result.rows;
  }

  private extractUsageData(executions: ExecutionRecord[]): Map<string, UsageMetadata> {
    const usageMap = new Map<string, UsageMetadata>();
    for (const exec of executions) {
      const usage = usageFromOutput(exec.output, {
        executionId: exec.id,
        workflowId: exec.workflow_id,
        tenantId: exec.tenant_id,
      });
      usageMap.set(exec.id, usage);
    }
    return usageMap;
  }

  // ── Detection & Analysis Methods (public for testability) ────────────────────

  detectIdleResources(
    executions: ExecutionRecord[],
    usageData: Map<string, UsageMetadata>,
  ): IdleResource[] {
    const idleResources: IdleResource[] = [];
    const now = new Date();

    const workflowMap = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = workflowMap.get(exec.workflow_id) ?? [];
      existing.push(exec);
      workflowMap.set(exec.workflow_id, existing);
    }

    for (const [workflowId, workflowExecs] of workflowMap) {
      const sorted = [...workflowExecs].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      const lastActive = sorted[0];
      if (!lastActive) continue;

      const lastActiveDate = new Date(lastActive.updated_at);
      const idleDays = Math.floor((now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

      if (idleDays >= IDLE_THRESHOLD_DAYS) {
        const monthlyCost = this.estimateMonthlyCost(workflowExecs, usageData);
        idleResources.push({
          type: 'workflow',
          id: workflowId,
          name: workflowId,
          lastActiveAt: lastActive.updated_at,
          idleDays,
          estimatedMonthlyCost: monthlyCost,
          status: 'idle',
        });
      }
    }

    return idleResources;
  }

  identifyUnderutilizedServices(
    executions: ExecutionRecord[],
    usageData: Map<string, UsageMetadata>,
  ): UnderutilizedService[] {
    const underutilized: UnderutilizedService[] = [];

    const workflowMap = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = workflowMap.get(exec.workflow_id) ?? [];
      existing.push(exec);
      workflowMap.set(exec.workflow_id, existing);
    }

    for (const [workflowId, workflowExecs] of workflowMap) {
      const execCount = workflowExecs.length;
      const totalUsage = aggregateUsage(
        workflowExecs.map((e) => usageData.get(e.id)),
      );
      const totalCost = totalUsage.totalCost ?? 0;
      const totalTokens = totalUsage.totalTokens ?? 0;
      const avgCostPerExecution = execCount > 0 ? totalCost / execCount : 0;

      const executionScore = Math.min(100, (execCount / UNDERUTILIZED_EXECUTION_THRESHOLD) * 50);
      const tokenScore = Math.min(100, (totalTokens / UNDERUTILIZED_TOKEN_THRESHOLD) * 50);
      const utilizationScore = Math.round((executionScore + tokenScore) / 2);

      const isUnderutilized = execCount < UNDERUTILIZED_EXECUTION_THRESHOLD && totalTokens < UNDERUTILIZED_TOKEN_THRESHOLD;

      if (isUnderutilized) {
        underutilized.push({
          workflowId,
          workflowName: workflowId,
          executionCount: execCount,
          totalTokens,
          totalCost,
          avgCostPerExecution,
          utilizationScore,
          status: 'underutilized',
        });
      }
    }

    return underutilized.sort((a, b) => a.utilizationScore - b.utilizationScore).slice(0, 20);
  }

  computeEfficiencyScore(
    executions: ExecutionRecord[],
    idleResources: IdleResource[],
    underutilizedServices: UnderutilizedService[],
  ): ResourceEfficiencyScore {
    const total = executions.length;
    if (total === 0) {
      return {
        overall: 100,
        categories: { utilization: 100, costEfficiency: 100, reliability: 100, resourceConservation: 100 },
        breakdown: {
          totalExecutions: 0,
          successRate: 1,
          avgCostPerExecution: 0,
          idleResourceRatio: 0,
          underutilizedRatio: 0,
        },
      };
    }

    const succeeded = executions.filter((e) =>
      ['completed', 'success', 'succeeded'].includes(e.status),
    ).length;
    const successRate = succeeded / total;

    const totalCost = this.computeTotalCost(executions);
    const avgCostPerExecution = totalCost / total;

    const totalWorkflows = new Set(executions.map((e) => e.workflow_id)).size;
    const idleResourceRatio = totalWorkflows > 0 ? idleResources.length / totalWorkflows : 0;
    const underutilizedRatio = totalWorkflows > 0 ? underutilizedServices.length / totalWorkflows : 0;

    const utilization = Math.round(100 * (1 - Math.min(1, idleResourceRatio + underutilizedRatio)));
    const costEfficiency = Math.round(100 * Math.max(0, 1 - Math.min(1, avgCostPerExecution / 0.1)));
    const reliability = Math.round(100 * successRate);
    const conservation = Math.round(100 * (1 - Math.min(1, (idleResourceRatio * 0.5 + underutilizedRatio * 0.5))));

    const overall = Math.round(
      utilization * EFFICIENCY_WEIGHT_UTILIZATION +
        costEfficiency * EFFICIENCY_WEIGHT_COST +
        reliability * EFFICIENCY_WEIGHT_RELIABILITY +
        conservation * EFFICIENCY_WEIGHT_CONSERVATION,
    );

    return {
      overall,
      categories: { utilization, costEfficiency, reliability, resourceConservation: conservation },
      breakdown: {
        totalExecutions: total,
        successRate,
        avgCostPerExecution,
        idleResourceRatio,
        underutilizedRatio,
      },
    };
  }

  // ── Recommendation & Trend Analysis ──────────────────────────────────────────

  private generateRecommendations(
    idleResources: IdleResource[],
    underutilizedServices: UnderutilizedService[],
    usageData: Map<string, UsageMetadata>,
  ): CostSavingRecommendation[] {
    const recommendations: CostSavingRecommendation[] = [];

    for (const resource of idleResources) {
      recommendations.push({
        type: 'terminate_idle',
        resourceId: resource.id,
        resourceName: resource.name,
        description: `Workflow "${resource.name}" has been idle for ${resource.idleDays} days. Consider terminating or archiving to save costs.`,
        estimatedMonthlySavings: resource.estimatedMonthlyCost,
        risk: 'low',
        effort: 'easy',
      });
    }

    for (const service of underutilizedServices) {
      recommendations.push({
        type: 'rightsize_underutilized',
        resourceId: service.workflowId,
        resourceName: service.workflowName,
        description: `Workflow "${service.workflowName}" has only ${service.executionCount} executions with ${service.totalTokens} total tokens. Consider consolidating with similar workflows.`,
        estimatedMonthlySavings: service.totalCost * 0.3,
        risk: 'medium',
        effort: 'moderate',
      });
    }

    const modelUsage = this.analyzeModelUsage(usageData);
    for (const [model, data] of modelUsage) {
      if (data.totalCost > 0.01) {
        const cheaperModel = this.findCheaperAlternative(model);
        if (cheaperModel) {
          const potentialSavings = data.totalCost * 0.4;
          recommendations.push({
            type: 'optimize_model_usage',
            resourceId: model,
            resourceName: model,
            description: `Model "${model}" accounts for $${data.totalCost.toFixed(4)} in costs. Consider switching to "${cheaperModel}" for non-critical tasks to save approximately $${potentialSavings.toFixed(4)}/month.`,
            estimatedMonthlySavings: potentialSavings,
            risk: 'medium',
            effort: 'moderate',
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
  }

  private computeTrends(
    executions: ExecutionRecord[],
  ): MonthlyOptimizationReport['trends'] {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentExecutions = executions.filter(
      (e) => new Date(e.created_at) >= thirtyDaysAgo,
    );
    const olderExecutions = executions.filter(
      (e) => new Date(e.created_at) < thirtyDaysAgo,
    );

    const recentCost = this.computeTotalCost(recentExecutions);
    const olderCost = this.computeTotalCost(olderExecutions);

    const costTrend = recentCost > olderCost * 1.1 ? 'increasing' : recentCost < olderCost * 0.9 ? 'decreasing' : 'stable';
    const executionTrend = recentExecutions.length > olderExecutions.length * 1.1 ? 'increasing' : recentExecutions.length < olderExecutions.length * 0.9 ? 'decreasing' : 'stable';

    const recentSuccessRate = recentExecutions.length > 0
      ? recentExecutions.filter((e) => ['completed', 'success', 'succeeded'].includes(e.status)).length / recentExecutions.length
      : 0;
    const olderSuccessRate = olderExecutions.length > 0
      ? olderExecutions.filter((e) => ['completed', 'success', 'succeeded'].includes(e.status)).length / olderExecutions.length
      : 0;

    const efficiencyTrend = recentSuccessRate > olderSuccessRate * 1.05 ? 'improving' : recentSuccessRate < olderSuccessRate * 0.95 ? 'declining' : 'stable';

    return { costTrend, executionTrend, efficiencyTrend };
  }

  private computeTotalCost(executions: ExecutionRecord[]): number {
    return executions.reduce((sum, exec) => {
      const usage = usageFromOutput(exec.output);
      return sum + (usage.totalCost ?? 0);
    }, 0);
  }

  private estimateMonthlyCost(
    executions: ExecutionRecord[],
    usageData: Map<string, UsageMetadata>,
  ): number {
    const totalCost = executions.reduce((sum, exec) => {
      const usage = usageData.get(exec.id);
      return sum + (usage?.totalCost ?? 0);
    }, 0);
    return executions.length > 0 ? (totalCost / executions.length) * 30 : 0;
  }

  private analyzeModelUsage(
    usageData: Map<string, UsageMetadata>,
  ): Map<string, { count: number; totalCost: number; totalTokens: number }> {
    const modelMap = new Map<string, { count: number; totalCost: number; totalTokens: number }>();

    for (const usage of usageData.values()) {
      const model = usage.attribution?.model ?? 'unknown';
      const existing = modelMap.get(model) ?? { count: 0, totalCost: 0, totalTokens: 0 };
      existing.count += 1;
      existing.totalCost += usage.totalCost ?? 0;
      existing.totalTokens += usage.totalTokens ?? 0;
      modelMap.set(model, existing);
    }

    return modelMap;
  }

  private findCheaperAlternative(model: string): string | null {
    const modelHierarchy: Record<string, string[]> = {
      'gpt-4': ['gpt-3.5-turbo', 'gpt-4o-mini'],
      'gpt-4-turbo': ['gpt-4o-mini', 'gpt-3.5-turbo'],
      'gpt-4o': ['gpt-4o-mini', 'gpt-3.5-turbo'],
      'claude-3-opus': ['claude-3-sonnet', 'claude-3-haiku'],
      'claude-3-sonnet': ['claude-3-haiku'],
      'claude-3.5-sonnet': ['claude-3-haiku'],
    };

    return modelHierarchy[model]?.[0] ?? null;
  }
}