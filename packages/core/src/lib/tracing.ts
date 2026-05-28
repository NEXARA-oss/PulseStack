import {
  context,
  isSpanContextValid,
  propagation,
  trace,
  SpanStatusCode,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';
import {
  ConsoleSpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-node';
import type { PulseEnv } from './config.js';
import { loadEnv } from './config.js';

export type TraceCarrier = Record<string, string>;

export type TracingHandle = {
  enabled: boolean;
  provider?: NodeTracerProvider;
  shutdown: () => Promise<void>;
};

let tracingHandle: TracingHandle | undefined;

export function initializeTracing(
  env: PulseEnv = loadEnv(),
  options: { exporter?: SpanExporter } = {},
): TracingHandle {
  if (tracingHandle) return tracingHandle;

  if (!env.OTEL_TRACING_ENABLED) {
    tracingHandle = { enabled: false, shutdown: async () => undefined };
    return tracingHandle;
  }

  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = env.OTEL_SERVICE_NAME || env.SERVICE_NAME;
  }

  const exporter = options.exporter ?? createExporter(env);
  const provider = new NodeTracerProvider({
    spanProcessors: exporter ? [new SimpleSpanProcessor(exporter)] : [],
  });

  provider.register();

  tracingHandle = {
    enabled: true,
    provider,
    shutdown: async () => {
      await provider.shutdown();
      tracingHandle = undefined;
    },
  };
  return tracingHandle;
}

export function getRuntimeTracer() {
  return trace.getTracer('pulsestack-runtime');
}

export async function withRuntimeSpan<T>(
  name: string,
  options: SpanOptions,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return getRuntimeTracer().startActiveSpan(name, options, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message:
          error instanceof Error ? error.message : 'Unknown runtime error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export function activeTraceId(fallback: string): string {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext && isSpanContextValid(spanContext)
    ? spanContext.traceId
    : fallback;
}

export function spanId(span: Span): string | undefined {
  const spanContext = span.spanContext();
  return isSpanContextValid(spanContext) ? spanContext.spanId : undefined;
}

export function injectTraceContext(tags: TraceCarrier = {}): TraceCarrier {
  const carrier = { ...tags };
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function withExtractedTraceContext<T>(
  carrier: TraceCarrier | undefined,
  fn: () => T,
): T {
  if (!carrier) return fn();
  return context.with(propagation.extract(context.active(), carrier), fn);
}

function createExporter(env: PulseEnv): SpanExporter | undefined {
  if (env.OTEL_TRACES_EXPORTER === 'console') return new ConsoleSpanExporter();
  return undefined;
}
