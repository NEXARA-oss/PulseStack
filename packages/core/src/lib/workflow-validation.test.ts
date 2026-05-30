import { describe, expect, it } from 'vitest';
import type { WorkflowDefinition } from '@pulsestack/contracts';
import { validateWorkflowDag, WorkflowValidationError } from './workflow-validation.js';

const baseWorkflow: WorkflowDefinition = {
  id: 'wf_test',
  name: 'Test workflow',
  version: '1.0.0',
  tenantId: 'tenant_test',
  correlationId: 'corr_test',
  metadata: {},
  steps: [
    { id: 'start', name: 'Start', kind: 'trigger', dependsOn: [], input: {} },
    { id: 'llm', name: 'LLM', kind: 'llm', dependsOn: ['start'], input: {} },
    { id: 'tool', name: 'Tool', kind: 'tool', dependsOn: ['llm'], input: {} },
  ],
};

describe('validateWorkflowDag', () => {
  it('accepts a connected acyclic workflow', () => {
    expect(() => validateWorkflowDag(baseWorkflow)).not.toThrow();
  });

  it('reports missing dependencies and disconnected steps', () => {
    expect(() =>
      validateWorkflowDag({
        ...baseWorkflow,
        steps: [
          { id: 'start', name: 'Start', kind: 'trigger', dependsOn: [], input: {} },
          { id: 'orphan', name: 'Orphan', kind: 'tool', dependsOn: ['missing'], input: {} },
        ],
      }),
    ).toThrow(WorkflowValidationError);
  });

  it('reports dependency cycles', () => {
    try {
      validateWorkflowDag({
        ...baseWorkflow,
        steps: [
          { id: 'a', name: 'A', kind: 'tool', dependsOn: ['c'], input: {} },
          { id: 'b', name: 'B', kind: 'tool', dependsOn: ['a'], input: {} },
          { id: 'c', name: 'C', kind: 'tool', dependsOn: ['b'], input: {} },
        ],
      });
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowValidationError);
      expect((error as WorkflowValidationError).issues.some((issue) => issue.code === 'cyclic_dependency')).toBe(true);
    }
  });
});
