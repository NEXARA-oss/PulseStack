/**
 * Distributed Trace Visualization Engine
 *
 * Provides trace tree visualization, span analysis, and service latency
 * comparison for distributed request flows.
 */

export type SpanStatus = 'ok' | 'error' | 'unset';

export type TraceSpan = {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  status: SpanStatus;
  startedAt: string;
  durationMs: number;
  attributes?: Record<string, unknown>;
  serviceName: string;
};

export type TraceTree = {
  traceId: string;
  rootSpan: TraceSpan;
  children: TraceTree[];
  depth: number;
  totalDurationMs: number;
};

export type ServiceLatency = {
  service: string;
  avgLatencyMs: number;
  p99LatencyMs: number;
  spanCount: number;
  errorRate: number;
};

export type TraceSearchResult = {
  traceId: string;
  service: string;
  spanCount: number;
  durationMs: number;
  errorCount: number;
  startedAt: string;
};

const SERVICES = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];
const SPAN_NAMES = ['http.request', 'db.query', 'cache.get', 'llm.call', 'agent.decide', 'tool.execute', 'event.publish'];

function randomId(prefix = 'span'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomBetween(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function generateSpans(traceId: string, count: number = 8): TraceSpan[] {
  const spans: TraceSpan[] = [];
  for (let i = 0; i < count; i++) {
    const status: SpanStatus = Math.random() > 0.85 ? 'error' : 'ok';
    spans.push({
      spanId: randomId('span'),
      traceId,
      parentSpanId: i > 0 && Math.random() > 0.3 ? spans[Math.floor(Math.random() * i)].spanId : undefined,
      name: SPAN_NAMES[i % SPAN_NAMES.length],
      kind: i === 0 ? 'server' : 'client',
      status,
      startedAt: new Date(Date.now() - (count - i) * 120000).toISOString(),
      durationMs: status === 'error' ? randomBetween(500, 2000) : randomBetween(20, 300),
      attributes: { 'http.status_code': status === 'error' ? 500 : 200 },
      serviceName: SERVICES[i % SERVICES.length],
    });
  }
  return spans;
}

const MOCK_TRACES: Map<string, TraceSpan[]> = new Map();
for (let i = 0; i < 20; i++) {
  const traceId = randomId('trace');
  MOCK_TRACES.set(traceId, generateSpans(traceId, 6 + Math.floor(Math.random() * 8)));
}

export class TraceVisualizationEngine {
  getTrace(traceId: string): TraceSpan[] {
    return MOCK_TRACES.get(traceId) ?? generateSpans(traceId, 8);
  }

  getTraceTree(traceId: string): TraceTree {
    const spans = this.getTrace(traceId);
    const spanMap = new Map<string, TraceSpan & { children: TraceSpan[] }>();
    for (const span of spans) {
      spanMap.set(span.spanId, { ...span, children: [] });
    }

    let root: (TraceSpan & { children: TraceSpan[] }) | undefined;
    for (const span of spans) {
      const node = spanMap.get(span.spanId)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        spanMap.get(span.parentSpanId)!.children.push(node);
      } else {
        root = node;
      }
    }

    if (!root) {
      root = spans.length > 0 ? { ...spans[0], children: [] } : { spanId: randomId('span'), traceId, name: 'root', kind: 'server', status: 'unset', startedAt: new Date().toISOString(), durationMs: 0, serviceName: 'unknown', children: [] };
    }

    const buildTree = (node: TraceSpan & { children: TraceSpan[] }, depth: number = 0): TraceTree => {
      const totalDurationMs = node.durationMs + node.children.reduce((s, c) => s + c.durationMs, 0);
      return {
        traceId,
        rootSpan: node,
        children: node.children.map((c) => buildTree(c, depth + 1)),
        depth,
        totalDurationMs,
      };
    };

    return buildTree(root);
  }

  searchTraces(service?: string, minDurationMs?: number): TraceSearchResult[] {
    const results: TraceSearchResult[] = [];
    for (const [traceId, spans] of MOCK_TRACES) {
      const filtered = service ? spans.filter((s) => s.serviceName === service) : spans;
      if (filtered.length === 0 && service) continue;
      const duration = filtered.reduce((s, sp) => s + sp.durationMs, 0);
      const errors = filtered.filter((s) => s.status === 'error').length;
      if (minDurationMs !== undefined && duration < minDurationMs) continue;
      results.push({
        traceId,
        service: service ?? filtered[0]?.serviceName ?? 'unknown',
        spanCount: spans.length,
        durationMs: Math.round(duration),
        errorCount: errors,
        startedAt: spans[0]?.startedAt ?? new Date().toISOString(),
      });
    }
    return results.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getServiceLatency(): ServiceLatency[] {
    const latencyMap = new Map<string, { durations: number[]; errors: number; count: number }>();
    for (const spans of MOCK_TRACES.values()) {
      for (const span of spans) {
        const entry = latencyMap.get(span.serviceName) ?? { durations: [], errors: 0, count: 0 };
        entry.durations.push(span.durationMs);
        entry.count += 1;
        if (span.status === 'error') entry.errors += 1;
        latencyMap.set(span.serviceName, entry);
      }
    }

    return Array.from(latencyMap.entries()).map(([service, data]) => {
      const durations = data.durations.sort((a, b) => a - b);
      const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      const p99Index = Math.max(0, Math.floor(durations.length * 0.99) - 1);
      const p99 = durations[p99Index] ?? avg;
      return {
        service,
        avgLatencyMs: Math.round(avg * 100) / 100,
        p99LatencyMs: Math.round(p99 * 100) / 100,
        spanCount: data.count,
        errorRate: data.count > 0 ? Math.round((data.errors / data.count) * 10000) / 100 : 0,
      };
    }).sort((a, b) => b.avgLatencyMs - a.avgLatencyMs);
  }

  getServices(): string[] {
    return [...SERVICES];
  }
}
