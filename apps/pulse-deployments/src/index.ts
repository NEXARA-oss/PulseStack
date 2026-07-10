import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { DeploymentEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-deployments');
const engine = new DeploymentEngine();

app.get('/deployments', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const service = url.searchParams.get('service') ?? '';
  const environment = url.searchParams.get('environment') ?? '';
  return engine.getDeployments(service || undefined, environment || undefined);
});

app.get('/deployments/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No deployment ID provided' };
  return engine.getDeployment(id) ?? { error: 'Deployment not found' };
});

app.get('/deployments/:id/events', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No deployment ID provided' };
  return engine.getEvents(id);
});

app.get('/deployments/:id/metrics', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const window = parseInt(url.searchParams.get('window') ?? '24', 10);
  if (!id) return { error: 'No deployment ID provided' };
  return engine.getMetrics(id, window);
});

app.get('/deployments/:id/impact', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No deployment ID provided' };
  return engine.analyzeImpact(id);
});

app.get('/deployments/summary', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getSummary();
});

app.get('/deployments/services', async () => {
  return engine.getServices();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
