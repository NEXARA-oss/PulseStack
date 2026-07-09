import { createBaseServer, loadEnv } from '@pulsestack/core';
import { ApiAnalyticsEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-api-analytics');

const engine = new ApiAnalyticsEngine();

/**
 * GET /api-analytics/summary
 * Returns aggregate API performance summary.
 */
app.get('/api-analytics/summary', async () => {
  return engine.getSummary();
});

/**
 * GET /api-analytics/endpoints
 * Returns all tracked endpoints with their stats.
 */
app.get('/api-analytics/endpoints', async () => {
  return engine.getAllEndpointStats();
});

/**
 * GET /api-analytics/endpoints/:path
 * Returns stats for a specific endpoint.
 */
app.get('/api-analytics/endpoints/:path', async (request: any) => {
  const path = request.params?.path;
  if (!path) return { error: 'No endpoint path provided' };
  const method = (request.query?.method as string) ?? 'GET';
  return engine.getEndpointStats('/' + path, method as any);
});

/**
 * GET /api-analytics/slowest
 * Returns the slowest endpoints.
 */
app.get('/api-analytics/slowest', async (request: any) => {
  const limit = parseInt((request.query?.limit as string) ?? '10', 10);
  return engine.getSlowestEndpoints(limit);
});

/**
 * GET /api-analytics/worst-errors
 * Returns endpoints with highest error rates.
 */
app.get('/api-analytics/worst-errors', async (request: any) => {
  const limit = parseInt((request.query?.limit as string) ?? '10', 10);
  return engine.getWorstErrorEndpoints(limit);
});

/**
 * GET /api-analytics/timeseries
 * Returns time-series data for response time trends.
 */
app.get('/api-analytics/timeseries', async (request: any) => {
  const hours = parseInt((request.query?.hours as string) ?? '24', 10);
  const bucketMinutes = parseInt((request.query?.bucketMinutes as string) ?? '5', 10);
  return engine.getTimeSeries(hours, bucketMinutes);
});

/**
 * GET /api-analytics/trend
 * Returns overall API health trend direction.
 */
app.get('/api-analytics/trend', async () => {
  return { trend: engine.getTrend() };
});

/**
 * POST /api-analytics/record
 * Record one or more API request metrics.
 */
app.post('/api-analytics/record', async (request: any) => {
  const body = request.body;
  if (!body) return { error: 'No data provided' };
  if (Array.isArray(body)) {
    engine.recordBatch(body);
    return { recorded: body.length };
  }
  engine.recordRequest(body);
  return { recorded: 1 };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });