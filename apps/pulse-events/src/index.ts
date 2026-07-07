import type { WebsocketHandler } from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import {
  createBaseServer,
  createEvent,
  initializeTracing,
  loadEnv,
  publishEvent,
  PulseInfra,
  tenantIdFromHeaders,
  withExtractedTraceContext,
  type TraceCarrier,
} from '@pulsestack/core';
import {
  eventEnvelopeSchema,
  executionContextSchema,
  eventTypeSchema,
  type EventType,
} from '@pulsestack/contracts';

const env = loadEnv();
initializeTracing(env);
const infra = new PulseInfra();
const app = await createBaseServer('pulse-events');

await app.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  skip: (request) => request.url !== '/ingest',
  keyGenerator: (request) => {
    const tenantId = request.headers['x-tenant-id'] ?? 'unknown';
    return Array.isArray(tenantId) ? tenantId[0] : tenantId;
  },
});

app.post('/ingest', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const event = eventEnvelopeSchema.parse(request.body);
  if (event.tenantId !== tenantId || (event.executionContext?.tenantId && event.executionContext.tenantId !== tenantId)) {
    return reply.code(403).send({ message: 'Event tenant does not match request tenant' });
  }
  await publishEvent(infra, event);
  return { accepted: true, id: event.id };
});

app.post<{ Params: { type: string }; Body: Record<string, unknown> }>(
  '/emit/:type',
  async (request, reply) => {
    const eventType: EventType = eventTypeSchema.parse(request.params.type);
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const executionContext = request.body.executionContext
      ? executionContextSchema.parse(request.body.executionContext)
      : undefined;
    if (executionContext?.tenantId && executionContext.tenantId !== tenantId) {
      return reply.code(403).send({ message: 'Event tenant does not match execution context tenant' });
    }
    const event = withExtractedTraceContext(
      traceCarrierFromHeaders(request.headers),
      () =>
        createEvent({
          type: eventType,
          source: 'pulse-events',
          tenantId,
          correlationId:
            request.headers['x-correlation-id']?.toString() ?? 'manual',
          workflowId: executionContext?.workflowId,
          executionId: executionContext?.executionId,
          executionContext,
          payload: request.body ?? {},
        }),
    );
    await publishEvent(infra, event);
    return event;
  },
);

const streamHandler: WebsocketHandler = async (socket, request) => {
  const queryTenantId = (request.query as { tenantId?: string } | undefined)?.tenantId;
  const tenantId = tenantIdFromHeaders(
    {
      ...(request.headers as Record<string, string | string[] | undefined>),
      ...(queryTenantId ? { 'x-tenant-id': queryTenantId } : {}),
    },
    env.TENANT_ID,
  );
  const nc = await infra.nats();
  const subscription = nc.subscribe('pulse.events.>');
  (async () => {
    try {
      for await (const message of subscription) {
        try {
          const event = eventEnvelopeSchema.safeParse(JSON.parse(message.string()));
          if (event.success && event.data.tenantId === tenantId) {
            socket.send(message.string());
          }
        } catch {
          // Socket closed — stop iterating
          break;
        }
      }
    } catch (err) {
      // Subscription or NATS error
      console.error('Event stream error:', err);
    }
  })().catch((err) => console.error('Event stream unhandled error:', err));
  socket.on('close', () => subscription.unsubscribe());
};

app.get('/stream', { websocket: true }, streamHandler);

app.get('/recent', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.readRecentEvents(200, tenantId);
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });

function traceCarrierFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): TraceCarrier | undefined {
  const traceparent = headerValue(headers.traceparent);
  const tracestate = headerValue(headers.tracestate);
  if (!traceparent && !tracestate) return undefined;
  return {
    ...(traceparent ? { traceparent } : {}),
    ...(tracestate ? { tracestate } : {}),
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
