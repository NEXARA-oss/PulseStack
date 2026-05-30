import type {
  ExecutionRequest,
  ExecutionSnapshot,
  RetryPolicy,
  TraceSpan,
  WorkflowStep,
} from '@pulsestack/contracts';
import {
  executionRequestSchema,
  executionSnapshotSchema,
  traceSpanSchema,
} from '@pulsestack/contracts';
import { createEvent, publishEvent } from './events.js';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';
import { activeTraceId, spanId, withRuntimeSpan } from './tracing.js';
import { validateWorkflowDag } from './workflow-validation.js';

const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 1,
  backoffMs: 0,
  maxBackoffMs: 30_000,
  exponential: true,
};

type StepResult = {
  stepId: string;
  output: Record<string, unknown>;
  costUsd: number;
  tokens: number;
  attempts: number;
  retry: {
    maxAttempts: number;
    exhausted: boolean;
    errors: string[];
  };
};

type RuntimeOptions = {
  sleep?: (ms: number) => Promise<void>;
};

export class WorkflowRuntime {
  constructor(
    private readonly infra: PulseInfra,
    private readonly source = 'pulse-runtime',
    private readonly options: RuntimeOptions = {},
  ) {}

  async execute(requestInput: ExecutionRequest) {
    const request = executionRequestSchema.parse(requestInput);
    validateWorkflowDag(request.workflow);
    const executionId = createId('exec');

    return withRuntimeSpan(
      'workflow.execute',
      {
        attributes: {
          'pulsestack.execution.id': executionId,
          'pulsestack.workflow.id': request.workflow.id,
          'pulsestack.workflow.name': request.workflow.name,
          'pulsestack.workflow.version': request.workflow.version,
          'pulsestack.tenant.id': request.workflow.tenantId,
          'pulsestack.correlation.id': request.workflow.correlationId,
          'pulsestack.workflow.step_count': request.workflow.steps.length,
          'pulsestack.initiated_by': request.initiatedBy,
        },
      },
      async (workflowSpan) => {
        const traceId = activeTraceId(createId('trace'));
        const workflowSpanId = spanId(workflowSpan);
        await this.infra.persistWorkflow(request.workflow);
        await this.infra.createExecution({
          executionId,
          workflowId: request.workflow.id,
          tenantId: request.workflow.tenantId,
          correlationId: request.workflow.correlationId,
          input: request.input,
        });

    const state: Record<string, unknown> = { ...request.input };
    const results: StepResult[] = [];

    for (const [index, step] of request.workflow.steps.entries()) {
      const span = await this.startSpan({
        traceId,
        executionId,
        workflowId: request.workflow.id,
        tenantId: request.workflow.tenantId,
        step,
        state,
      });

      const result = await this.runStep(step, state, request.workflow.tenantId, request.workflow.correlationId);
      Object.assign(state, { [step.id]: result.output });
      results.push(result);

      await this.snapshot({
        id: createId('snap'),
        executionId,
        workflowId: request.workflow.id,
        sequence: index,
        state: structuredClone(state),
        sideEffects: [
          {
            type: step.kind,
            key: step.id,
            response: result.output,
          },
        ],
        createdAt: new Date().toISOString(),
      });

        await publishEvent(
          this.infra,
          createEvent({
            type: 'workflow.started',
            source: this.source,
            tenantId: request.workflow.tenantId,
            correlationId: request.workflow.correlationId,
            workflowId: request.workflow.id,
            executionId,
            spanId: workflowSpanId,
            payload: {
              workflow: request.workflow.name,
              initiatedBy: request.initiatedBy,
            },
          }),
        );


        const state: Record<string, unknown> = { ...request.input };
        const retryState: Record<string, unknown> = {};
        const results: StepResult[] = [];

        try {
          for (const [index, step] of request.workflow.steps.entries()) {
            await withRuntimeSpan(
              `workflow.step.${step.kind}`,
              {
                attributes: {
                  'pulsestack.execution.id': executionId,
                  'pulsestack.workflow.id': request.workflow.id,
                  'pulsestack.step.id': step.id,
                  'pulsestack.step.name': step.name,
                  'pulsestack.step.kind': step.kind,
                  'pulsestack.step.index': index,
                  'pulsestack.step.depends_on': step.dependsOn.join(','),
                  'pulsestack.state.keys': Object.keys(state).join(','),
                  'pulsestack.step.retry.max_attempts': normalizeRetryPolicy(
                    step.retry,
                  ).maxAttempts,
                },
              },
              async (otelStepSpan) => {
                const span = await this.startSpan({
                  traceId,
                  executionId,
                  workflowId: request.workflow.id,
                  parentSpanId: workflowSpanId,
                  step,
                  state,
                });

                let result: StepResult;
                try {
                  result = await this.runStepWithRetry({
                    step,
                    state,
                    traceId,
                    executionId,
                    workflowId: request.workflow.id,
                    tenantId: request.workflow.tenantId,
                    correlationId: request.workflow.correlationId,
                    spanId: span.spanId,
                  });
                } catch (error) {
                  if (error instanceof StepRetryExhaustedError) {
                    retryState[error.stepId] = error.retry;
                    Object.assign(state, { __retry: retryState });
                    otelStepSpan.setAttributes({
                      'pulsestack.step.retry.exhausted': true,
                      'pulsestack.step.retry.max_attempts':
                        error.retry.maxAttempts,
                    });
                  }
                  await this.failSpan(span, error);
                  throw error;
                }

                retryState[step.id] = result.retry;
                otelStepSpan.setAttributes({
                  'pulsestack.step.cost_usd': result.costUsd,
                  'pulsestack.step.tokens': result.tokens,
                  'pulsestack.step.attempts': result.attempts,
                  'pulsestack.step.retry.exhausted': result.retry.exhausted,
                });
                Object.assign(state, {
                  [step.id]: result.output,
                  __retry: retryState,
                });
                results.push(result);

                await this.snapshot({
                  id: createId('snap'),
                  executionId,
                  workflowId: request.workflow.id,
                  sequence: index,
                  state: structuredClone(state),
                  sideEffects: [
                    {
                      type: step.kind,
                      key: step.id,
                      response: result.output,
                    },
                  ],
                  createdAt: new Date().toISOString(),
                });

                await this.finishSpan(span, result);
              },
            );
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Workflow step failed';
          const failureOutput = {
            steps: results,
            finalState: state,
            error: message,
          };
          workflowSpan.setAttributes({
            'pulsestack.workflow.failed': true,
            'pulsestack.workflow.error': message,
          });
          await this.infra.completeExecution(
            executionId,
            'failed',
            failureOutput,
          );
          await publishEvent(
            this.infra,
            createEvent({
              type: 'workflow.failed',
              source: this.source,
              tenantId: request.workflow.tenantId,
              correlationId: request.workflow.correlationId,
              workflowId: request.workflow.id,
              executionId,
              spanId: workflowSpanId,
              payload: failureOutput,
            }),
          );
          throw error;
        }

        const output = {
          steps: results,
          totalCostUsd: results.reduce((sum, item) => sum + item.costUsd, 0),
          totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
          finalState: state,
        };

        workflowSpan.setAttributes({
          'pulsestack.workflow.total_cost_usd': output.totalCostUsd,
          'pulsestack.workflow.total_tokens': output.totalTokens,
        });
        await this.infra.completeExecution(executionId, 'completed', output);
        await publishEvent(
          this.infra,
          createEvent({
            type: 'workflow.completed',
            source: this.source,
            tenantId: request.workflow.tenantId,
            correlationId: request.workflow.correlationId,
            workflowId: request.workflow.id,
            executionId,
            spanId: workflowSpanId,
            payload: output,
          }),
        );

        return { executionId, traceId, output };
      },
    );
  }

  private async runStepWithRetry(args: {
    step: WorkflowStep;
    state: Record<string, unknown>;
    traceId: string;
    executionId: string;
    workflowId: string;
    tenantId: string;
    correlationId: string;
    spanId: string;
  }): Promise<StepResult> {
    const policy = normalizeRetryPolicy(args.step.retry);
    const errors: string[] = [];

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      try {
        const result = await this.runStep(
          args.step,
          args.state,
          args.correlationId,
          attempt,
        );
        return {
          ...result,
          attempts: attempt,
          retry: {
            maxAttempts: policy.maxAttempts,
            exhausted: false,
            errors,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Step failed';
        errors.push(message);
        const nextDelayMs = getRetryDelayMs(policy, attempt);
        const canRetry = attempt < policy.maxAttempts;
        await publishEvent(
          this.infra,
          createEvent({
            type: canRetry ? 'step.retrying' : 'step.failed',
            source: this.source,
            tenantId: args.tenantId,
            correlationId: args.correlationId,
            workflowId: args.workflowId,
            executionId: args.executionId,
            spanId: args.spanId,
            payload: {
              stepId: args.step.id,
              stepName: args.step.name,
              attempt,
              maxAttempts: policy.maxAttempts,
              nextDelayMs: canRetry ? nextDelayMs : 0,
              error: message,
            },
            tags: {
              stepKind: args.step.kind,
              traceId: args.traceId,
            },
          }),
        );
        if (!canRetry) {
          throw new StepRetryExhaustedError(
            args.step.id,
            {
              maxAttempts: policy.maxAttempts,
              exhausted: true,
              errors,
            },
            `Step ${args.step.id} failed after ${policy.maxAttempts} attempt${policy.maxAttempts === 1 ? '' : 's'}: ${message}`,
          );
        }
        await this.sleep(nextDelayMs);
      }
    }

    throw new Error(`Step ${args.step.id} failed without producing a result`);
  }

  private async runStep(
    step: WorkflowStep,
    state: Record<string, unknown>,

    tenantId: string,
    correlationId: string,
  ): Promise<StepResult> {

    correlationId: string,
    attempt: number,
  ): Promise<Omit<StepResult, 'attempts' | 'retry'>> {

    const timestamp = new Date().toISOString();
    const plannedFailures = Number(step.input.failAttempts ?? 0);
    if (Number.isFinite(plannedFailures) && attempt <= plannedFailures) {
      throw new Error(`Simulated failure for ${step.id} on attempt ${attempt}`);
    }
    if (step.kind === 'tool') {
      await publishEvent(
        this.infra,
        createEvent({
          type: 'tool.called',
          source: this.source,
          tenantId,
          correlationId,
          payload: {
            stepId: step.id,
            tool: step.name,
            input: step.input,
            state,
          },
        }),
      );
    }
    if (step.kind === 'llm') {
      await publishEvent(
        this.infra,
        createEvent({
          type: 'llm.requested',
          source: this.source,
          tenantId,
          correlationId,
          payload: {
            stepId: step.id,
            model: step.input.model ?? 'generic',
            prompt: step.input.prompt ?? '',
          },
        }),
      );
    }

    const base = {
      timestamp,
      receivedStateKeys: Object.keys(state),
      config: step.input,
    };
    const output =
      step.kind === 'llm'
        ? {
            ...base,
            text: `synthetic completion for ${step.name}`,
            tokens: 350 + step.name.length,
          }
        : step.kind === 'tool'
          ? {
              ...base,
              status: 'ok',
              result: {
                echoed: step.input,
                checksum: `${step.id}:${Object.keys(state).length}`,
              },
            }
          : {
              ...base,
              status: 'processed',
            };
    const tokens =
      step.kind === 'llm' && 'tokens' in output ? Number(output.tokens) : 0;

    return {
      stepId: step.id,
      output,
      costUsd: step.kind === 'llm' ? 0.014 : 0.002,
      tokens,
    };
  }

  private async startSpan(args: {
    traceId: string;
    executionId: string;
    workflowId: string;

    tenantId: string;

    parentSpanId?: string;

    step: WorkflowStep;
    state: Record<string, unknown>;
  }) {
    const span = traceSpanSchema.parse({
      spanId: createId('span'),
      parentSpanId: args.parentSpanId ?? null,
      traceId: args.traceId,
      executionId: args.executionId,
      workflowId: args.workflowId,
      name: args.step.name,
      kind: args.step.kind,
      status: 'running',
      startedAt: new Date().toISOString(),
      endedAt: null,
      attributes: {
        dependsOn: args.step.dependsOn,
        stateKeys: Object.keys(args.state),
        retryMaxAttempts: normalizeRetryPolicy(args.step.retry).maxAttempts,
      },
      error: null,
    });
    await this.infra.writeSpan(span);
    await publishEvent(
      this.infra,
      createEvent({
        type: 'span.recorded',
        source: this.source,
        tenantId: args.tenantId,
        correlationId: args.traceId,
        workflowId: args.workflowId,
        executionId: args.executionId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId ?? undefined,
        payload: span.attributes,
      }),
    );
    return span;
  }

  private async finishSpan(span: TraceSpan, result: StepResult) {
    await this.infra.writeSpan({
      ...span,
      status: 'ok',
      endedAt: new Date().toISOString(),
      attributes: {
        ...span.attributes,
        stepId: result.stepId,
        costUsd: result.costUsd,
        tokens: result.tokens,
        attempts: result.attempts,
        retryExhausted: result.retry.exhausted,
      },
    });
  }

  private async failSpan(span: TraceSpan, error: unknown) {
    const message = error instanceof Error ? error.message : 'Step failed';
    await this.infra.writeSpan({
      ...span,
      status: 'error',
      endedAt: new Date().toISOString(),
      attributes: { ...span.attributes, retryExhausted: true },
      error: message,
    });
  }

  private async snapshot(snapshotInput: ExecutionSnapshot) {
    const snapshot = executionSnapshotSchema.parse(snapshotInput);
    await this.infra.writeSnapshot(snapshot);
  }

  private async sleep(ms: number) {
    if (ms <= 0) return;
    await (this.options.sleep ?? defaultSleep)(ms);
  }
}

function normalizeRetryPolicy(policy?: RetryPolicy): RetryPolicy {
  return {
    ...defaultRetryPolicy,
    ...policy,
  };
}

function getRetryDelayMs(policy: RetryPolicy, failedAttempt: number) {
  if (policy.backoffMs <= 0) return 0;
  const multiplier = policy.exponential
    ? 2 ** Math.max(0, failedAttempt - 1)
    : 1;
  return Math.min(policy.backoffMs * multiplier, policy.maxBackoffMs);
}

async function defaultSleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

class StepRetryExhaustedError extends Error {
  constructor(
    readonly stepId: string,
    readonly retry: StepResult['retry'],
    message: string,
  ) {
    super(message);
    this.name = 'StepRetryExhaustedError';
  }
}
