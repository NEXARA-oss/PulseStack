import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-graph');

app.get('/executions/:executionId/dag', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const executionId = (request.params as { executionId: string }).executionId;
  const execution = await infra.getExecution(executionId, tenantId);
  if (!execution) return reply.code(404).send({ message: 'Execution not found' });

  const workflow = await infra.pg.query('select definition from workflows where id = $1 and tenant_id = $2', [execution.workflow_id, tenantId]);
  const definition = workflow.rows[0]?.definition;
  if (!definition) return reply.code(404).send({ message: 'Workflow not found' });

  return {
    nodes: definition.steps.map((step: any) => ({ id: step.id, data: { label: step.name, kind: step.kind } })),
    edges: definition.steps.flatMap((step: any) =>
      (step.dependsOn ?? []).map((dep: string) => ({
        id: `${dep}-${step.id}`,
        source: dep,
        target: step.id,
      })),
    ),
  };
});

// Service Dependency Topology API
app.get('/services/topology', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.readServiceTopology(tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });