import { describe, expect, it } from 'vitest';
import type { EventEnvelope, ExecutionContext } from '@pulsestack/contracts';
import type { PulseInfra } from './infra.js';
import { ReplayEngine } from './replay.js';

const executionContext: ExecutionContext = {
  executionId: 'exec_original',
  workflowId: 'wf_replay',
  tenantId: 'tenant_replay',
  correlationId: 'corr_replay',
  traceId: 'trace_original',
};

describe('ReplayEngine lineage', () => {
  it('links replay events to the original execution context', async () => {
    const events: EventEnvelope[] = [];
    const infra = {
      getExecution: async () => ({
        id: 'exec_original',
        workflow_id: 'wf_replay',
        tenant_id: 'tenant_replay',
        correlation_id: 'corr_replay',
        status: 'completed',
        input: {},
        output: { executionContext, result: 'ok' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      getSnapshots: async () => [],
      writeEvent: async (event: EventEnvelope) => {
        events.push(event);
      },
    } as unknown as PulseInfra;
    const replay = new ReplayEngine(infra, 'test-replay');

    const result = await replay.replayExecution('exec_original');

    expect(result.executionContext).toMatchObject({
      executionId: 'exec_original',
      traceId: 'trace_original',
      replaySessionId: result.replaySessionId,
    });
    expect(events.map((event) => event.type)).toEqual([
      'replay.started',
      'replay.completed',
    ]);
    expect(
      events.every(
        (event) =>
          event.executionContext?.replaySessionId === result.replaySessionId,
      ),
    ).toBe(true);
  });
});
