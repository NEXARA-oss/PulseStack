# Tracing

PulseStack records AI-native spans with workflow, tool, and LLM semantics.

The runtime also emits OpenTelemetry spans when tracing is enabled. OpenTelemetry is off by default so local development and tests keep their existing behavior unless explicitly configured.

## OpenTelemetry Config

Set these environment variables on runtime services:

- `OTEL_TRACING_ENABLED=true` enables the OpenTelemetry provider.
- `OTEL_TRACES_EXPORTER=console` writes finished spans to stdout for local debugging.
- `OTEL_TRACES_EXPORTER=none` keeps the provider active without exporting spans.
- `OTEL_SERVICE_NAME=pulse-runtime` names the service for collectors and consoles.

Example local runtime session:

```sh
OTEL_TRACING_ENABLED=true \
OTEL_TRACES_EXPORTER=console \
OTEL_SERVICE_NAME=pulse-runtime \
pnpm --filter @pulsestack/pulse-runtime dev
```

## Runtime Spans

Workflow execution creates a parent `workflow.execute` span. Each workflow step creates a child `workflow.step.<kind>` span with execution metadata:

- `pulsestack.execution.id`
- `pulsestack.workflow.id`
- `pulsestack.workflow.name`
- `pulsestack.workflow.version`
- `pulsestack.step.id`
- `pulsestack.step.kind`
- `pulsestack.step.cost_usd`
- `pulsestack.step.tokens`

Events created while a span is active receive W3C trace context in their tags, including `traceparent` and `tracestate` when available. The `/emit/:type` event endpoint also accepts incoming `traceparent` and `tracestate` headers and carries them into emitted events.

## Span Attributes

- `traceId`
- `executionId`
- `workflowId`
- `kind`
- `status`
- `attributes`

## Queries

- `GET /api/traces/:executionId`
