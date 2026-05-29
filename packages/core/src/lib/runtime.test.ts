import { describe, expect, it } from 'vitest';
import type { EventEnvelope, WorkflowDefinition } from '@pulsestack/contracts';
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
