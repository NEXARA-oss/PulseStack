import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { CorrelationEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-correlate');
const engine = new CorrelationEngine();

app.get('/correlate/series', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const metric = url.searchParams.get('metric') ?? '';
  const source = url.searchParams.get('source') ?? '';
  return engine.getSeries(metric || undefined, source || undefined);
});

app.get('/correlate/metrics', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getMetrics();
});

app.get('/correlate/sources', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getSources();
});

app.get('/correlate/compute', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const metricA = url.searchParams.get('metricA') ?? 'cpu';
  const metricB = url.searchParams.get('metricB') ?? 'memory';
  const source = url.searchParams.get('source') ?? '';
  return engine.computeCorrelation(metricA, metricB, source || undefined);
});

app.get('/correlate/matrix', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const metric = url.searchParams.get('metric') ?? 'cpu';
  const source = url.searchParams.get('source') ?? '';
  return engine.computeAllCorrelations(metric, source || undefined);
});

app.get('/correlate/views', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getViews();
});

app.post('/correlate/views', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const body = request.body;
  if (!body) return { error: 'No view data provided' };
  return engine.saveView(body);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
