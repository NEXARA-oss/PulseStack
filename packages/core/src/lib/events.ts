import { eventEnvelopeSchema, type EventEnvelope, type EventType } from '@pulsestack/contracts';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';
import { dispatchEventToPlugins, type PulsePluginModule } from './plugins.js';

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
    tags: input.tags ?? {},
  });
}

export async function publishEvent(
  infra: PulseInfra,
  event: EventEnvelope,
  options: { plugins?: PulsePluginModule[]; service?: string } = {},
) {
  await infra.writeEvent(event);
  if (options.plugins?.length) {
    await dispatchEventToPlugins(options.plugins, event, {
      service: options.service ?? event.source,
    });
  }
}
