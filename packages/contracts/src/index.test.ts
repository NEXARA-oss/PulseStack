import { describe, expect, it } from 'vitest';
import {
  eventEnvelopeSchema,
  executionContextSchema,
  snapshotInspectionSchema,
  usageMetadataSchema,
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

  it('validates optional usage metadata', () => {
    expect(() =>
      usageMetadataSchema.parse({
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
        inputCost: 0.000012,
        outputCost: 0.000068,
        totalCost: 0.00008,
        attribution: {
          tenantId: 'tenant',
          workflowId: 'wf_1',
          executionId: 'exec_1',
          stepId: 'llm',
          retryAttempt: 1,
          replaySessionId: 'replay_1',
          model: 'generic-llm',
        },
      }),
    ).not.toThrow();
  });

  it('rejects blank tenant identifiers', () => {
    expect(() =>
      executionContextSchema.parse({
        executionId: 'exec_1',
        workflowId: 'wf_1',
        tenantId: ' ',
        correlationId: 'corr',
        traceId: 'trace_1',
      }),
    ).toThrow();
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

  it('validates snapshot inspection responses', () => {
    expect(() =>
      snapshotInspectionSchema.parse({
        sequence: 1,
        timestamp: new Date().toISOString(),
        phase: 'retry.boundary',
        stepId: 'fetch_logs',
        stepKind: 'tool',
        retry: {
          boundary: true,
          attempt: 1,
          maxAttempts: 3,
          errors: ['temporary failure'],
        },
        traceId: 'trace_1',
        snapshot: {
          id: 'snap_1',
          executionId: 'exec_1',
          workflowId: 'wf_1',
          sequence: 1,
          state: { __retry: { fetch_logs: { maxAttempts: 3 } } },
          sideEffects: [
            {
              type: 'retry.boundary',
              key: 'fetch_logs',
              response: {},
            },
          ],
          createdAt: new Date().toISOString(),
        },
        diff: {
          added: [{ path: '__retry.fetch_logs' }],
          modified: [],
          removed: [],
        },
      }),
    ).not.toThrow();
  });
});
