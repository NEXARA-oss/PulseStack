/**
 * Deployment Impact Analysis Engine
 *
 * Tracks deployments and correlates them with infrastructure metrics,
 * error spikes, and performance regressions.
 */

export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
export type RollbackIndicator = 'none' | 'in_progress' | 'completed' | 'failed';

export type Deployment = {
  id: string;
  service: string;
  environment: string;
  version: string;
  commit: string;
  status: DeploymentStatus;
  rollback: RollbackIndicator;
  deployedAt: string;
  completedAt?: string;
  deployedBy: string;
  metadata?: Record<string, unknown>;
};

export type DeploymentEvent = {
  id: string;
  deploymentId: string;
  type: 'started' | 'completed' | 'failed' | 'rolled_back';
  message: string;
  timestamp: string;
};

export type MetricSnapshot = {
  timestamp: string;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
  throughput: number;
};

export type ImpactAnalysis = {
  deploymentId: string;
  regressionDetected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedMetrics: string[];
  errorSpike: boolean;
  latencyIncrease: number;
  suggestedAction: string;
};

export type ServiceRegression = {
  service: string;
  metric: string;
  beforeValue: number;
  afterValue: number;
  delta: number;
  severity: string;
};

const DEFAULT_SERVICES = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];

const DEFAULT_DEPLOYMENTS: Deployment[] = [
  {
    id: 'deploy-001',
    service: 'pulse-gateway',
    environment: 'production',
    version: 'v2.4.1',
    commit: 'a1b2c3d',
    status: 'success',
    rollback: 'none',
    deployedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 2 + 120000).toISOString(),
    deployedBy: 'ci-bot',
  },
  {
    id: 'deploy-002',
    service: 'pulse-runtime',
    environment: 'production',
    version: 'v1.8.0',
    commit: 'e4f5g6h',
    status: 'failed',
    rollback: 'completed',
    deployedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000 + 180000).toISOString(),
    deployedBy: 'ci-bot',
  },
  {
    id: 'deploy-003',
    service: 'pulse-metrics',
    environment: 'staging',
    version: 'v3.1.2',
    commit: 'i7j8k9l',
    status: 'success',
    rollback: 'none',
    deployedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 4 + 60000).toISOString(),
    deployedBy: 'alice',
  },
];

const DEFAULT_EVENTS: DeploymentEvent[] = [
  {
    id: 'evt-001',
    deploymentId: 'deploy-001',
    type: 'started',
    message: 'Deployment initiated',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'evt-002',
    deploymentId: 'deploy-001',
    type: 'completed',
    message: 'Deployment completed successfully',
    timestamp: new Date(Date.now() - 86400000 * 2 + 120000).toISOString(),
  },
  {
    id: 'evt-003',
    deploymentId: 'deploy-002',
    type: 'started',
    message: 'Deployment initiated',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'evt-004',
    deploymentId: 'deploy-002',
    type: 'failed',
    message: 'Health check failed after deployment',
    timestamp: new Date(Date.now() - 86400000 + 180000).toISOString(),
  },
  {
    id: 'evt-005',
    deploymentId: 'deploy-002',
    type: 'rolled_back',
    message: 'Automatic rollback triggered',
    timestamp: new Date(Date.now() - 86400000 + 300000).toISOString(),
  },
];

const DEFAULT_METRICS: MetricSnapshot[] = Array.from({ length: 20 }, (_, i) => ({
  timestamp: new Date(Date.now() - (20 - i) * 3600000).toISOString(),
  cpu: 30 + Math.random() * 40 + (i > 15 ? 20 : 0),
  memory: 40 + Math.random() * 30 + (i > 15 ? 15 : 0),
  latency: 50 + Math.random() * 100 + (i > 15 ? 150 : 0),
  errorRate: 0.1 + Math.random() * 0.5 + (i > 15 ? 2 : 0),
  throughput: 500 + Math.random() * 300 - (i > 15 ? 200 : 0),
}));

export class DeploymentEngine {
  private deployments: Deployment[] = [...DEFAULT_DEPLOYMENTS];
  private events: DeploymentEvent[] = [...DEFAULT_EVENTS];
  private metrics: MetricSnapshot[] = [...DEFAULT_METRICS];

  getDeployments(service?: string, environment?: string): Deployment[] {
    return this.deployments.filter((d) => {
      if (service && d.service !== service) return false;
      if (environment && d.environment !== environment) return false;
      return true;
    });
  }

  getDeployment(id: string): Deployment | undefined {
    return this.deployments.find((d) => d.id === id);
  }

  getEvents(deploymentId: string): DeploymentEvent[] {
    return this.events.filter((e) => e.deploymentId === deploymentId).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  getMetrics(deploymentId: string, windowHours: number = 24): MetricSnapshot[] {
    const deployment = this.getDeployment(deploymentId);
    if (!deployment) return [];
    const start = new Date(deployment.deployedAt).getTime() - windowHours * 3600000;
    return this.metrics.filter((m) => new Date(m.timestamp).getTime() >= start);
  }

  analyzeImpact(deploymentId: string): ImpactAnalysis {
    const deployment = this.getDeployment(deploymentId);
    if (!deployment) {
      return {
        deploymentId,
        regressionDetected: false,
        severity: 'low',
        affectedMetrics: [],
        errorSpike: false,
        latencyIncrease: 0,
        suggestedAction: 'No deployment found',
      };
    }

    const metrics = this.getMetrics(deploymentId);
    const recent = metrics.slice(-6);
    const baseline = metrics.slice(0, 6);

    const recentErrorRate = recent.reduce((s, m) => s + m.errorRate, 0) / (recent.length || 1);
    const baselineErrorRate = baseline.reduce((s, m) => s + m.errorRate, 0) / (baseline.length || 1);
    const recentLatency = recent.reduce((s, m) => s + m.latency, 0) / (recent.length || 1);
    const baselineLatency = baseline.reduce((s, m) => s + m.latency, 0) / (baseline.length || 1);

    const errorSpike = recentErrorRate > baselineErrorRate * 2;
    const latencyIncrease = baselineLatency > 0 ? ((recentLatency - baselineLatency) / baselineLatency) * 100 : 0;
    const regressionDetected = errorSpike || latencyIncrease > 20;

    const affectedMetrics: string[] = [];
    if (errorSpike) affectedMetrics.push('error_rate');
    if (latencyIncrease > 20) affectedMetrics.push('latency');
    if (recent.some((m) => m.cpu > 80)) affectedMetrics.push('cpu');
    if (recent.some((m) => m.memory > 85)) affectedMetrics.push('memory');

    let severity: ImpactAnalysis['severity'] = 'low';
    if (regressionDetected) {
      severity = affectedMetrics.length > 2 ? 'critical' : affectedMetrics.length > 1 ? 'high' : 'medium';
    }

    const suggestedAction = deployment.rollback === 'completed'
      ? 'Rollback completed. Review deployment changes before retrying.'
      : regressionDetected
        ? 'Investigate affected metrics. Consider rolling back if severity is high.'
        : 'No significant regression detected.';

    return {
      deploymentId,
      regressionDetected,
      severity,
      affectedMetrics,
      errorSpike,
      latencyIncrease: Math.round(latencyIncrease),
      suggestedAction,
    };
  }

  getServices(): string[] {
    return [...DEFAULT_SERVICES];
  }

  getSummary() {
    const total = this.deployments.length;
    const failed = this.deployments.filter((d) => d.status === 'failed').length;
    const rolledBack = this.deployments.filter((d) => d.rollback === 'completed').length;
    const withRegressions = this.deployments.filter((d) => this.analyzeImpact(d.id).regressionDetected).length;

    return {
      totalDeployments: total,
      failedDeployments: failed,
      rolledBackDeployments: rolledBack,
      regressionsDetected: withRegressions,
      successRate: total > 0 ? Math.round(((total - failed) / total) * 100) : 100,
    };
  }
}
