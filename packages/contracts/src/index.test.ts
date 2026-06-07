import { describe, expect, it } from 'vitest';
import {
  eventEnvelopeSchema,
  executionContextSchema,
  workflowStepSchema,
} from './index.js';

describe('contracts', () => {
  it('validates event envelopes', () => {
    expect(() =>
      eventEnvelopeSchema.parse({
        id: 'evt_1',
        version: 1,
        type: 'workflow.started',
        source: 'test',
        tenantId: 'tenant',
        correlationId: 'corr',
        timestamp: new Date().toISOString(),
        payload: {},
        tags: {},
      }),
    ).not.toThrow();
  });

  it('validates shared execution context lineage', () => {
    expect(() =>
      executionContextSchema.parse({
        executionId: 'exec_1',
        workflowId: 'wf_1',
        tenantId: 'tenant',
        correlationId: 'corr',
        traceId: 'trace_1',
        parentSpanId: 'span_0',
        retryAttempt: 2,
        replaySessionId: 'replay_1',
      }),
    ).not.toThrow();
  });

  it('validates bounded retry policies on workflow steps', () => {
    const step = workflowStepSchema.parse({
      id: 'fetch_logs',
      name: 'Fetch logs',
      kind: 'tool',
      retry: {
        maxAttempts: 3,
        backoffMs: 25,
        exponential: true,
      },
    });

    expect(step.retry).toMatchObject({
      maxAttempts: 3,
      backoffMs: 25,
      maxBackoffMs: 30_000,
      exponential: true,
    });
    expect(() =>
      workflowStepSchema.parse({
        id: 'loop_forever',
        name: 'Loop forever',
        kind: 'tool',
        retry: { maxAttempts: 0 },
      }),
    ).toThrow();
  });
});
