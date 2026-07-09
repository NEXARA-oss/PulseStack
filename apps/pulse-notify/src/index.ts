import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { NotificationEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-notify');

const engine = new NotificationEngine();

/**
 * GET /notify/channels
 * Returns all notification channels.
 */
app.get('/notify/channels', async () => {
  return engine.getChannels();
});

/**
 * GET /notify/channels/:id
 * Returns a single channel.
 */
app.get('/notify/channels/:id', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No channel ID provided' };
  const channel = engine.getChannel(id);
  if (!channel) return { error: 'Channel not found' };
  return channel;
});

/**
 * POST /notify/channels
 * Create a new notification channel.
 */
app.post('/notify/channels', async (request: any) => {
  const body = request.body;
  if (!body) return { error: 'No channel data provided' };
  return engine.addChannel(body);
});

/**
 * PUT /notify/channels/:id
 * Update an existing channel.
 */
app.put('/notify/channels/:id', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No channel ID provided' };
  const updated = engine.updateChannel(id, request.body ?? {});
  if (!updated) return { error: 'Channel not found' };
  return updated;
});

/**
 * DELETE /notify/channels/:id
 * Delete a channel.
 */
app.delete('/notify/channels/:id', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No channel ID provided' };
  const deleted = engine.deleteChannel(id);
  return { deleted };
});

/**
 * POST /notify/channels/:id/toggle
 * Toggle channel enabled/disabled.
 */
app.post('/notify/channels/:id/toggle', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No channel ID provided' };
  const result = engine.toggleChannel(id);
  if (!result) return { error: 'Channel not found' };
  return result;
});

/**
 * POST /notify/channels/:id/test
 * Send a test notification to a channel.
 */
app.post('/notify/channels/:id/test', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No channel ID provided' };
  return engine.dispatchTest(id);
});

/**
 * GET /notify/rules
 * Returns all notification rules.
 */
app.get('/notify/rules', async () => {
  return engine.getRules();
});

/**
 * POST /notify/rules
 * Create a new notification rule.
 */
app.post('/notify/rules', async (request: any) => {
  const body = request.body;
  if (!body) return { error: 'No rule data provided' };
  return engine.addRule(body);
});

/**
 * PUT /notify/rules/:id
 * Update a rule.
 */
app.put('/notify/rules/:id', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No rule ID provided' };
  const updated = engine.updateRule(id, request.body ?? {});
  if (!updated) return { error: 'Rule not found' };
  return updated;
});

/**
 * DELETE /notify/rules/:id
 * Delete a rule.
 */
app.delete('/notify/rules/:id', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No rule ID provided' };
  const deleted = engine.deleteRule(id);
  return { deleted };
});

/**
 * POST /notify/rules/:id/toggle
 * Toggle rule enabled/disabled.
 */
app.post('/notify/rules/:id/toggle', async (request: any) => {
  const id = request.params?.id;
  if (!id) return { error: 'No rule ID provided' };
  const result = engine.toggleRule(id);
  if (!result) return { error: 'Rule not found' };
  return result;
});

/**
 * POST /notify/dispatch
 * Dispatch a notification event through the engine.
 */
app.post('/notify/dispatch', async (request: any) => {
  const body = request.body;
  if (!body) return { error: 'No event data provided' };
  return engine.dispatch(body);
});

/**
 * GET /notify/stats
 * Returns notification system statistics.
 */
app.get('/notify/stats', async () => {
  return engine.getStats();
});

/**
 * GET /notify/channel-types
 * Returns channel type metadata.
 */
app.get('/notify/channel-types', async () => {
  return engine.getChannelTypeMeta();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });