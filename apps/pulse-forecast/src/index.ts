import { createBaseServer, loadEnv, tenantIdFromHeaders } from '@pulsestack/core';
import { CapacityForecastEngine } from './engine.js';

const env = loadEnv();
const app = await createBaseServer('pulse-forecast');
const engine = new CapacityForecastEngine();

app.get('/forecast', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getForecast();
});

app.get('/forecast/warnings', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  return engine.getWarnings();
});

app.get('/forecast/disk', async (request: any) => {
  const tenantId = tenantIdFromHeaders(request.headers as Record<string, string | string[] | undefined>, env.TENANT_ID);
  const forecast = engine.getForecast();
  return forecast.disk;
});

app.get('/forecast/services', async () => {
  return engine.getServices();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
