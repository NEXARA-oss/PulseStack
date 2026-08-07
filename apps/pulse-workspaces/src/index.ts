import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { WorkspaceEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-workspaces');
const engine = new WorkspaceEngine();

app.get('/workspaces', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getWorkspaces();
});

app.get('/workspaces/:id', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No workspace ID provided' };
  return engine.getWorkspace(id) ?? { error: 'Workspace not found' };
});

app.post('/workspaces', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const body = request.body;
  if (!body) return { error: 'No workspace data provided' };
  return engine.createWorkspace(body.name, body.description, body.ownerId);
});

app.post('/workspaces/:id/members', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const body = request.body;
  if (!id) return { error: 'No workspace ID provided' };
  if (!body) return { error: 'No member data provided' };
  return engine.addMember(id, body);
});

app.put('/workspaces/:id/members/:userId', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const workspaceId = request.params?.id;
  const userId = request.params?.userId;
  const body = request.body;
  if (!workspaceId || !userId) return { error: 'Invalid parameters' };
  if (!body?.role) return { error: 'No role provided' };
  return engine.updateMemberRole(workspaceId, userId, body.role) ?? { error: 'Member not found' };
});

app.delete('/workspaces/:id/members/:userId', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const workspaceId = request.params?.id;
  const userId = request.params?.userId;
  if (!workspaceId || !userId) return { error: 'Invalid parameters' };
  return { deleted: engine.removeMember(workspaceId, userId) };
});

app.post('/workspaces/:id/transfer', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  const body = request.body;
  if (!id) return { error: 'No workspace ID provided' };
  if (!body?.fromUserId || !body?.toUserId) return { error: 'Invalid transfer parameters' };
  return engine.transferOwnership(id, body.fromUserId, body.toUserId) ?? { error: 'Transfer failed' };
});

app.get('/workspaces/:id/activity', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const id = request.params?.id;
  if (!id) return { error: 'No workspace ID provided' };
  return engine.getHistory(id);
});

app.get('/workspaces/permissions/:role', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const role = request.params?.role;
  if (!role) return { error: 'No role provided' };
  return engine.getPermissions(role as any);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
