import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-metrics');

app.get('/summary', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.readMetrics(tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
