import {
  eventEnvelopeSchema,
  type EventEnvelope,
  type ExecutionContext,
  type EventType,
} from '@pulsestack/contracts';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';
import { injectTraceContext, withExtractedTraceContext } from './tracing.js';

export function createEvent(input: {
  type: EventType;
  source: string;
  tenantId: string;
  correlationId: string;
  workflowId?: string;
  executionId?: string;
  spanId?: string;
  parentSpanId?: string;
  executionContext?: ExecutionContext;
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
}): EventEnvelope {
  const executionContext = input.executionContext;
  if (executionContext && executionContext.tenantId !== input.tenantId) {
    throw new Error('Event tenant does not match execution context tenant');
  }
  return eventEnvelopeSchema.parse({
    id: createId('evt'),
    version: 1,
    type: input.type,
    source: input.source,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    workflowId: input.workflowId ?? executionContext?.workflowId,
    executionId: input.executionId ?? executionContext?.executionId,
    spanId: input.spanId,
    parentSpanId: input.parentSpanId ?? executionContext?.parentSpanId,
    executionContext,
    timestamp: new Date().toISOString(),
    payload: {
      ...(input.payload ?? {}),
      ...(executionContext ? { executionContext } : {}),
    },
    tags: injectTraceContext({
      ...input.tags,
      ...(executionContext
        ? {
            executionId: executionContext.executionId,
            workflowId: executionContext.workflowId,
            traceId: executionContext.traceId,
            ...(executionContext.parentSpanId
              ? { parentSpanId: executionContext.parentSpanId }
              : {}),
            ...(executionContext.retryAttempt
              ? { retryAttempt: String(executionContext.retryAttempt) }
              : {}),
            ...(executionContext.replaySessionId
              ? { replaySessionId: executionContext.replaySessionId }
              : {}),
          }
        : {}),
    }),
  });
}

export async function publishEvent(infra: PulseInfra, event: EventEnvelope) {
  await withExtractedTraceContext(event.tags, () => infra.writeEvent(event));
}
