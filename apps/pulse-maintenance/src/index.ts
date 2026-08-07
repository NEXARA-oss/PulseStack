import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { MaintenanceSchedulerEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-maintenance');
const engine = new MaintenanceSchedulerEngine();

app.get('/maintenance/windows', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const service = url.searchParams.get('service') ?? '';
  const active = url.searchParams.get('active') === 'true';
  return engine.getWindows(service || undefined, active);
});

app.get('/maintenance/windows/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No window ID provided' };
  return engine.getWindow(id) ?? { error: 'Window not found' };
});

app.post('/maintenance/windows', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const body = request.body;
  if (!body) return { error: 'No window data provided' };
  return engine.createWindow(body);
});

app.put('/maintenance/windows/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const body = request.body;
  if (!id) return { error: 'No window ID provided' };
  return engine.updateWindow(id, body) ?? { error: 'Window not found' };
});

app.delete('/maintenance/windows/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No window ID provided' };
  return { deleted: engine.deleteWindow(id) };
});

app.get('/maintenance/history', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const windowId = url.searchParams.get('windowId') ?? '';
  return engine.getHistory(windowId || undefined);
});

app.get('/maintenance/indicator/:service', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const service = request.params?.service;
  if (!service) return { error: 'No service provided' };
  return engine.getCurrentIndicator(service);
});

app.get('/maintenance/services', async () => {
  return engine.getServices();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
