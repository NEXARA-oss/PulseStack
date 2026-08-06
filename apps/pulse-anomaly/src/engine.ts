/**
 * AI-Based Infrastructure Anomaly Detection Engine
 *
 * Uses statistical methods (Z-score, IQR, moving averages, EWMA)
 * to detect anomalies in infrastructure metrics without requiring
 * ML model training or external dependencies.
 */

export type MetricType = 'cpu' | 'memory' | 'network' | 'disk' | 'latency' | 'error_rate' | 'throughput';

export type MetricSample = {
  timestamp: number;
  value: number;
  type: MetricType;
  source: string;
  tags?: Record<string, string>;
};

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyResult = {
  id: string;
  type: MetricType;
  source: string;
  severity: AnomalySeverity;
  score: number; // 0-1 confidence score
  currentValue: number;
  baselineValue: number;
  deviation: number; // standard deviations from baseline
  trend: 'spike' | 'drop' | 'sustained_high' | 'sustained_low' | 'volatile';
  message: string;
  insight: string;
  detectedAt: number;
  samples: MetricSample[];
  tags?: Record<string, string>;
};

export type AnomalyConfig = {
  zScoreThreshold: number;       // default: 3.0
  iqrMultiplier: number;         // default: 1.5
  minSamples: number;            // default: 10
  windowSize: number;            // sliding window in ms, default: 3600000 (1h)
  trendWindowSize: number;       // trend detection window, default: 300000 (5min)
  volatilityThreshold: number;   // coefficient of variation threshold, default: 0.5
  sustainedThreshold: number;    // consecutive anomalous points, default: 3
};

export type AnomalySummary = {
  totalAnomalies: number;
  bySeverity: Record<AnomalySeverity, number>;
  byType: Record<MetricType, number>;
  activeAlerts: AnomalyResult[];
  topInsights: string[];
  healthScore: number; // 0-100
  lastUpdated: number;
};

const DEFAULT_CONFIG: AnomalyConfig = {
  zScoreThreshold: 3.0,
  iqrMultiplier: 1.5,
  minSamples: 10,
  windowSize: 3600000, // 1 hour
  trendWindowSize: 300000, // 5 minutes
  volatilityThreshold: 0.5,
  sustainedThreshold: 3,
};

/**
 * AnomalyDetectionEngine - Statistical anomaly detection for infrastructure metrics.
 */
export class AnomalyDetectionEngine {
  private config: AnomalyConfig;
  private history: Map<string, MetricSample[]> = new Map();
  private anomalies: AnomalyResult[] = [];
  private readonly maxHistoryPoints = 10000;

  constructor(config: Partial<AnomalyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ingest a new metric sample and run detection.
   */
  ingest(sample: MetricSample): AnomalyResult | null {
    const key = `${sample.type}:${sample.source}`;
    const series = this.history.get(key) ?? [];
    series.push(sample);

    // Trim history
    if (series.length > this.maxHistoryPoints) {
      series.splice(0, series.length - this.maxHistoryPoints);
    }
    this.history.set(key, series);

    return this.detect(key, series, sample);
  }

  /**
   * Ingest multiple samples at once.
   */
  ingestBatch(samples: MetricSample[]): AnomalyResult[] {
    const results: AnomalyResult[] = [];
    for (const sample of samples) {
      const result = this.ingest(sample);
      if (result) results.push(result);
    }
    return results;
  }

  /**
   * Get all detected anomalies.
   */
  getAnomalies(): AnomalyResult[] {
    return [...this.anomalies];
  }

  /**
   * Get recent anomalies within a time window.
   */
  getRecentAnomalies(windowMs: number = 300000): AnomalyResult[] {
    const cutoff = Date.now() - windowMs;
    return this.anomalies.filter((a) => a.detectedAt >= cutoff);
  }

  /**
   * Get active alerts (high/critical severity within last 15 minutes).
   */
  getActiveAlerts(): AnomalyResult[] {
    const cutoff = Date.now() - 900000; // 15 minutes
    return this.anomalies.filter(
      (a) => a.detectedAt >= cutoff && (a.severity === 'high' || a.severity === 'critical'),
    );
  }

  /**
   * Get a summary of current anomaly state.
   */
  getSummary(): AnomalySummary {
    const activeAlerts = this.getActiveAlerts();
    const bySeverity: Record<AnomalySeverity, number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };
    const byType: Record<MetricType, number> = {
      cpu: 0, memory: 0, network: 0, disk: 0, latency: 0, error_rate: 0, throughput: 0,
    };

    for (const anomaly of this.anomalies) {
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] ?? 0) + 1;
      byType[anomaly.type] = (byType[anomaly.type] ?? 0) + 1;
    }

    // Calculate health score (0-100)
    const severityWeights: Record<AnomalySeverity, number> = {
      critical: 25, high: 15, medium: 8, low: 3,
    };
    const totalPenalty = activeAlerts.reduce(
      (sum, a) => sum + (severityWeights[a.severity] ?? 0), 0,
    );
    const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));

    // Generate top insights
    const topInsights = this.generateInsights(activeAlerts);

    return {
      totalAnomalies: this.anomalies.length,
      bySeverity,
      byType,
      activeAlerts,
      topInsights,
      healthScore,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Clear old history and anomalies.
   */
  prune(maxAgeMs: number = 86400000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [key, series] of this.history.entries()) {
      const filtered = series.filter((s) => s.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.history.delete(key);
      } else {
        this.history.set(key, filtered);
      }
    }
    this.anomalies = this.anomalies.filter((a) => a.detectedAt >= cutoff);
  }

  /**
   * Core detection logic using multiple statistical methods.
   */
  private detect(key: string, series: MetricSample[], latest: MetricSample): AnomalyResult | null {
    if (series.length < this.config.minSamples) return null;

    const windowStart = Date.now() - this.config.windowSize;
    const windowedSamples = series.filter((s) => s.timestamp >= windowStart);

    if (windowedSamples.length < this.config.minSamples) return null;

    const values = windowedSamples.map((s) => s.value);
    const { mean, stdDev } = this.computeStats(values);
    const q1 = this.percentile(values, 25);
    const q3 = this.percentile(values, 75);
    const iqr = q3 - q1;

    const currentValue = latest.value;

    // Z-Score test
    const zScore = stdDev > 0 ? Math.abs((currentValue - mean) / stdDev) : 0;

    // IQR test
    const iqrLower = q1 - this.config.iqrMultiplier * iqr;
    const iqrUpper = q3 + this.config.iqrMultiplier * iqr;
    const isIqrAnomaly = currentValue < iqrLower || currentValue > iqrUpper;

    // Combined score
    const maxZScore = Math.max(zScore, isIqrAnomaly ? this.config.zScoreThreshold * 0.8 : 0);
    const isAnomaly = maxZScore >= this.config.zScoreThreshold || isIqrAnomaly;

    if (!isAnomaly) return null;

    // Trend detection
    const trend = this.detectTrend(windowedSamples);

    // Check for sustained anomaly
    const isSustained = this.checkSustained(windowedSamples, currentValue);

    // Determine severity
    const severity = this.calculateSeverity(maxZScore, trend, isSustained);

    // Confidence score (0-1)
    const score = Math.min(1, maxZScore / 6);

    // Generate human-readable insight
    const insight = this.generateInsight(latest.type, trend, currentValue, mean, severity);

    // Generate message
    const direction = currentValue > mean ? 'elevated' : 'reduced';
    const message = `${latest.type.toUpperCase()} ${direction} on ${latest.source}: ${currentValue.toFixed(1)} vs baseline ${mean.toFixed(1)} (${(maxZScore).toFixed(1)}σ)`;

    const anomaly: AnomalyResult = {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: latest.type,
      source: latest.source,
      severity,
      score,
      currentValue,
      baselineValue: mean,
      deviation: maxZScore,
      trend,
      message,
      insight,
      detectedAt: Date.now(),
      samples: windowedSamples.slice(-20), // last 20 samples for context
      tags: latest.tags,
    };

    this.anomalies.push(anomaly);
    return anomaly;
  }

  private computeStats(values: number[]): { mean: number; stdDev: number } {
    const n = values.length;
    if (n === 0) return { mean: 0, stdDev: 0 };
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    return { mean, stdDev: Math.sqrt(variance) };
  }

  private percentile(sortedValues: number[], p: number): number {
    const values = [...sortedValues].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  private detectTrend(samples: MetricSample[]): AnomalyResult['trend'] {
    if (samples.length < 5) return 'spike';

    const recent = samples.slice(-Math.min(samples.length, 10));
    const values = recent.map((s) => s.value);
    const { mean } = this.computeStats(values);

    // Check volatility
    const cv = this.computeStats(values).stdDev / (mean || 1);
    if (cv > this.config.volatilityThreshold) return 'volatile';

    // Check direction
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstMean = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const change = (secondMean - firstMean) / (firstMean || 1);

    if (change > 0.1) return 'sustained_high';
    if (change < -0.1) return 'sustained_low';
    if (values[values.length - 1] > mean * 1.5) return 'spike';
    if (values[values.length - 1] < mean * 0.5) return 'drop';

    return 'spike';
  }

  private checkSustained(samples: MetricSample[], currentValue: number): boolean {
    const recent = samples.slice(-this.config.sustainedThreshold);
    if (recent.length < this.config.sustainedThreshold) return false;

    const { mean, stdDev } = this.computeStats(recent.map((s) => s.value));
    return recent.every((s) => Math.abs(s.value - mean) > stdDev * 1.5);
  }

  private calculateSeverity(zScore: number, trend: AnomalyResult['trend'], sustained: boolean): AnomalySeverity {
    const sustainedBonus = sustained ? 1 : 0;
    const volatilePenalty = trend === 'volatile' ? -0.5 : 0;
    const effectiveScore = zScore + sustainedBonus + volatilePenalty;

    if (effectiveScore >= 5) return 'critical';
    if (effectiveScore >= 4) return 'high';
    if (effectiveScore >= 3) return 'medium';
    return 'low';
  }

  private generateInsight(type: MetricType, trend: AnomalyResult['trend'], current: number, baseline: number, severity: AnomalySeverity): string {
    const pctChange = baseline > 0 ? ((current - baseline) / baseline * 100).toFixed(1) : 'N/A';
    const severityPrefix = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '🔍';

    const insights: Record<MetricType, string[]> = {
      cpu: [
        `${severityPrefix} CPU ${trend === 'sustained_high' ? 'sustained spike' : 'spike'}: ${pctChange}% above baseline. Possible runaway process or insufficient capacity.`,
        `${severityPrefix} CPU usage pattern suggests ${trend === 'volatile' ? 'thrashing' : 'load imbalance'}. Consider reviewing process allocation.`,
      ],
      memory: [
        `${severityPrefix} Memory pressure detected: ${pctChange}% above normal. Potential memory leak or increased workload.`,
        `${severityPrefix} Unusual memory pattern: ${trend === 'sustained_high' ? 'gradual increase suggests leak' : 'sudden spike suggests allocation burst'}.`,
      ],
      network: [
        `${severityPrefix} Network ${trend === 'sustained_high' ? 'throughput surge' : 'anomaly'}: ${pctChange}% deviation. Possible DDoS or data pipeline issue.`,
        `${severityPrefix} Network traffic pattern changed: ${trend === 'drop' ? 'possible connectivity issue' : 'unexpected load'}.`,
      ],
      disk: [
        `${severityPrefix} Disk I/O ${trend === 'sustained_high' ? 'sustained high' : 'spike'}: ${pctChange}% above baseline. Check for disk-intensive operations.`,
        `${severityPrefix} Disk usage anomaly detected. ${trend === 'sustained_high' ? 'Possible log flood or data growth' : 'Check storage subsystem'}.`,
      ],
      latency: [
        `${severityPrefix} Latency spike: ${pctChange}% increase. Service degradation or resource contention likely.`,
        `${severityPrefix} Response time degradation detected. ${trend === 'sustained_high' ? 'Persistent issue requires investigation' : 'Transient spike may resolve automatically'}.`,
      ],
      error_rate: [
        `${severityPrefix} Error rate surge: ${pctChange}% above normal. ${severity === 'critical' ? 'Immediate investigation required' : 'Monitor closely for escalation'}.`,
        `${severityPrefix} Elevated error rate detected. Check recent deployments and upstream dependencies.`,
      ],
      throughput: [
        `${severityPrefix} Throughput ${trend === 'drop' ? 'drop' : 'surge'}: ${pctChange}% deviation. ${trend === 'drop' ? 'Possible bottleneck or service issue' : 'Scaling may be needed'}.`,
        `${severityPrefix} Unusual throughput pattern detected. Review traffic sources and capacity planning.`,
      ],
    };

    const typeInsights = insights[type] ?? [`${severityPrefix} Anomaly detected in ${type}: ${pctChange}% deviation from baseline.`];
    return typeInsights[Math.floor(Math.random() * typeInsights.length)];
  }

  private generateInsights(alerts: AnomalyResult[]): string[] {
    if (alerts.length === 0) return ['No active anomalies detected. System operating normally.'];

    const insights: string[] = [];
    const byType = new Map<MetricType, AnomalyResult[]>();

    for (const alert of alerts) {
      const existing = byType.get(alert.type) ?? [];
      existing.push(alert);
      byType.set(alert.type, existing);
    }

    for (const [type, typeAlerts] of byType) {
      const criticalCount = typeAlerts.filter((a) => a.severity === 'critical').length;
      const highCount = typeAlerts.filter((a) => a.severity === 'high').length;
      const sources = [...new Set(typeAlerts.map((a) => a.source))];

      if (criticalCount > 0) {
        insights.push(`🚨 ${criticalCount} critical ${type} anomalies on ${sources.join(', ')}. Immediate action recommended.`);
      }
      if (highCount > 0) {
        insights.push(`⚠️ ${highCount} high-severity ${type} alerts. ${sources.length} source(s) affected.`);
      }
    }

    // Add cross-metric insights
    const affectedTypes = [...byType.keys()];
    if (affectedTypes.length >= 3) {
      insights.push(`🔗 Multiple metrics affected (${affectedTypes.join(', ')}). Possible cascading failure or systemic issue.`);
    }

    return insights.slice(0, 5);
  }
}

/**
 * Mock data generator for testing the anomaly detection system.
 */
export function generateMockMetrics(count: number = 100): MetricSample[] {
  const types: MetricType[] = ['cpu', 'memory', 'network', 'disk', 'latency', 'error_rate', 'throughput'];
  const sources = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events', 'pulse-replay'];
  const now = Date.now();
  const samples: MetricSample[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];

    // Generate baseline with occasional anomalies
    let value: number;
    const isAnomaly = Math.random() < 0.08; // 8% chance of anomaly

    switch (type) {
      case 'cpu':
        value = isAnomaly ? 85 + Math.random() * 15 : 30 + Math.random() * 40;
        break;
      case 'memory':
        value = isAnomaly ? 80 + Math.random() * 20 : 40 + Math.random() * 30;
        break;
      case 'network':
        value = isAnomaly ? 900 + Math.random() * 100 : 200 + Math.random() * 400;
        break;
      case 'disk':
        value = isAnomaly ? 85 + Math.random() * 15 : 20 + Math.random() * 40;
        break;
      case 'latency':
        value = isAnomaly ? 800 + Math.random() * 1200 : 20 + Math.random() * 180;
        break;
      case 'error_rate':
        value = isAnomaly ? 8 + Math.random() * 12 : 0.1 + Math.random() * 2;
        break;
      case 'throughput':
        value = isAnomaly ? 50 + Math.random() * 30 : 200 + Math.random() * 300;
        break;
    }

    samples.push({
      timestamp: now - (count - i) * 60000, // 1 minute intervals
      value: Math.round(value * 100) / 100,
      type,
      source,
      tags: { environment: 'production', region: 'us-east-1' },
    });
  }

  return samples;
}