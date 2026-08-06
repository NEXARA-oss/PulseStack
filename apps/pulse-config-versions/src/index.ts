import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { ConfigVersionEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-config-versions');
const engine = new ConfigVersionEngine();

app.get('/config/versions', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getVersions();
});

app.get('/config/versions/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No version ID provided' };
  return engine.getVersion(id) ?? { error: 'Version not found' };
});

app.get('/config/versions/:id/diff', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const other = url.searchParams.get('other') ?? '';
  if (!id || !other) return { error: 'Both version IDs are required' };
  return engine.compareVersions(id, other) ?? { error: 'Comparison failed' };
});

app.post('/config/versions', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const body = request.body;
  if (!body) return { error: 'No version data provided' };
  return engine.createVersion(body);
});

app.post('/config/versions/:id/restore', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No version ID provided' };
  return engine.restoreVersion(id) ?? { error: 'Version not found' };
});

app.get('/config/history', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getHistory();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
