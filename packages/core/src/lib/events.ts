import {
  eventEnvelopeSchema,
  type EventEnvelope,
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
  payload?: Record<string, unknown>;
  tags?: Record<string, string>;
}): EventEnvelope {
  return eventEnvelopeSchema.parse({
    id: createId('evt'),
    version: 1,
    type: input.type,
    source: input.source,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    workflowId: input.workflowId,
    executionId: input.executionId,
    spanId: input.spanId,
    parentSpanId: input.parentSpanId,
    timestamp: new Date().toISOString(),
    payload: input.payload ?? {},
    tags: injectTraceContext(input.tags),
  });
}

export async function publishEvent(infra: PulseInfra, event: EventEnvelope) {
  await withExtractedTraceContext(event.tags, () => infra.writeEvent(event));
}
