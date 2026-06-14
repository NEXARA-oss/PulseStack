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
        output: {
          executionContext,
          result: 'ok',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15, totalCost: 0.001 },
        },
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
    expect(result.originalUsage).toMatchObject({ totalTokens: 15 });
    expect(result.replayUsage).toMatchObject({ totalTokens: 0 });
    expect(result.usageComparison).toMatchObject({ totalTokensDelta: -15 });
    expect(
      events.every(
        (event) =>
          event.executionContext?.replaySessionId === result.replaySessionId,
      ),
    ).toBe(true);
  });

  it('does not replay executions outside the requested tenant', async () => {
    const infra = {
      getExecution: async (_executionId: string, tenantId?: string) =>
        tenantId === 'tenant_other'
          ? null
          : {
              id: 'exec_original',
              workflow_id: 'wf_replay',
              tenant_id: 'tenant_replay',
              correlation_id: 'corr_replay',
              status: 'completed',
              input: {},
              output: { executionContext, result: 'ok' },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
      getSnapshots: async () => [],
      writeEvent: async () => undefined,
    } as unknown as PulseInfra;
    const replay = new ReplayEngine(infra, 'test-replay');

    await expect(
      replay.replayExecution('exec_original', 'tenant_other'),
    ).rejects.toThrow('Execution exec_original not found');
  });

  it('inspects snapshot state and diffs by sequence', async () => {
    const snapshots = [
      {
        id: 'snap_0',
        execution_id: 'exec_original',
        workflow_id: 'wf_replay',
        sequence: 0,
        state: { input: 'start' },
        side_effects: [
          {
            type: 'workflow.start',
            key: '__workflow',
            response: { phase: 'workflow.start', traceId: 'trace_original' },
          },
        ],
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'snap_1',
        execution_id: 'exec_original',
        workflow_id: 'wf_replay',
        sequence: 1,
        state: {
          input: 'changed',
          fetch: { status: 'ok' },
          __retry: { fetch: { maxAttempts: 2, exhausted: false } },
        },
        side_effects: [
          {
            type: 'tool',
            key: 'fetch',
            response: {
              phase: 'step.completed',
              stepId: 'fetch',
              stepKind: 'tool',
              attempt: 2,
              traceId: 'trace_original',
              spanId: 'span_fetch',
            },
          },
        ],
        created_at: '2026-01-01T00:00:01.000Z',
      },
    ];
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
      getSnapshots: async () => snapshots,
    } as unknown as PulseInfra;
    const replay = new ReplayEngine(infra, 'test-replay');

    const inspection = await replay.inspectSnapshot('exec_original', 1);

    expect(inspection).toMatchObject({
      sequence: 1,
      phase: 'step.completed',
      stepId: 'fetch',
      stepKind: 'tool',
      traceId: 'trace_original',
      spanId: 'span_fetch',
    });
    expect(await replay.getStateAtStep('exec_original', 1)).toMatchObject({
      fetch: { status: 'ok' },
    });
    expect(await replay.getDiffFromPreviousStep('exec_original', 1)).toEqual({
      added: [
        {
          path: '__retry',
          after: { fetch: { maxAttempts: 2, exhausted: false } },
        },
        { path: 'fetch', after: { status: 'ok' } },
      ],
      modified: [{ path: 'input', before: 'start', after: 'changed' }],
      removed: [],
    });
  });
});
