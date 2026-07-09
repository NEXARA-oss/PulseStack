/**
 * SLO/SLA Compliance Engine
 *
 * Tracks Service Level Objectives (SLOs) and Service Level Agreements (SLAs)
 * across monitored services. Calculates uptime, error budgets, compliance
 * percentages, and generates monthly reports.
 */

export type SloTargetType = 'uptime' | 'latency_p99' | 'latency_p95' | 'error_rate' | 'success_rate' | 'throughput';

export type SloPeriod = '28d' | '30d' | '90d' | 'custom';

export type SloTarget = {
  id: string;
  service: string;
  type: SloTargetType;
  target: number; // e.g., 99.9 for uptime, 200 for latency ms
  operator: 'gte' | 'lte'; // greater-than-or-equal or less-than-or-equal
  period: SloPeriod;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  createdAt: string;
  updatedAt: string;
};

export type SloCompliance = {
  targetId: string;
  service: string;
  type: SloTargetType;
  target: number;
  operator: 'gte' | 'lte';
  currentValue: number;
  compliance: number; // 0-100 percentage
  status: 'compliant' | 'warning' | 'breached';
  period: SloPeriod;
  errorBudget: {
    total: number;
    consumed: number;
    remaining: number;
    remainingPercentage: number;
  };
  trend: 'improving' | 'stable' | 'degrading';
  description: string;
  severity: 'critical' | 'high' | 'medium';
};

export type MonthlyReport = {
  month: string;
  year: number;
  totalSLOs: number;
  compliant: number;
  warning: number;
  breached: number;
  overallCompliance: number;
  uptimeAverage: number;
  latencyP99Average: number;
  errorRateAverage: number;
  byService: Array<{
    service: string;
    compliance: number;
    sloCount: number;
  }>;
};

export type SloSummary = {
  totalTargets: number;
  compliantCount: number;
  warningCount: number;
  breachedCount: number;
  overallCompliance: number;
  uptimePercentage: number;
  errorBudgetHealth: number;
  complianceTrend: 'improving' | 'stable' | 'degrading';
  lastUpdated: string;
};

// Pre-defined SLO targets for PulseStack services
const DEFAULT_SLO_TARGETS: SloTarget[] = [
  {
    id: 'slo-runtime-uptime',
    service: 'pulse-runtime',
    type: 'uptime',
    target: 99.9,
    operator: 'gte',
    period: '30d',
    description: 'Runtime service uptime',
    severity: 'critical',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-runtime-latency',
    service: 'pulse-runtime',
    type: 'latency_p99',
    target: 500,
    operator: 'lte',
    period: '30d',
    description: 'P99 latency for execution requests',
    severity: 'high',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-gateway-uptime',
    service: 'pulse-gateway',
    type: 'uptime',
    target: 99.95,
    operator: 'gte',
    period: '30d',
    description: 'API Gateway uptime',
    severity: 'critical',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-gateway-latency',
    service: 'pulse-gateway',
    type: 'latency_p99',
    target: 200,
    operator: 'lte',
    period: '30d',
    description: 'P99 latency for API requests',
    severity: 'high',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-graph-success',
    service: 'pulse-graph',
    type: 'success_rate',
    target: 99.5,
    operator: 'gte',
    period: '30d',
    description: 'Graph query success rate',
    severity: 'high',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-graph-latency',
    service: 'pulse-graph',
    type: 'latency_p95',
    target: 1000,
    operator: 'lte',
    period: '30d',
    description: 'P95 latency for graph queries',
    severity: 'medium',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-metrics-uptime',
    service: 'pulse-metrics',
    type: 'uptime',
    target: 99.5,
    operator: 'gte',
    period: '30d',
    description: 'Metrics service uptime',
    severity: 'high',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-trace-error-rate',
    service: 'pulse-trace',
    type: 'error_rate',
    target: 1.0,
    operator: 'lte',
    period: '30d',
    description: 'Trace ingestion error rate',
    severity: 'medium',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-events-uptime',
    service: 'pulse-events',
    type: 'uptime',
    target: 99.9,
    operator: 'gte',
    period: '30d',
    description: 'Events service uptime',
    severity: 'critical',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'slo-runtime-error-rate',
    service: 'pulse-runtime',
    type: 'error_rate',
    target: 2.0,
    operator: 'lte',
    period: '30d',
    description: 'Runtime execution error rate',
    severity: 'medium',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SERVICE_NAMES = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events', 'pulse-replay', 'pulse-anomaly', 'pulse-slo'];

/**
 * SloComplianceEngine - Tracks and computes SLO/SLA compliance.
 */
export class SloComplianceEngine {
  private targets: SloTarget[] = [...DEFAULT_SLO_TARGETS];
  private simulatedHistory: Map<string, number[]> = new Map();

  constructor() {
    this.initializeSimulatedData();
  }

  /**
   * Get all configured SLO targets.
   */
  getTargets(): SloTarget[] {
    return [...this.targets];
  }

  /**
   * Get targets filtered by service.
   */
  getTargetsByService(service: string): SloTarget[] {
    return this.targets.filter((t) => t.service === service);
  }

  /**
   * Add or update an SLO target.
   */
  upsertTarget(target: SloTarget): SloTarget {
    const idx = this.targets.findIndex((t) => t.id === target.id);
    if (idx >= 0) {
      this.targets[idx] = { ...target, updatedAt: new Date().toISOString() };
    } else {
      this.targets.push({
        ...target,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return target;
  }

  /**
   * Delete an SLO target.
   */
  deleteTarget(id: string): boolean {
    const len = this.targets.length;
    this.targets = this.targets.filter((t) => t.id !== id);
    return this.targets.length < len;
  }

  /**
   * Compute current compliance for all targets.
   */
  getCompliance(): SloCompliance[] {
    return this.targets.map((target) => this.computeCompliance(target));
  }

  /**
   * Get compliance filtered by service.
   */
  getComplianceByService(service: string): SloCompliance[] {
    return this.getCompliance().filter((c) => c.service === service);
  }

  /**
   * Get summary dashboard data.
   */
  getSummary(): SloSummary {
    const compliance = this.getCompliance();
    const compliant = compliance.filter((c) => c.status === 'compliant').length;
    const warning = compliance.filter((c) => c.status === 'warning').length;
    const breached = compliance.filter((c) => c.status === 'breached').length;
    const overallCompliance = compliance.length > 0
      ? Math.round((compliant / compliance.length) * 100)
      : 100;

    // Average uptime across all services
    const uptimeTargets = compliance.filter((c) => c.type === 'uptime');
    const uptimePercentage = uptimeTargets.length > 0
      ? uptimeTargets.reduce((sum, c) => sum + c.currentValue, 0) / uptimeTargets.length
      : 100;

    // Error budget health (average remaining % across all targets)
    const errorBudgetHealth = compliance.length > 0
      ? compliance.reduce((sum, c) => sum + c.errorBudget.remainingPercentage, 0) / compliance.length
      : 100;

    // Determine trend
    const trend = this.computeTrend(compliance);

    return {
      totalTargets: this.targets.length,
      compliantCount: compliant,
      warningCount: warning,
      breachedCount: breached,
      overallCompliance,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      errorBudgetHealth: Math.round(errorBudgetHealth),
      complianceTrend: trend,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate monthly compliance report.
   */
  getMonthlyReport(month?: number, year?: number): MonthlyReport {
    const now = new Date();
    const reportMonth = month ?? now.getMonth();
    const reportYear = year ?? now.getFullYear();
    const compliance = this.getCompliance();

    const compliant = compliance.filter((c) => c.status === 'compliant').length;
    const warning = compliance.filter((c) => c.status === 'warning').length;
    const breached = compliance.filter((c) => c.status === 'breached').length;

    // Group by service
    const serviceMap = new Map<string, SloCompliance[]>();
    for (const c of compliance) {
      const existing = serviceMap.get(c.service) ?? [];
      existing.push(c);
      serviceMap.set(c.service, existing);
    }

    const byService = Array.from(serviceMap.entries()).map(([service, slos]) => ({
      service,
      compliance: slos.length > 0
        ? Math.round((slos.filter((s) => s.status === 'compliant').length / slos.length) * 100)
        : 100,
      sloCount: slos.length,
    }));

    const uptimeTargets = compliance.filter((c) => c.type === 'uptime');
    const latencyTargets = compliance.filter((c) => c.type === 'latency_p99');
    const errorRateTargets = compliance.filter((c) => c.type === 'error_rate');

    return {
      month: new Date(reportYear, reportMonth).toLocaleString('default', { month: 'long' }),
      year: reportYear,
      totalSLOs: this.targets.length,
      compliant,
      warning,
      breached,
      overallCompliance: compliance.length > 0
        ? Math.round((compliant / compliance.length) * 100)
        : 100,
      uptimeAverage: uptimeTargets.length > 0
        ? uptimeTargets.reduce((s, c) => s + c.currentValue, 0) / uptimeTargets.length
        : 100,
      latencyP99Average: latencyTargets.length > 0
        ? latencyTargets.reduce((s, c) => s + c.currentValue, 0) / latencyTargets.length
        : 0,
      errorRateAverage: errorRateTargets.length > 0
        ? errorRateTargets.reduce((s, c) => s + c.currentValue, 0) / errorRateTargets.length
        : 0,
      byService,
    };
  }

  /**
   * Get violation history.
   */
  getViolationHistory(days: number = 30): Array<{ date: string; service: string; type: SloTargetType; message: string; severity: string }> {
    const violations: Array<{ date: string; service: string; type: SloTargetType; message: string; severity: string }> = [];
    const now = Date.now();
    const dayMs = 86400000;

    for (let d = 0; d < days; d++) {
      // Randomly generate some violations for the simulation
      if (Math.random() < 0.12) {
        const target = this.targets[Math.floor(Math.random() * this.targets.length)];
        violations.push({
          date: new Date(now - d * dayMs).toISOString(),
          service: target.service,
          type: target.type,
          message: `${target.service} ${target.type.replace('_', ' ')} SLO ${Math.random() > 0.5 ? 'breached' : 'near-violation'}: ${(Math.random() * 5).toFixed(1)}% deviation`,
          severity: target.severity,
        });
      }
    }

    return violations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private computeCompliance(target: SloTarget): SloCompliance {
    const history = this.simulatedHistory.get(target.id) ?? [];
    const currentValue = history.length > 0 ? history[history.length - 1] : this.generateSimulatedValue(target);

    // Calculate compliance percentage
    let compliance: number;
    if (target.operator === 'gte') {
      compliance = Math.min(100, (currentValue / target.target) * 100);
    } else {
      // For lte (lower is better), invert the ratio
      compliance = Math.min(100, (target.target / Math.max(currentValue, 0.01)) * 100);
    }
    compliance = Math.round(Math.max(0, compliance));

    // Determine status
    let status: SloCompliance['status'];
    if (compliance >= 95) {
      status = 'compliant';
    } else if (compliance >= 80) {
      status = 'warning';
    } else {
      status = 'breached';
    }

    // Error budget
    const errorBudgetTotal = 100 - target.target;
    const errorBudgetConsumed = Math.max(0, errorBudgetTotal - (compliance - target.target));
    const errorBudgetRemaining = Math.max(0, errorBudgetTotal - errorBudgetConsumed);
    const remainingPercentage = errorBudgetTotal > 0 ? Math.round((errorBudgetRemaining / errorBudgetTotal) * 100) : 100;

    // Trend
    const trend = this.computeComplianceTrend(history);

    return {
      targetId: target.id,
      service: target.service,
      type: target.type,
      target: target.target,
      operator: target.operator,
      currentValue: Math.round(currentValue * 100) / 100,
      compliance,
      status,
      period: target.period,
      errorBudget: {
        total: Math.round(errorBudgetTotal * 100) / 100,
        consumed: Math.round(errorBudgetConsumed * 100) / 100,
        remaining: Math.round(errorBudgetRemaining * 100) / 100,
        remainingPercentage,
      },
      trend,
      description: target.description,
      severity: target.severity,
    };
  }

  private computeTrend(complianceList: SloCompliance[]): 'improving' | 'stable' | 'degrading' {
    const totalCompliance = complianceList.reduce((s, c) => s + c.compliance, 0) / complianceList.length;
    const prevCompliance = complianceList.reduce((s, c) => s + (c.currentValue - 5), 0) / complianceList.length; // Simulated previous period

    if (totalCompliance > prevCompliance * 1.02) return 'improving';
    if (totalCompliance < prevCompliance * 0.98) return 'degrading';
    return 'stable';
  }

  private computeComplianceTrend(history: number[]): 'improving' | 'stable' | 'degrading' {
    if (history.length < 5) return 'stable';
    const recent = history.slice(-10);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.05) return 'improving';
    if (secondAvg < firstAvg * 0.95) return 'degrading';
    return 'stable';
  }

  private initializeSimulatedData() {
    for (const target of this.targets) {
      const history: number[] = [];
      for (let i = 0; i < 30; i++) {
        history.push(this.generateSimulatedValue(target, i));
      }
      this.simulatedHistory.set(target.id, history);
    }
  }

  private generateSimulatedValue(target: SloTarget, index?: number): number {
    const baseDrift = index !== undefined ? Math.sin(index * 0.3) * 2 : 0;

    switch (target.type) {
      case 'uptime': {
        // Uptime is generally high 99.x%
        const base = target.target - 0.5 + Math.random() * 1.5 + baseDrift * 0.1;
        return Math.min(100, Math.max(95, base));
      }
      case 'latency_p99': {
        // Latency in ms - try to stay under target
        const base = target.target * (0.6 + Math.random() * 0.6) + baseDrift * 10;
        return Math.round(Math.max(10, base));
      }
      case 'latency_p95': {
        const base = target.target * (0.5 + Math.random() * 0.7) + baseDrift * 8;
        return Math.round(Math.max(10, base));
      }
      case 'error_rate': {
        // Error rate % - should be low
        const base = target.target * (0.3 + Math.random() * 0.8) + baseDrift * 0.1;
        return Math.round(Math.max(0, base) * 100) / 100;
      }
      case 'success_rate': {
        const base = target.target - 1 + Math.random() * 2 + baseDrift * 0.1;
        return Math.min(100, Math.max(90, base));
      }
      case 'throughput': {
        const base = target.target * (0.7 + Math.random() * 0.6) + baseDrift * 5;
        return Math.round(Math.max(0, base));
      }
      default:
        return target.target * (0.8 + Math.random() * 0.4);
    }
  }

  /**
   * Get available services.
   */
  getServices(): string[] {
    return [...new Set([...SERVICE_NAMES, ...this.targets.map((t) => t.service)])];
  }
}

/**
 * SLO metric display configuration.
 */
export const SLO_METRIC_CONFIG: Record<SloTargetType, { label: string; unit: string; description: string }> = {
  uptime: { label: 'Uptime', unit: '%', description: 'Service availability percentage' },
  latency_p99: { label: 'P99 Latency', unit: 'ms', description: '99th percentile response time' },
  latency_p95: { label: 'P95 Latency', unit: 'ms', description: '95th percentile response time' },
  error_rate: { label: 'Error Rate', unit: '%', description: 'Percentage of failed requests' },
  success_rate: { label: 'Success Rate', unit: '%', description: 'Percentage of successful requests' },
  throughput: { label: 'Throughput', unit: 'req/s', description: 'Requests per second' },
};