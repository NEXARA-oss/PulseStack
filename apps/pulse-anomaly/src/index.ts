import { createBaseServer, loadEnv, tenantIdFromHeaders, PulseInfra } from '@pulsestack/core';
import { AnomalyDetectionEngine, generateMockMetrics } from './engine.js';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-anomaly');

// Initialize anomaly detection engine
const engine = new AnomalyDetectionEngine({
  zScoreThreshold: 3.0,
  iqrMultiplier: 1.5,
  minSamples: 10,
  windowSize: 3600000,
  trendWindowSize: 300000,
  volatilityThreshold: 0.5,
  sustainedThreshold: 3,
});

// Seed with mock data for demonstration
const mockMetrics = generateMockMetrics(200);
engine.ingestBatch(mockMetrics);

// Periodically inject new mock data and prune old history
setInterval(() => {
  const newSamples = generateMockMetrics(5);
  engine.ingestBatch(newSamples);
  engine.prune(86400000); // prune data older than 24h
}, 30000);

/**
 * GET /anomaly/summary
 * Returns overall anomaly summary with health score and active alerts.
 */
app.get('/anomaly/summary', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return engine.getSummary();
});

/**
 * GET /anomaly/alerts
 * Returns active high/critical severity alerts.
 */
app.get('/anomaly/alerts', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return engine.getActiveAlerts();
});

/**
 * GET /anomaly/history
 * Returns all anomalies with optional time window filter.
 */
app.get('/anomaly/history', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const windowMs = parseInt(url.searchParams.get('window') ?? '3600000', 10);
  return engine.getRecentAnomalies(windowMs);
});

/**
 * POST /anomaly/ingest
 * Ingest metric samples for real-time detection.
 */
app.post('/anomaly/ingest', async (request: any) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const body = request.body;
  if (!body) return { error: 'No data provided' };

  const samples = Array.isArray(body) ? body : [body];
  const results = engine.ingestBatch(samples);
  return {
    ingested: samples.length,
    anomaliesDetected: results.length,
    anomalies: results,
  };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });