/**
 * Monitoring Configuration Version History Engine
 *
 * Maintains version history for monitoring configurations with rollback support.
 */

export type ConfigVersion = {
  id: string;
  version: number;
  name: string;
  description: string;
  author: string;
  config: Record<string, unknown>;
  createdAt: string;
  tags?: string[];
};

export type VersionDiff = {
  a: ConfigVersion;
  b: ConfigVersion;
  added: string[];
  removed: string[];
  modified: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
};

export type RestoreResult = {
  success: boolean;
  restoredVersion: ConfigVersion;
  message: string;
};

const DEFAULT_VERSIONS: ConfigVersion[] = [
  {
    id: 'ver-001',
    version: 1,
    name: 'Baseline',
    description: 'Initial monitoring configuration.',
    author: 'ops-team',
    config: {
      slo_targets: [{ id: 'slo-1', target: 99.9, operator: 'gte' }],
      alert_rules: [{ id: 'rule-1', threshold: 90 }],
      dashboards: ['infrastructure'],
    },
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    tags: ['baseline'],
  },
  {
    id: 'ver-002',
    version: 2,
    name: 'Added Latency Targets',
    description: 'Introduced P99 latency targets.',
    author: 'sre-team',
    config: {
      slo_targets: [
        { id: 'slo-1', target: 99.9, operator: 'gte' },
        { id: 'slo-2', target: 200, operator: 'lte' },
      ],
      alert_rules: [{ id: 'rule-1', threshold: 90 }, { id: 'rule-2', threshold: 500 }],
      dashboards: ['infrastructure', 'application'],
    },
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    tags: ['latency'],
  },
  {
    id: 'ver-003',
    version: 3,
    name: 'Cost Optimization',
    description: 'Added cost monitoring and token budget alerts.',
    author: 'finops',
    config: {
      slo_targets: [
        { id: 'slo-1', target: 99.9, operator: 'gte' },
        { id: 'slo-2', target: 200, operator: 'lte' },
      ],
      alert_rules: [{ id: 'rule-1', threshold: 90 }, { id: 'rule-2', threshold: 500 }, { id: 'rule-3', threshold: 1000 }],
      dashboards: ['infrastructure', 'application', 'cost'],
      budgets: [{ service: 'llm', monthly: 5000 }],
    },
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    tags: ['cost', 'budget'],
  },
];

export class ConfigVersionEngine {
  private versions: ConfigVersion[] = [...DEFAULT_VERSIONS];

  getVersions(): ConfigVersion[] {
    return [...this.versions].sort((a, b) => a.version - b.version);
  }

  getVersion(id: string): ConfigVersion | undefined {
    return this.versions.find((v) => v.id === id);
  }

  getVersionByNumber(version: number): ConfigVersion | undefined {
    return this.versions.find((v) => v.version === version);
  }

  createVersion(version: Omit<ConfigVersion, 'id' | 'version' | 'createdAt'>): ConfigVersion {
    const nextVersion = this.versions.length > 0 ? Math.max(...this.versions.map((v) => v.version)) + 1 : 1;
    const newVersion: ConfigVersion = {
      ...version,
      id: `ver-${Date.now()}`,
      version: nextVersion,
      createdAt: new Date().toISOString(),
    };
    this.versions.push(newVersion);
    return newVersion;
  }

  compareVersions(a: string, b: string): VersionDiff | null {
    const verA = this.getVersion(a);
    const verB = this.getVersion(b);
    if (!verA || !verB) return null;

    const allKeys = new Set([...Object.keys(verA.config), ...Object.keys(verB.config)]);
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ key: string; oldValue: unknown; newValue: unknown }> = [];

    for (const key of allKeys) {
      const inA = key in (verA.config as any);
      const inB = key in (verB.config as any);
      if (inA && !inB) removed.push(key);
      else if (!inA && inB) added.push(key);
      else if (JSON.stringify((verA.config as any)[key]) !== JSON.stringify((verB.config as any)[key])) {
        modified.push({ key, oldValue: (verA.config as any)[key], newValue: (verB.config as any)[key] });
      }
    }

    return { a: verA, b: verB, added, removed, modified };
  }

  restoreVersion(id: string): RestoreResult | null {
    const version = this.getVersion(id);
    if (!version) return null;
    return {
      success: true,
      restoredVersion: version,
      message: `Restored configuration to version ${version.version} (${version.name})`,
    };
  }

  getHistory() {
    return this.versions
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((v) => ({
        id: v.id,
        version: v.version,
        name: v.name,
        author: v.author,
        createdAt: v.createdAt,
        tagCount: v.tags?.length ?? 0,
      }));
  }
}
