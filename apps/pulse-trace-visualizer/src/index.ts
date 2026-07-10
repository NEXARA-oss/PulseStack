import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { TraceVisualizationEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-trace-visualizer');
const engine = new TraceVisualizationEngine();

app.get('/traces/:traceId', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const traceId = request.params?.traceId;
  if (!traceId) return { error: 'No trace ID provided' };
  return engine.getTrace(traceId);
});

app.get('/traces/:traceId/tree', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const traceId = request.params?.traceId;
  if (!traceId) return { error: 'No trace ID provided' };
  return engine.getTraceTree(traceId);
});

app.get('/traces/search', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const service = url.searchParams.get('service') ?? '';
  const minDurationMs = url.searchParams.get('minDurationMs') ? parseInt(url.searchParams.get('minDurationMs')!, 10) : undefined;
  return engine.searchTraces(service || undefined, minDurationMs);
});

app.get('/traces/latency', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getServiceLatency();
});

app.get('/traces/services', async () => {
  return engine.getServices();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
