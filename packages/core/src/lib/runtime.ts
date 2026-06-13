import type {
  ExecutionContext,
  ExecutionRequest,
  ExecutionSnapshot,
  RetryPolicy,
  TraceSpan,
  UsageMetadata,
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
import { aggregateUsage, buildUsageMetadata, estimatePromptTokens } from './usage.js';
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
  usage: UsageMetadata;
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
  ) { }

  async execute(requestInput: ExecutionRequest) {
    const request = executionRequestSchema.parse(requestInput);
    if (request.context?.tenantId && request.context.tenantId !== request.workflow.tenantId) {
      throw new Error('Execution context tenant does not match workflow tenant');
    }
    validateWorkflowDag(request.workflow);
    const executionId = request.context?.executionId ?? createId('exec');

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
        const traceId = request.context?.traceId ?? activeTraceId(createId('trace'));
        const workflowSpanId = spanId(workflowSpan);
        const executionContext: ExecutionContext = {
          executionId,
          workflowId: request.workflow.id,
          tenantId: request.workflow.tenantId,
          correlationId: request.workflow.correlationId,
          traceId,
          ...(request.context?.parentSpanId
            ? { parentSpanId: request.context.parentSpanId }
            : {}),
          ...(request.context?.retryAttempt
            ? { retryAttempt: request.context.retryAttempt }
            : {}),
          ...(request.context?.replaySessionId
            ? { replaySessionId: request.context.replaySessionId }
            : {}),
        };
        workflowSpan.setAttributes(executionContextAttributes(executionContext));
        await this.infra.persistWorkflow(request.workflow);
        await this.infra.createExecution({
          executionId,
          workflowId: request.workflow.id,
          tenantId: request.workflow.tenantId,
          correlationId: request.workflow.correlationId,
          input: request.input,
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
            executionContext,
            payload: {
              workflow: request.workflow.name,
              initiatedBy: request.initiatedBy,
            },
          }),
        );

        const state: Record<string, unknown> = { ...request.input };
        const retryState: Record<string, unknown> = {};
        const results: StepResult[] = [];
        let snapshotSequence = 0;

        const captureSnapshot = async (args: {
          phase: string;
          state: Record<string, unknown>;
          sideEffects?: ExecutionSnapshot['sideEffects'];
        }) => {
          await this.snapshot({
            id: createId('snap'),
            executionId,
            workflowId: request.workflow.id,
            sequence: snapshotSequence,
            state: structuredClone(args.state),
            executionContext,
            sideEffects:
              args.sideEffects && args.sideEffects.length > 0
                ? args.sideEffects
                : [
                    {
                      type: args.phase,
                      key: '__workflow',
                      response: { phase: args.phase },
                    },
                  ],
            createdAt: new Date().toISOString(),
          });
          snapshotSequence += 1;
        };

        await captureSnapshot({
          phase: 'workflow.start',
          state,
          sideEffects: [
            {
              type: 'workflow.start',
              key: '__workflow',
              response: {
                phase: 'workflow.start',
                workflowId: request.workflow.id,
                traceId,
                spanId: workflowSpanId,
              },
            },
          ],
        });

        try {
          for (const [index, step] of request.workflow.steps.entries()) {
            await withRuntimeSpan(
              `workflow.step.${step.kind}`,
              {
                attributes: {
                  'pulsestack.execution.id': executionId,
                  'pulsestack.workflow.id': request.workflow.id,
                  'pulsestack.tenant.id': request.workflow.tenantId,
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
                  tenantId: request.workflow.tenantId,
                  correlationId: request.workflow.correlationId,
                  executionContext,
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
                    executionContext,
                    spanId: span.spanId,
                    onRetryBoundary: async (boundary) => {
                      retryState[step.id] = {
                        maxAttempts: boundary.maxAttempts,
                        exhausted: false,
                        errors: boundary.errors,
                      };
                      Object.assign(state, { __retry: retryState });
                      await captureSnapshot({
                        phase: 'retry.boundary',
                        state,
                        sideEffects: [
                          {
                            type: 'retry.boundary',
                            key: step.id,
                            response: {
                              phase: 'retry.boundary',
                              stepId: step.id,
                              stepName: step.name,
                              stepKind: step.kind,
                              attempt: boundary.attempt,
                              maxAttempts: boundary.maxAttempts,
                              nextDelayMs: boundary.nextDelayMs,
                              errors: boundary.errors,
                              traceId,
                              spanId: span.spanId,
                            },
                          },
                        ],
                      });
                    },
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
                  'pulsestack.step.input_tokens': result.usage.inputTokens ?? 0,
                  'pulsestack.step.output_tokens': result.usage.outputTokens ?? 0,
                  'pulsestack.step.total_tokens': result.usage.totalTokens ?? 0,
                  'pulsestack.step.total_cost': result.usage.totalCost ?? 0,
                  'pulsestack.step.attempts': result.attempts,
                  'pulsestack.step.retry.exhausted': result.retry.exhausted,
                });
                Object.assign(state, {
                  [step.id]: result.output,
                  __retry: retryState,
                });
                results.push(result);

                await captureSnapshot({
                  phase: 'step.completed',
                  state,
                  sideEffects: [
                    {
                      type: step.kind,
                      key: step.id,
                      response: {
                        phase: 'step.completed',
                        stepId: step.id,
                        stepName: step.name,
                        stepKind: step.kind,
                        attempt: result.attempts,
                        retry: result.retry,
                        output: result.output,
                        usage: result.usage,
                        traceId,
                        spanId: span.spanId,
                      },
                    },
                  ],
                });

                await this.finishSpan(span, result);
              },
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Workflow failed';
          const usage = aggregateUsage(results.map((item) => item.usage), {
            tenantId: request.workflow.tenantId,
            workflowId: request.workflow.id,
            executionId,
          });
          const failureOutput = {
            steps: results,
            totalCostUsd: results.reduce((sum, item) => sum + item.costUsd, 0),
            totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
            usage,
            finalState: state,
            error: message,
            executionContext,
          };

          workflowSpan.setAttributes({
            'pulsestack.workflow.total_cost_usd': failureOutput.totalCostUsd,
            'pulsestack.workflow.total_tokens': failureOutput.totalTokens,
            'pulsestack.workflow.input_tokens': usage.inputTokens ?? 0,
            'pulsestack.workflow.output_tokens': usage.outputTokens ?? 0,
            'pulsestack.workflow.total_cost': usage.totalCost ?? 0,
          });
          await captureSnapshot({
            phase: 'workflow.completion',
            state,
            sideEffects: [
              {
                type: 'workflow.completion',
                key: '__workflow',
                response: {
                  phase: 'workflow.completion',
                  status: 'failed',
                  error: message,
                  usage,
                  traceId,
                  spanId: workflowSpanId,
                },
              },
            ],
          });
          await this.infra.completeExecution(executionId, 'failed', failureOutput);
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
              executionContext,
              payload: failureOutput,
            }),
          );
          throw error;
        }

        const usage = aggregateUsage(results.map((item) => item.usage), {
          tenantId: request.workflow.tenantId,
          workflowId: request.workflow.id,
          executionId,
        });
        const output = {
          steps: results,
          totalCostUsd: results.reduce((sum, item) => sum + item.costUsd, 0),
          totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
          usage,
          finalState: state,
          executionContext,
        };

        workflowSpan.setAttributes({
          'pulsestack.workflow.total_cost_usd': output.totalCostUsd,
          'pulsestack.workflow.total_tokens': output.totalTokens,
          'pulsestack.workflow.input_tokens': usage.inputTokens ?? 0,
          'pulsestack.workflow.output_tokens': usage.outputTokens ?? 0,
          'pulsestack.workflow.total_cost': usage.totalCost ?? 0,
        });
        await captureSnapshot({
          phase: 'workflow.completion',
          state,
          sideEffects: [
            {
              type: 'workflow.completion',
              key: '__workflow',
              response: {
                phase: 'workflow.completion',
                status: 'completed',
                usage,
                traceId,
                spanId: workflowSpanId,
              },
            },
          ],
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
            executionContext,
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
    executionContext: ExecutionContext;
    spanId: string;
    onRetryBoundary?: (boundary: {
      attempt: number;
      maxAttempts: number;
      nextDelayMs: number;
      errors: string[];
    }) => Promise<void>;
  }): Promise<StepResult> {
    const policy = normalizeRetryPolicy(args.step.retry);
    const errors: string[] = [];

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      try {
        const result = await this.runStep(
          args.step,
          args.state,
          args.tenantId,
          args.correlationId,
          args.executionContext,
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
            executionContext: {
              ...args.executionContext,
              retryAttempt: attempt,
              parentSpanId: args.spanId,
            },
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
        if (canRetry) {
          await args.onRetryBoundary?.({
            attempt,
            maxAttempts: policy.maxAttempts,
            nextDelayMs,
            errors: [...errors],
          });
        }
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
    executionContext: ExecutionContext,
    attempt: number,
  ): Promise<Omit<StepResult, 'attempts' | 'retry'>> {

      const timestamp = new Date().toISOString();
      const plannedFailures = Number(step.input.failAttempts ?? 0);
      if(Number.isFinite(plannedFailures) && attempt <= plannedFailures) {
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
          workflowId: executionContext.workflowId,
          executionId: executionContext.executionId,
          executionContext: {
            ...executionContext,
            retryAttempt: attempt,
          },
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
          workflowId: executionContext.workflowId,
          executionId: executionContext.executionId,
          executionContext: {
            ...executionContext,
            retryAttempt: attempt,
          },
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
    const model = String(step.input.model ?? (step.kind === 'llm' ? 'generic-llm' : 'generic'));
    const inputTokens =
      step.kind === 'llm'
        ? Number(step.input.inputTokens ?? estimatePromptTokens(step.input.prompt))
        : 0;
    const outputTokens =
      step.kind === 'llm' && 'tokens' in output
        ? Number(step.input.outputTokens ?? output.tokens)
        : 0;
    const usage = buildUsageMetadata({
      model,
      tokenUsage: {
        inputTokens,
        outputTokens,
      },
      attribution: {
        tenantId,
        workflowId: executionContext.workflowId,
        executionId: executionContext.executionId,
        stepId: step.id,
        retryAttempt: attempt,
        ...(executionContext.replaySessionId
          ? { replaySessionId: executionContext.replaySessionId }
          : {}),
      },
    });

    return {
      stepId: step.id,
      output,
      costUsd: usage.totalCost ?? 0,
      tokens: usage.totalTokens ?? 0,
      usage,
    };
  }

  private async startSpan(args: {
    traceId: string;
    executionId: string;
    workflowId: string;

    tenantId: string;
    correlationId: string;
    executionContext: ExecutionContext;

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
        executionContext: args.executionContext,
        ...executionContextAttributes(args.executionContext),
      },
      executionContext: {
        ...args.executionContext,
        parentSpanId: args.parentSpanId,
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
        correlationId: args.correlationId,
        workflowId: args.workflowId,
        executionId: args.executionId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId ?? undefined,
        executionContext: span.executionContext,
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
        usage: result.usage,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        totalCost: result.usage.totalCost ?? 0,
        attempts: result.attempts,
        retryExhausted: result.retry.exhausted,
        retryAttempt: result.attempts,
      },
      executionContext: span.executionContext
        ? {
            ...span.executionContext,
            retryAttempt: result.attempts,
          }
        : undefined,
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

function executionContextAttributes(context: ExecutionContext) {
  return {
    'pulsestack.execution.id': context.executionId,
    'pulsestack.workflow.id': context.workflowId,
    'pulsestack.tenant.id': context.tenantId,
    'pulsestack.correlation.id': context.correlationId,
    'pulsestack.trace.id': context.traceId,
    ...(context.parentSpanId
      ? { 'pulsestack.parent_span.id': context.parentSpanId }
      : {}),
    ...(context.retryAttempt
      ? { 'pulsestack.retry.attempt': context.retryAttempt }
      : {}),
    ...(context.replaySessionId
      ? { 'pulsestack.replay.session_id': context.replaySessionId }
      : {}),
  };
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
