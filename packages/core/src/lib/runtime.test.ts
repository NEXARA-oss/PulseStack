import { describe, expect, it } from 'vitest';
import type {
  EventEnvelope,
  WorkflowDefinition,
  ExecutionSnapshot,
  TraceSpan,
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

  it('rejects execution context from another tenant', async () => {
    const infra = new RuntimeInfraMock();
    const runtime = new WorkflowRuntime(infra as never);

    await expect(
      runtime.execute({
        workflow,
        input: {},
        initiatedBy: 'test',
        context: { tenantId: 'tenant_other' },
      }),
    ).rejects.toThrow('Execution context tenant does not match workflow tenant');
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
      usage: {
        totalTokens: 0,
        totalCost: 0,
      },
      retry: {
        maxAttempts: 3,
        exhausted: false,
        errors: ['Simulated failure for fetch_logs on attempt 1'],
      },
    });
    expect(harness.events.some((event) => event.type === 'step.retrying')).toBe(
      true,
    );
    expect(
      harness.events.find((event) => event.type === 'step.retrying')
        ?.executionContext,
    ).toMatchObject({
      executionId: result.executionId,
      workflowId: baseRequest.workflow.id,
      correlationId: baseRequest.workflow.correlationId,
      retryAttempt: 1,
    });
    expect(harness.snapshots.map((snapshot) => snapshot.sideEffects[0]?.type)).toEqual([
      'workflow.start',
      'retry.boundary',
      'tool',
      'workflow.completion',
    ]);
    expect(harness.snapshots.find((snapshot) => snapshot.sideEffects[0]?.type === 'retry.boundary')?.state).toMatchObject({
      __retry: {
        fetch_logs: {
          maxAttempts: 3,
          exhausted: false,
        },
      },
    });
    expect(harness.snapshots.find((snapshot) => snapshot.sideEffects[0]?.type === 'retry.boundary')?.sideEffects[0]?.response).toMatchObject({
      attempt: 1,
      maxAttempts: 3,
      stepId: 'fetch_logs',
    });
    expect(harness.completions.at(-1)?.status).toBe('completed');
    expect(harness.spans.at(-1)?.attributes).toMatchObject({
      attempts: 2,
      retryExhausted: false,
      retryAttempt: 2,
    });
    expect(harness.completions.at(-1)?.output.executionContext).toMatchObject({
      executionId: result.executionId,
      traceId: result.traceId,
    });
    expect(harness.completions.at(-1)?.output.usage).toMatchObject({
      totalTokens: 0,
      attribution: {
        tenantId: baseRequest.workflow.tenantId,
        workflowId: baseRequest.workflow.id,
        executionId: result.executionId,
      },
    });
  });

  it('attributes llm token usage and estimated cost to the execution', async () => {
    const harness = createRuntimeHarness();
    const request = {
      ...baseRequest,
      workflow: {
        ...baseRequest.workflow,
        steps: [
          {
            id: 'summarize',
            name: 'Summarize',
            kind: 'llm' as const,
            dependsOn: [],
            input: {
              model: 'generic-llm',
              prompt: 'summarize the incident',
              outputTokens: 50,
            },
          },
        ],
      },
    };

    const result = await harness.runtime.execute(request);

    expect(result.output.steps[0].usage).toMatchObject({
      inputTokens: 6,
      outputTokens: 50,
      totalTokens: 56,
      attribution: {
        tenantId: request.workflow.tenantId,
        workflowId: request.workflow.id,
        executionId: result.executionId,
        stepId: 'summarize',
        retryAttempt: 1,
        model: 'generic-llm',
      },
    });
    expect(result.output.usage).toMatchObject({
      inputTokens: 6,
      outputTokens: 50,
      totalTokens: 56,
    });
    expect(harness.spans.at(-1)?.attributes).toMatchObject({
      inputTokens: 6,
      outputTokens: 50,
      totalTokens: 56,
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

    expect(harness.snapshots.map((snapshot) => snapshot.sideEffects[0]?.type)).toEqual([
      'workflow.start',
      'retry.boundary',
      'workflow.completion',
    ]);
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
describe('WorkflowRuntime workflow.started event', () => {
  it('fires workflow.started exactly once before any step executes', async () => {
    const harness = createRuntimeHarness();

    await harness.runtime.execute({
      workflow: {
        id: 'wf_started_test',
        name: 'Started event test',
        version: '1.0.0',
        tenantId: 'tenant_test',
        correlationId: 'corr_test',
        metadata: {},
        steps: [
          { id: 'step1', name: 'Step 1', kind: 'trigger', dependsOn: [], input: {} },
          { id: 'step2', name: 'Step 2', kind: 'tool',    dependsOn: ['step1'], input: {} },
          { id: 'step3', name: 'Step 3', kind: 'llm',     dependsOn: ['step2'], input: {} },
        ],
      },
      input: {},
      initiatedBy: 'unit-test',
    });

    // workflow.started must fire exactly ONCE — not once per step
    const startedEvents = harness.events.filter(
      (event) => event.type === 'workflow.started',
    );
    expect(startedEvents).toHaveLength(1);
  });

  it('fires workflow.started before any step events', async () => {
    const harness = createRuntimeHarness();

    await harness.runtime.execute({
      workflow: {
        id: 'wf_order_test',
        name: 'Event order test',
        version: '1.0.0',
        tenantId: 'tenant_test',
        correlationId: 'corr_test',
        metadata: {},
        steps: [
          { id: 'step1', name: 'Step 1', kind: 'tool', dependsOn: [], input: {} },
          { id: 'step2', name: 'Step 2', kind: 'llm',  dependsOn: ['step1'], input: {} },
        ],
      },
      input: {},
      initiatedBy: 'unit-test',
    });

    const eventTypes = harness.events.map((event) => event.type);

    // workflow.started must be the first event in the stream
    expect(eventTypes[0]).toBe('workflow.started');

    // workflow.started must appear before tool.called and llm.requested
    const startedIndex  = eventTypes.indexOf('workflow.started');
    const toolIndex     = eventTypes.indexOf('tool.called');
    const llmIndex      = eventTypes.indexOf('llm.requested');

    expect(startedIndex).toBeLessThan(toolIndex);
    expect(startedIndex).toBeLessThan(llmIndex);
  });
});