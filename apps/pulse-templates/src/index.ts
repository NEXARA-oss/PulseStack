import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { TemplateMarketplaceEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-templates');
const engine = new TemplateMarketplaceEngine();

app.get('/templates', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const category = url.searchParams.get('category') ?? '';
  const team = url.searchParams.get('team') ?? '';
  return engine.getTemplates(category || undefined, team || undefined);
});

app.get('/templates/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No template ID provided' };
  return engine.getTemplate(id) ?? { error: 'Template not found' };
});

app.post('/templates', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const body = request.body;
  if (!body) return { error: 'No template data provided' };
  return engine.createTemplate(body);
});

app.post('/templates/:id/favorite', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No template ID provided' };
  return engine.toggleFavorite(id);
});

app.post('/templates/:id/share', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const body = request.body;
  if (!id) return { error: 'No template ID provided' };
  if (!body?.team) return { error: 'No team provided' };
  return engine.shareTemplate(id, body.team);
});

app.post('/templates/:id/download', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No template ID provided' };
  engine.incrementDownloads(id);
  return engine.getTemplate(id);
});

app.get('/templates/categories', async () => {
  return engine.getCategories();
});

app.get('/templates/teams', async () => {
  return engine.getTeams();
});

app.get('/templates/favorites/count', async () => {
  return { count: engine.getFavoriteCount() };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
