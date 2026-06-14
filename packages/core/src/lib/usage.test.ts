import { describe, expect, it } from 'vitest';
import { aggregateUsage, buildUsageMetadata, estimateCost } from './usage.js';

describe('usage utilities', () => {
  it('estimates costs deterministically from configurable pricing', () => {
    expect(
      estimateCost('model-a', 1000, 500, {
        'model-a': {
          inputCostPer1kTokens: 0.01,
          outputCostPer1kTokens: 0.02,
        },
      }),
    ).toEqual({
      inputCost: 0.01,
      outputCost: 0.01,
      totalCost: 0.02,
    });
  });

  it('builds attributed usage metadata', () => {
    expect(
      buildUsageMetadata({
        model: 'generic-llm',
        tokenUsage: { inputTokens: 10, outputTokens: 20 },
        attribution: {
          tenantId: 'tenant_a',
          workflowId: 'wf_1',
          executionId: 'exec_1',
          stepId: 'llm',
          retryAttempt: 2,
        },
      }),
    ).toMatchObject({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      attribution: {
        tenantId: 'tenant_a',
        workflowId: 'wf_1',
        executionId: 'exec_1',
        stepId: 'llm',
        retryAttempt: 2,
        model: 'generic-llm',
      },
    });
  });

  it('aggregates missing usage as zero', () => {
    expect(
      aggregateUsage([
        { inputTokens: 1, outputTokens: 2, totalTokens: 3, totalCost: 0.1 },
        undefined,
      ]),
    ).toMatchObject({
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      totalCost: 0.1,
    });
  });
});
