import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';
import { CostOptimizationAnalyzer } from './cost-optimization.js';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-metrics');
const costOptimizer = new CostOptimizationAnalyzer(infra);

app.get('/summary', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.readMetrics(tenantId);
});

// ── Cost Optimization Endpoints ────────────────────────────────────────────────

/**
 * GET /optimization/insights
 * Returns comprehensive cost optimization insights including:
 * - Idle resource detection
 * - Underutilized service identification
 * - Resource efficiency score
 * - Cost-saving recommendations
 */
app.get('/optimization/insights', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return costOptimizer.getOptimizationInsights(tenantId);
});

/**
 * GET /optimization/report
 * Returns a monthly optimization report with:
 * - Period summary
 * - Cost and execution trends
 * - Efficiency score breakdown
 * - Detailed recommendations
 */
app.get('/optimization/report', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return costOptimizer.getMonthlyReport(tenantId);
});

/**
 * GET /optimization/efficiency-score
 * Returns just the resource efficiency score
 */
app.get('/optimization/efficiency-score', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const insights = await costOptimizer.getOptimizationInsights(tenantId);
  return insights.efficiencyScore;
});

/**
 * GET /optimization/recommendations
 * Returns prioritized cost-saving recommendations
 */
app.get('/optimization/recommendations', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const insights = await costOptimizer.getOptimizationInsights(tenantId);
  return {
    recommendations: insights.recommendations,
    estimatedTotalMonthlySavings: insights.estimatedTotalMonthlySavings,
    generatedAt: insights.generatedAt,
  };
});

/**
 * GET /optimization/idle-resources
 * Returns detected idle resources
 */
app.get('/optimization/idle-resources', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const insights = await costOptimizer.getOptimizationInsights(tenantId);
  return {
    idleResources: insights.idleResources,
    totalIdleResources: insights.idleResources.length,
    estimatedMonthlyCost: insights.idleResources.reduce(
      (sum, r) => sum + r.estimatedMonthlyCost,
      0,
    ),
  };
});

/**
 * GET /optimization/underutilized
 * Returns underutilized services
 */
app.get('/optimization/underutilized', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const insights = await costOptimizer.getOptimizationInsights(tenantId);
  return {
    underutilizedServices: insights.underutilizedServices,
    totalUnderutilized: insights.underutilizedServices.length,
  };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
