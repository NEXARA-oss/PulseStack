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

app.get('/executions/:executionId/snapshots', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return replay.getSnapshotTimeline((request.params as { executionId: string }).executionId, tenantId);
});

app.get('/executions/:executionId/snapshots/:sequence', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const params = request.params as { executionId: string; sequence: string };
  return replay.inspectSnapshot(params.executionId, parseInt(params.sequence, 10), tenantId);
});

app.get('/executions/:executionId/snapshots/:sequence/state', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const params = request.params as { executionId: string; sequence: string };
  return replay.getStateAtStep(params.executionId, parseInt(params.sequence, 10), tenantId);
});

app.get('/executions/:executionId/snapshots/:sequence/diff', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const params = request.params as { executionId: string; sequence: string };
  return replay.getDiffFromPreviousStep(params.executionId, parseInt(params.sequence, 10), tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
