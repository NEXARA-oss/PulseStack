/**
 * Infrastructure Capacity Forecast Engine
 *
 * Analyzes historical resource usage and generates capacity forecasts
 * to help teams plan scaling before performance issues occur.
 */

export type ResourceType = 'cpu' | 'memory' | 'disk';

export type ForecastPoint = {
  timestamp: string;
  value: number;
  confidence: number;
};

export type CapacityWarning = {
  id: string;
  resource: ResourceType;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  forecastedAt: string;
  threshold: number;
  predictedValue: number;
};

export type DiskGrowth = {
  service: string;
  currentGB: number;
  forecastedGB: number;
  daysUntilFull: number;
  growthRateGBPerDay: number;
};

export type ForecastReport = {
  cpu: { current: number; forecast7d: number; forecast30d: number; warning?: CapacityWarning };
  memory: { current: number; forecast7d: number; forecast30d: number; warning?: CapacityWarning };
  disk: { current: number; forecast7d: number; forecast30d: number; growth: DiskGrowth[] };
};

const SERVICES = ['pulse-runtime', 'pulse-gateway', 'pulse-graph', 'pulse-metrics', 'pulse-trace', 'pulse-events'];

function generateHistory(days = 30, base = 50, variance = 20, trend = 0.1): number[] {
  const history: number[] = [];
  for (let i = days; i >= 0; i--) {
    const trendValue = trend * (days - i);
    history.push(Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance + trendValue)));
  }
  return history;
}

function forecast(history: number[], days: number): number[] {
  const last = history[history.length - 1];
  const trend = history.length > 1 ? (history[history.length - 1] - history[0]) / history.length : 0;
  const forecast: number[] = [];
  for (let i = 1; i <= days; i++) {
    forecast.push(Math.max(0, Math.min(100, last + trend * i)));
  }
  return forecast;
}

export class CapacityForecastEngine {
  private cpuHistory = generateHistory(30, 45, 15, 0.3);
  private memoryHistory = generateHistory(30, 60, 20, 0.2);
  private diskHistory: Map<string, number[]> = new Map();
  private warnings: CapacityWarning[] = [];

  constructor() {
    for (const service of SERVICES) {
      this.diskHistory.set(service, generateHistory(30, 55, 10, 0.15));
    }
  }

  getForecast(): ForecastReport {
    const cpu7 = forecast(this.cpuHistory, 7);
    const cpu30 = forecast(this.cpuHistory, 30);
    const mem7 = forecast(this.memoryHistory, 7);
    const mem30 = forecast(this.memoryHistory, 30);

    const diskGrowth = SERVICES.map((service) => {
      const history = this.diskHistory.get(service) ?? [];
      const current = history[history.length - 1] ?? 50;
      const f30 = forecast(history, 30);
      const predicted = f30[f30.length - 1];
      const daysUntilFull = predicted >= 100 ? Math.max(1, Math.round((100 - current) / Math.max(0.01, predicted - current))) : 999;
      return {
        service,
        currentGB: Math.round(current * 10) / 10,
        forecastedGB: Math.round(predicted * 10) / 10,
        daysUntilFull,
        growthRateGBPerDay: Math.round((predicted - current) / 30 * 100) / 100,
      };
    }).sort((a, b) => a.daysUntilFull - b.daysUntilFull);

    let cpuWarning: CapacityWarning | undefined;
    if (cpu30[cpu30.length - 1] > 85) {
      cpuWarning = {
        id: 'warn-cpu',
        resource: 'cpu',
        service: 'pulse-gateway',
        severity: cpu30[cpu30.length - 1] > 95 ? 'critical' : 'high',
        message: `CPU usage forecast to reach ${cpu30[cpu30.length - 1].toFixed(1)}% in 30 days`,
        forecastedAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        threshold: 85,
        predictedValue: Math.round(cpu30[cpu30.length - 1] * 100) / 100,
      };
    }

    let memWarning: CapacityWarning | undefined;
    if (mem30[mem30.length - 1] > 80) {
      memWarning = {
        id: 'warn-mem',
        resource: 'memory',
        service: 'pulse-runtime',
        severity: mem30[mem30.length - 1] > 95 ? 'critical' : 'high',
        message: `Memory usage forecast to reach ${mem30[mem30.length - 1].toFixed(1)}% in 30 days`,
        forecastedAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        threshold: 80,
        predictedValue: Math.round(mem30[mem30.length - 1] * 100) / 100,
      };
    }

    this.warnings = [cpuWarning, memWarning].filter((w): w is CapacityWarning => Boolean(w));

    return {
      cpu: { current: this.cpuHistory[this.cpuHistory.length - 1], forecast7d: cpu7[cpu7.length - 1], forecast30d: cpu30[cpu30.length - 1], warning: cpuWarning },
      memory: { current: this.memoryHistory[this.memoryHistory.length - 1], forecast7d: mem7[mem7.length - 1], forecast30d: mem30[mem30.length - 1], warning: memWarning },
      disk: { current: diskGrowth[0]?.currentGB ?? 50, forecast7d: diskGrowth[0]?.forecastedGB ?? 50, forecast30d: diskGrowth[0]?.forecastedGB ?? 50, growth: diskGrowth },
    };
  }

  getWarnings(): CapacityWarning[] {
    return [...this.warnings];
  }

  getServices(): string[] {
    return [...SERVICES];
  }
}
