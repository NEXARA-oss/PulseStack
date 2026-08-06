import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { SloComplianceEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-slo');

// Initialize SLO compliance engine
const engine = new SloComplianceEngine();

/**
 * GET /slo/summary
 * Returns overall SLO compliance summary.
 */
app.get('/slo/summary', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return engine.getSummary();
});

/**
 * GET /slo/targets
 * Returns all configured SLO targets.
 */
app.get('/slo/targets', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const service = url.searchParams.get('service') ?? '';
  if (service) return engine.getTargetsByService(service);
  return engine.getTargets();
});

/**
 * POST /slo/targets
 * Create or update an SLO target.
 */
app.post('/slo/targets', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const body = request.body;
  if (!body) return { error: 'No target data provided' };
  return engine.upsertTarget(body);
});

/**
 * DELETE /slo/targets/:id
 * Delete an SLO target.
 */
app.delete('/slo/targets/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const id = request.params?.id;
  if (!id) return { error: 'No target ID provided' };
  const deleted = engine.deleteTarget(id);
  return { deleted };
});

/**
 * GET /slo/compliance
 * Returns current compliance status for all targets.
 */
app.get('/slo/compliance', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const service = url.searchParams.get('service') ?? '';
  if (service) return engine.getComplianceByService(service);
  return engine.getCompliance();
});

/**
 * GET /slo/report
 * Returns monthly compliance report.
 */
app.get('/slo/report', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const month = parseInt(url.searchParams.get('month') ?? '-1', 10);
  const year = parseInt(url.searchParams.get('year') ?? '-1', 10);
  return engine.getMonthlyReport(month >= 0 ? month : undefined, year >= 0 ? year : undefined);
});

/**
 * GET /slo/violations
 * Returns SLO violation history.
 */
app.get('/slo/violations', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const days = parseInt(url.searchParams.get('days') ?? '30', 10);
  return engine.getViolationHistory(days);
});

/**
 * GET /slo/services
 * Returns available services.
 */
app.get('/slo/services', async () => {
  return engine.getServices();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });