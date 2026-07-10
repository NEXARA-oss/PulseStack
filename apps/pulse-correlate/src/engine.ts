/**
 * Metric Correlation Explorer Engine
 *
 * Compares multiple metrics over the same timeline and calculates
 * correlation coefficients to identify related resource behaviors.
 */

export type MetricName = 'cpu' | 'memory' | 'network' | 'disk' | 'latency' | 'error_rate' | 'throughput';

export type MetricSeries = {
  name: MetricName;
  source: string;
  points: Array<{ timestamp: string; value: number }>;
  color: string;
};

export type CorrelationData = {
  metricA: MetricName;
  metricB: MetricName;
  coefficient: number; // -1 to 1
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative' | 'none';
  sampleSize: number;
};

export type ComparisonView = {
  id: string;
  name: string;
  metrics: MetricName[];
  source: string;
};

const SERVICES = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];
const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee'];

function generateSeries(name: MetricName, source: string, count = 30): MetricSeries {
  const points = Array.from({ length: count }, (_, i) => {
    const base = name === 'cpu' ? 40 : name === 'memory' ? 50 : name === 'latency' ? 60 : name === 'error_rate' ? 1 : 200;
    const variance = name === 'error_rate' ? 2 : name === 'latency' ? 100 : base * 0.3;
    return {
      timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
      value: Math.max(0, base + (Math.random() - 0.5) * variance + Math.sin(i * 0.2) * (variance * 0.3)),
    };
  });

  return { name, source, points, color: COLORS[SERVICES.indexOf(source) % COLORS.length] };
}

export class CorrelationEngine {
  private series: MetricSeries[] = [];
  private views: ComparisonView[] = [
    { id: 'view-1', name: 'Default Comparison', metrics: ['cpu', 'memory', 'latency'], source: 'pulse-gateway' },
  ];

  constructor() {
    this.refreshSeries();
  }

  private refreshSeries() {
    this.series = [];
    for (const service of SERVICES) {
      for (const metric of ['cpu', 'memory', 'latency', 'error_rate', 'throughput'] as MetricName[]) {
        this.series.push(generateSeries(metric, service));
      }
    }
  }

  getSeries(metric?: MetricName, source?: string): MetricSeries[] {
    return this.series.filter((s) => {
      if (metric && s.name !== metric) return false;
      if (source && s.source !== source) return false;
      return true;
    });
  }

  computeCorrelation(metricA: MetricName, metricB: MetricName, source?: string): CorrelationData {
    const a = this.getSeries(metricA, source);
    const b = this.getSeries(metricB, source);
    const samples = Math.min(a[0]?.points.length ?? 0, b[0]?.points.length ?? 0);
    const valuesA = a[0]?.points.slice(-samples).map((p) => p.value) ?? [];
    const valuesB = b[0]?.points.slice(-samples).map((p) => p.value) ?? [];

    const coeff = this.pearson(valuesA, valuesB);
    const strength = Math.abs(coeff) > 0.7 ? 'strong' : Math.abs(coeff) > 0.4 ? 'moderate' : 'weak';
    const direction = coeff > 0.3 ? 'positive' : coeff < -0.3 ? 'negative' : 'none';

    return {
      metricA,
      metricB,
      coefficient: Math.round(coeff * 100) / 100,
      strength,
      direction,
      sampleSize: samples,
    };
  }

  computeAllCorrelations(metric: MetricName, source?: string): CorrelationData[] {
    const others = ['cpu', 'memory', 'network', 'disk', 'latency', 'error_rate', 'throughput'].filter((m) => m !== metric) as MetricName[];
    return others.map((m) => this.computeCorrelation(metric, m, source));
  }

  getMetrics(): MetricName[] {
    return ['cpu', 'memory', 'network', 'disk', 'latency', 'error_rate', 'throughput'];
  }

  getSources(): string[] {
    return [...SERVICES];
  }

  getViews(): ComparisonView[] {
    return [...this.views];
  }

  saveView(view: Omit<ComparisonView, 'id'>): ComparisonView {
    const newView = { ...view, id: `view-${Date.now()}` };
    this.views.push(newView);
    return newView;
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const meanX = mean(x);
  const meanY = mean(y);
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX) * Math.sqrt(denY);
  return den === 0 ? 0 : num / den;
}
