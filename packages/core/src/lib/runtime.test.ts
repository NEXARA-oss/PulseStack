
import { describe, expect, it } from 'vitest';
import type {
  EventEnvelope,
  ExecutionSnapshot,
  TraceSpan,
  WorkflowDefinition,
} from '@pulsestack/contracts';
import type { PulseInfra } from './infra.js';
import { WorkflowRuntime } from './runtime.js';

class RuntimeInfraMock {
  events: EventEnvelope[] = [];

  async persistWorkflow() {}
  async createExecution() {}
  async completeExecution() {}
  async writeSnapshot() {}
  async writeSpan() {}

  async writeEvent(event: EventEnvelope) {
    this.events.push(event);
  }
}

const workflow: WorkflowDefinition = {
  id: 'wf_tenant',
  name: 'Tenant workflow',
  version: '1.0.0',
  tenantId: 'tenant_prod',
  correlationId: 'corr_prod',
  metadata: {},
  steps: [
    { id: 'start', name: 'Start', kind: 'trigger', dependsOn: [], input: {} },
    { id: 'tool', name: 'Tool', kind: 'tool', dependsOn: ['start'], input: {} },
    { id: 'llm', name: 'LLM', kind: 'llm', dependsOn: ['tool'], input: {} },
  ],
};

describe('WorkflowRuntime', () => {
  it('uses the workflow tenant for emitted runtime events', async () => {
    const infra = new RuntimeInfraMock();
    const runtime = new WorkflowRuntime(infra as never);

    await runtime.execute({ workflow, input: {}, initiatedBy: 'test' });

    const tenantEvents = infra.events.filter((event) =>
      ['workflow.started', 'tool.called', 'llm.requested', 'span.recorded', 'workflow.completed'].includes(event.type),
    );
    expect(tenantEvents.length).toBeGreaterThan(0);
    expect(tenantEvents.every((event) => event.tenantId === workflow.tenantId)).toBe(true);
  });
});

function createRuntimeHarness() {
  const events: EventEnvelope[] = [];
  const snapshots: ExecutionSnapshot[] = [];
  const spans: TraceSpan[] = [];
  const completions: Array<{
    executionId: string;
    status: string;
    output: Record<string, unknown>;
  }> = [];
  const infra = {
    persistWorkflow: async () => undefined,
    createExecution: async () => undefined,
    completeExecution: async (
      executionId: string,
      status: string,
      output: Record<string, unknown>,
    ) => {
      completions.push({ executionId, status, output });
    },
    writeEvent: async (event: EventEnvelope) => {
      events.push(event);
    },
    writeSnapshot: async (snapshot: ExecutionSnapshot) => {
      snapshots.push(snapshot);
    },
    writeSpan: async (span: TraceSpan) => {
      spans.push(span);
    },
  } as unknown as PulseInfra;

  return {
    runtime: new WorkflowRuntime(infra, 'test-runtime', {
      sleep: async () => undefined,
    }),
    events,
    snapshots,
    spans,
    completions,
  };
}

const baseRequest = {
  workflow: {
    id: 'wf_retry',
    name: 'Retry workflow',
    version: '1.0.0',
    tenantId: 'tenant_a',
    correlationId: 'corr_retry',
    metadata: {},
    steps: [
      {
        id: 'fetch_logs',
        name: 'Fetch logs',
        kind: 'tool' as const,
        dependsOn: [],
        input: {
          failAttempts: 1,
        },
        retry: {
          maxAttempts: 3,
          backoffMs: 5,
          maxBackoffMs: 50,
          exponential: true,
        },
      },
    ],
  },
  input: { incidentId: 'inc_1' },
  initiatedBy: 'unit-test',
};

describe('WorkflowRuntime retry handling', () => {
  it('retries failed steps and persists retry metadata when a later attempt succeeds', async () => {
    const harness = createRuntimeHarness();

    const result = await harness.runtime.execute(baseRequest);

    expect(result.output.steps).toHaveLength(1);
    expect(result.output.steps[0]).toMatchObject({
      stepId: 'fetch_logs',
      attempts: 2,
      retry: {
        maxAttempts: 3,
        exhausted: false,
        errors: ['Simulated failure for fetch_logs on attempt 1'],
      },
    });
    expect(harness.events.some((event) => event.type === 'step.retrying')).toBe(
      true,
    );
    expect(harness.snapshots[0].state).toMatchObject({
      __retry: {
        fetch_logs: {
          maxAttempts: 3,
          exhausted: false,
        },
      },
    });
    expect(harness.completions.at(-1)?.status).toBe('completed');
    expect(harness.spans.at(-1)?.attributes).toMatchObject({
      attempts: 2,
      retryExhausted: false,
    });
  });

  it('marks the workflow failed when retry attempts are exhausted', async () => {
    const harness = createRuntimeHarness();
    const request = {
      ...baseRequest,
      workflow: {
        ...baseRequest.workflow,
        steps: [
          {
            ...baseRequest.workflow.steps[0],
            input: { failAttempts: 2 },
            retry: {
              maxAttempts: 2,
              backoffMs: 0,
              maxBackoffMs: 0,
              exponential: true,
            },
          },
        ],
      },
    };

    await expect(harness.runtime.execute(request)).rejects.toThrow(
      'Step fetch_logs failed after 2 attempts',
    );

    expect(harness.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'workflow.started',
        'step.retrying',
        'step.failed',
        'workflow.failed',
      ]),
    );
    expect(harness.completions.at(-1)).toMatchObject({
      status: 'failed',
      output: {
        error:
          'Step fetch_logs failed after 2 attempts: Simulated failure for fetch_logs on attempt 2',
      },
    });

  });
});
