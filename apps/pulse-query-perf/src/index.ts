import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { QueryPerformanceEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-query-perf');
const engine = new QueryPerformanceEngine();

app.get('/queries/performance', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  return engine.getQueries(limit);
});

app.get('/queries/slow', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getSlowQueries();
});

app.get('/queries/history', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const endpoint = url.searchParams.get('endpoint') ?? '';
  return engine.getQueryHistory(endpoint || undefined);
});

app.get('/queries/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No query ID provided' };
  return engine.getQuery(id) ?? { error: 'Query not found' };
});

app.get('/queries/:id/hints', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No query ID provided' };
  return engine.getHints(id);
});

app.get('/queries/stats', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getStats();
});

app.get('/queries/compare', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const a = url.searchParams.get('a') ?? '';
  const b = url.searchParams.get('b') ?? '';
  if (!a || !b) return { error: 'Both query IDs are required' };
  return engine.compareQueries(a, b) ?? { error: 'Comparison failed' };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
