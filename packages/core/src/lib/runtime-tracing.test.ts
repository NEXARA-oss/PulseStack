import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-node';
import type {
  EventEnvelope,
  ExecutionSnapshot,
  TraceSpan,
  WorkflowDefinition,
} from '@pulsestack/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from './config.js';
import type { PulseInfra } from './infra.js';
import { WorkflowRuntime } from './runtime.js';
import { initializeTracing } from './tracing.js';

const spanExporter = new InMemorySpanExporter();
const tracing = initializeTracing(
  loadEnv({
    ...process.env,
    OTEL_TRACING_ENABLED: 'true',
    OTEL_TRACES_EXPORTER: 'none',
    OTEL_SERVICE_NAME: 'pulsestack-test',
  }),
  { exporter: spanExporter },
);

const workflow: WorkflowDefinition = {
  id: 'wf_trace_test',
  name: 'Trace test',
  version: '1.0.0',
  tenantId: 'tenant_trace',
  correlationId: 'corr_trace',
  metadata: {},
  steps: [
    {
      id: 'plan',
      name: 'Plan',
      kind: 'llm',
      dependsOn: [],
      input: { model: 'test-model', prompt: 'plan' },
    },
    {
      id: 'act',
      name: 'Act',
      kind: 'tool',
      dependsOn: ['plan'],
      input: { tool: 'test-tool' },
    },
  ],
};

describe('WorkflowRuntime tracing', () => {
  beforeEach(() => {
    spanExporter.reset();
  });

  it('emits workflow and step spans with propagated event trace context', async () => {
    const infra = createInfra();
    const runtime = new WorkflowRuntime(infra as unknown as PulseInfra);

    const result = await runtime.execute({
      workflow,
      input: { topic: 'tracing' },
      initiatedBy: 'vitest',
    });
    await tracing.provider?.forceFlush();

    const otelSpans = spanExporter.getFinishedSpans();
    expect(otelSpans.map((span) => span.name).sort()).toEqual([
      'workflow.execute',
      'workflow.step.llm',
      'workflow.step.tool',
    ]);
    expect(
      new Set(otelSpans.map((span) => span.spanContext().traceId)).size,
    ).toBe(1);
    expect(result.traceId).toBe(otelSpans[0].spanContext().traceId);

    expect(infra.spans).toHaveLength(4);
    expect(new Set(infra.spans.map((span) => span.traceId))).toEqual(
      new Set([result.traceId]),
    );
    expect(
      infra.events.every((event) =>
        event.tags.traceparent?.startsWith(`00-${result.traceId}-`),
      ),
    ).toBe(true);
  });
});

function createInfra() {
  return {
    spans: [] as TraceSpan[],
    events: [] as EventEnvelope[],
    snapshots: [] as ExecutionSnapshot[],
    async persistWorkflow() {
      return undefined;
    },
    async createExecution() {
      return undefined;
    },
    async completeExecution() {
      return undefined;
    },
    async writeSnapshot(snapshot: ExecutionSnapshot) {
      this.snapshots.push(snapshot);
    },
    async writeSpan(span: TraceSpan) {
      this.spans.push(span);
    },
    async writeEvent(event: EventEnvelope) {
      this.events.push(event);
    },
  };
}
