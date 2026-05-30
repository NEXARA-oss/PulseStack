import type { WorkflowDefinition } from '@pulsestack/contracts';

export type WorkflowValidationIssueCode =
  | 'duplicate_step_id'
  | 'invalid_dependency_reference'
  | 'missing_entry_node'
  | 'cyclic_dependency'
  | 'disconnected_step';

export interface WorkflowValidationIssue {
  code: WorkflowValidationIssueCode;
  message: string;
  stepId?: string;
  dependencyId?: string;
  path?: string[];
}

export class WorkflowValidationError extends Error {
  constructor(public readonly issues: WorkflowValidationIssue[]) {
    super('Workflow DAG validation failed');
    this.name = 'WorkflowValidationError';
  }
}

export function validateWorkflowDag(workflow: WorkflowDefinition) {
  const issues: WorkflowValidationIssue[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const step of workflow.steps) {
    if (seen.has(step.id)) {
      duplicates.add(step.id);
      issues.push({
        code: 'duplicate_step_id',
        stepId: step.id,
        message: `Step id "${step.id}" is defined more than once.`,
      });
    }
    seen.add(step.id);
  }

  const stepIds = new Set(workflow.steps.map((step) => step.id));
  const adjacency = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const step of workflow.steps) {
    adjacency.set(step.id, []);
    incomingCount.set(step.id, 0);
  }

  for (const step of workflow.steps) {
    for (const dependencyId of step.dependsOn ?? []) {
      if (!stepIds.has(dependencyId)) {
        issues.push({
          code: 'invalid_dependency_reference',
          stepId: step.id,
          dependencyId,
          message: `Step "${step.id}" depends on missing step "${dependencyId}".`,
        });
        continue;
      }

      adjacency.get(dependencyId)?.push(step.id);
      incomingCount.set(step.id, (incomingCount.get(step.id) ?? 0) + 1);
    }
  }

  const entryNodes = workflow.steps.filter((step) => (incomingCount.get(step.id) ?? 0) === 0);
  if (entryNodes.length === 0) {
    issues.push({
      code: 'missing_entry_node',
      message: 'Workflow must include at least one entry step with no dependencies.',
    });
  }

  issues.push(...detectCycles(workflow, adjacency, duplicates));

  const reachable = new Set<string>();
  const queue = entryNodes.map((step) => step.id);
  while (queue.length) {
    const stepId = queue.shift();
    if (!stepId || reachable.has(stepId)) continue;
    reachable.add(stepId);
    queue.push(...(adjacency.get(stepId) ?? []));
  }

  for (const step of workflow.steps) {
    if (!reachable.has(step.id) && !duplicates.has(step.id)) {
      issues.push({
        code: 'disconnected_step',
        stepId: step.id,
        message: `Step "${step.id}" is not reachable from any entry step.`,
      });
    }
  }

  if (issues.length) {
    throw new WorkflowValidationError(issues);
  }
}

function detectCycles(
  workflow: WorkflowDefinition,
  adjacency: Map<string, string[]>,
  duplicates: Set<string>,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (stepId: string) => {
    if (duplicates.has(stepId)) return;
    if (visiting.has(stepId)) {
      const cycleStart = stack.indexOf(stepId);
      const path = cycleStart >= 0 ? [...stack.slice(cycleStart), stepId] : [stepId];
      issues.push({
        code: 'cyclic_dependency',
        stepId,
        path,
        message: `Workflow contains a dependency cycle: ${path.join(' -> ')}.`,
      });
      return;
    }
    if (visited.has(stepId)) return;

    visiting.add(stepId);
    stack.push(stepId);
    for (const nextStepId of adjacency.get(stepId) ?? []) {
      visit(nextStepId);
    }
    stack.pop();
    visiting.delete(stepId);
    visited.add(stepId);
  };

  for (const step of workflow.steps) {
    visit(step.id);
  }

  return issues;
}
