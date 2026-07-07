import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';
import { CostOptimizationAnalyzer } from './cost-optimization.js';
import { IncidentAnalyzer } from './incident-dashboard.js';
import { ServiceHealthAnalyzer } from './service-health.js';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-metrics');
const costOptimizer = new CostOptimizationAnalyzer(infra);
const incidentAnalyzer = new IncidentAnalyzer(infra);
const healthAnalyzer = new ServiceHealthAnalyzer(infra);

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

// ── Incident Dashboard Endpoints ──────────────────────────────────────────────

/**
 * GET /incidents/dashboard
 * Returns incident dashboard with active/recent incidents, trends, and stats
 */
app.get('/incidents/dashboard', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return incidentAnalyzer.getDashboard(tenantId);
});

/**
 * GET /incidents/:id
 * Returns full incident detail including timeline, failures, alerts, recoveries
 */
app.get('/incidents/:id', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { id } = request.params as { id: string };
  const incident = await incidentAnalyzer.getIncident(id, tenantId);
  if (!incident) {
    return { error: 'Incident not found' };
  }
  return incident;
});

/**
 * GET /incidents/:id/timeline
 * Returns chronological incident timeline
 */
app.get('/incidents/:id/timeline', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { id } = request.params as { id: string };
  const incident = await incidentAnalyzer.getIncident(id, tenantId);
  if (!incident) {
    return { error: 'Incident not found' };
  }
  return { timeline: incident.timeline, total: incident.timeline.length };
});

/**
 * GET /incidents/:id/failures
 * Returns service failures for an incident
 */
app.get('/incidents/:id/failures', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { id } = request.params as { id: string };
  const incident = await incidentAnalyzer.getIncident(id, tenantId);
  if (!incident) {
    return { error: 'Incident not found' };
  }
  return {
    failures: incident.failures,
    totalFailures: incident.failureCount,
    affectedServices: incident.affectedServices,
  };
});

/**
 * GET /incidents/:id/export
 * Exports incident report as structured data
 */
app.get('/incidents/:id/export', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { id } = request.params as { id: string };
  const report = await incidentAnalyzer.exportIncidentReport(id, tenantId);
  if (!report) {
    return { error: 'Incident not found' };
  }
  return report;
});

/**
 * POST /incidents/:id/root-cause
 * Add a root cause note to an incident
 */
app.post('/incidents/:id/root-cause', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { id } = request.params as { id: string };
  const note = await incidentAnalyzer.addRootCauseNote(id, request.body as any);
  return note;
});

// ── Service Health Dashboard Endpoints ─────────────────────────────────────────

/**
 * GET /health/dashboard
 * Returns full service health dashboard with all service status cards
 */
app.get('/health/dashboard', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return healthAnalyzer.getDashboard(tenantId);
});

/**
 * GET /health/snapshot
 * Returns lightweight health snapshot for auto-refresh monitoring
 */
app.get('/health/snapshot', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return healthAnalyzer.getSnapshot(tenantId);
});

/**
 * GET /health/services/:serviceId
 * Returns individual service health card
 */
app.get('/health/services/:serviceId', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { serviceId } = request.params as { serviceId: string };
  const card = await healthAnalyzer.getServiceHealth(serviceId, tenantId);
  if (!card) {
    return { error: 'Service not found' };
  }
  return card;
});

/**
 * GET /health/search
 * Search services by name query parameter: ?q=<search-term>
 */
app.get('/health/search', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const query = (request.query as { q?: string })?.q ?? '';
  return healthAnalyzer.searchServices(query, tenantId);
});

/**
 * GET /health/filter/:status
 * Filter services by health status (healthy, degraded, unhealthy, down, all)
 */
app.get('/health/filter/:status', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const { status } = request.params as { status: string };
  return healthAnalyzer.filterByStatus(status as any, tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
