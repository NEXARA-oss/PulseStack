import type { WebsocketHandler } from '@fastify/websocket';
import {
  createBaseServer,
  createEvent,
  initializeTracing,
  loadEnv,
  publishEvent,
  PulseInfra,
  withExtractedTraceContext,
  type TraceCarrier,
} from '@pulsestack/core';
import {
  eventEnvelopeSchema,
  eventTypeSchema,
  type EventType,
} from '@pulsestack/contracts';

const env = loadEnv();
initializeTracing(env);
const infra = new PulseInfra();
const app = await createBaseServer('pulse-events');

app.post('/ingest', async (request) => {
  const event = eventEnvelopeSchema.parse(request.body);
  await publishEvent(infra, event);
  return { accepted: true, id: event.id };
});

app.post<{ Params: { type: string }; Body: Record<string, unknown> }>(
  '/emit/:type',
  async (request) => {
    const eventType: EventType = eventTypeSchema.parse(request.params.type);
    const event = withExtractedTraceContext(
      traceCarrierFromHeaders(request.headers),
      () =>
        createEvent({
          type: eventType,
          source: 'pulse-events',
          tenantId: env.TENANT_ID,
          correlationId:
            request.headers['x-correlation-id']?.toString() ?? 'manual',
          payload: request.body ?? {},
        }),
    );
    await publishEvent(infra, event);
    return event;
  },
);

const streamHandler: WebsocketHandler = async (socket) => {
  const nc = await infra.nats();
  const subscription = nc.subscribe('pulse.events.>');
  (async () => {
    for await (const message of subscription) {
      socket.send(message.string());
    }
  })();
  socket.on('close', () => subscription.unsubscribe());
};

app.get('/stream', { websocket: true }, streamHandler);

app.get('/recent', async () => infra.readRecentEvents());

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
