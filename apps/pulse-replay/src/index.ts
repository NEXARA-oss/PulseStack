import { createBaseServer, loadEnv, PulseInfra, ReplayEngine, tenantIdFromHeaders } from '@pulsestack/core';

const env = loadEnv();
const infra = new PulseInfra();
const replay = new ReplayEngine(infra);
const app = await createBaseServer('pulse-replay');

app.post('/executions/:executionId/replay', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return replay.replayExecution((request.params as { executionId: string }).executionId, tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
