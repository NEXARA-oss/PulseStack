/**
 * Dashboard Template Marketplace Engine
 *
 * Manages reusable dashboard templates, favorites, import/export,
 * and team-wide sharing.
 */

export type TemplateCategory = 'infrastructure' | 'application' | 'security' | 'cost' | 'custom';

export type DashboardTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  author: string;
  team: string;
  panels: Array<{ type: string; title: string; config: Record<string, unknown> }>;
  createdAt: string;
  updatedAt: string;
  downloads: number;
  rating: number;
  isFavorite: boolean;
  isTeamShared: boolean;
};

const DEFAULT_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'tpl-001',
    name: 'Infrastructure Overview',
    description: 'CPU, memory, disk, and network overview for all services.',
    category: 'infrastructure',
    author: 'ops-team',
    team: 'platform',
    panels: [
      { type: 'metric', title: 'CPU Usage', config: { metric: 'cpu', aggregation: 'avg' } },
      { type: 'metric', title: 'Memory Usage', config: { metric: 'memory', aggregation: 'avg' } },
      { type: 'metric', title: 'Network I/O', config: { metric: 'network', aggregation: 'sum' } },
    ],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    downloads: 142,
    rating: 4.5,
    isFavorite: false,
    isTeamShared: true,
  },
  {
    id: 'tpl-002',
    name: 'SLO Compliance Monitor',
    description: 'Track SLO targets, error budgets, and compliance trends.',
    category: 'application',
    author: 'sre-team',
    team: 'platform',
    panels: [
      { type: 'slo_summary', title: 'SLO Summary', config: {} },
      { type: 'slo_compliance', title: 'Compliance by Service', config: { groupBy: 'service' } },
      { type: 'slo_violations', title: 'Violations', config: { days: 30 } },
    ],
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    downloads: 89,
    rating: 4.2,
    isFavorite: true,
    isTeamShared: true,
  },
  {
    id: 'tpl-003',
    name: 'Cost Optimization',
    description: 'Token costs, resource utilization, and optimization suggestions.',
    category: 'cost',
    author: 'finops',
    team: 'finance',
    panels: [
      { type: 'usage', title: 'Token Usage', config: { groupBy: 'model' } },
      { type: 'cost', title: 'Estimated Cost', config: { currency: 'usd' } },
      { type: 'savings', title: 'Potential Savings', config: {} },
    ],
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    downloads: 56,
    rating: 3.9,
    isFavorite: false,
    isTeamShared: false,
  },
  {
    id: 'tpl-004',
    name: 'Security Audit',
    description: 'Security events, access logs, and anomaly detection alerts.',
    category: 'security',
    author: 'security-team',
    team: 'security',
    panels: [
      { type: 'security_events', title: 'Security Events', config: { severity: 'all' } },
      { type: 'access_logs', title: 'Access Logs', config: { limit: 100 } },
      { type: 'anomaly_alerts', title: 'Active Alerts', config: {} },
    ],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    downloads: 34,
    rating: 4.0,
    isFavorite: false,
    isTeamShared: true,
  },
];

export class TemplateMarketplaceEngine {
  private templates: DashboardTemplate[] = [...DEFAULT_TEMPLATES];
  private favorites = new Set<string>(DEFAULT_TEMPLATES.filter((t) => t.isFavorite).map((t) => t.id));

  getTemplates(category?: string, team?: string): DashboardTemplate[] {
    return this.templates.filter((t) => {
      if (category && t.category !== category) return false;
      if (team && t.team !== team && !t.isTeamShared) return false;
      return true;
    });
  }

  getTemplate(id: string): DashboardTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  createTemplate(template: Omit<DashboardTemplate, 'id' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'isFavorite'>): DashboardTemplate {
    const newTemplate: DashboardTemplate = {
      ...template,
      id: `tpl-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloads: 0,
      rating: 0,
      isFavorite: false,
    };
    this.templates.push(newTemplate);
    return newTemplate;
  }

  toggleFavorite(id: string): DashboardTemplate | null {
    const template = this.templates.find((t) => t.id === id);
    if (!template) return null;
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      template.isFavorite = false;
    } else {
      this.favorites.add(id);
      template.isFavorite = true;
    }
    template.updatedAt = new Date().toISOString();
    return template;
  }

  shareTemplate(id: string, team: string): DashboardTemplate | null {
    const template = this.templates.find((t) => t.id === id);
    if (!template) return null;
    template.team = team;
    template.isTeamShared = true;
    template.updatedAt = new Date().toISOString();
    return template;
  }

  incrementDownloads(id: string): boolean {
    const template = this.templates.find((t) => t.id === id);
    if (!template) return false;
    template.downloads += 1;
    return true;
  }

  getCategories(): TemplateCategory[] {
    return [...new Set(this.templates.map((t) => t.category))];
  }

  getTeams(): string[] {
    return [...new Set(this.templates.map((t) => t.team))];
  }

  getFavoriteCount(): number {
    return this.favorites.size;
  }
}
