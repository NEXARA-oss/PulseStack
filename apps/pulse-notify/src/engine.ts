/**
 * Notification Channel Management Engine
 *
 * Manages notification channels (Email, Slack, Discord, Teams),
 * priority routing rules, and provides test notification capabilities.
 */

export type ChannelType = 'email' | 'slack' | 'discord' | 'teams' | 'webhook';

export type ChannelStatus = 'connected' | 'disconnected' | 'error';

export type ChannelPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotifyChannel = {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  status: ChannelStatus;
  config: ChannelConfig;
  priorityFilter: ChannelPriority[];
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastError?: string;
};

export type ChannelConfig = {
  // Email
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromAddress?: string;
  toAddresses?: string[];
  // Slack
  slackWebhookUrl?: string;
  slackChannel?: string;
  slackBotToken?: string;
  // Discord
  discordWebhookUrl?: string;
  discordChannel?: string;
  // Teams
  teamsWebhookUrl?: string;
  // Webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookTemplate?: string;
};

export type NotificationRule = {
  id: string;
  name: string;
  description: string;
  eventTypes: string[];
  channelIds: string[];
  priority: ChannelPriority;
  enabled: boolean;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type NotificationEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: ChannelPriority;
  source: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type TestResult = {
  success: boolean;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  message: string;
  durationMs: number;
  timestamp: string;
};

const DEFAULT_CHANNELS: NotifyChannel[] = [
  {
    id: 'ch-email-default',
    type: 'email',
    name: 'Email Notifications',
    enabled: true,
    status: 'disconnected',
    config: {
      fromAddress: 'alerts@pulsestack.io',
      toAddresses: ['ops@pulsestack.io', 'oncall@pulsestack.io'],
    },
    priorityFilter: ['critical', 'high'],
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ch-slack-ops',
    type: 'slack',
    name: 'Slack #ops-alerts',
    enabled: true,
    status: 'connected',
    config: {
      slackChannel: '#ops-alerts',
    },
    priorityFilter: ['critical', 'high', 'medium'],
    createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ch-slack-dev',
    type: 'slack',
    name: 'Slack #dev-monitoring',
    enabled: false,
    status: 'disconnected',
    config: {
      slackChannel: '#dev-monitoring',
    },
    priorityFilter: ['medium', 'low'],
    createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ch-discord',
    type: 'discord',
    name: 'Discord Alerts',
    enabled: true,
    status: 'connected',
    config: {
      discordChannel: '#alerts',
    },
    priorityFilter: ['critical', 'high'],
    createdAt: new Date(Date.now() - 75 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ch-teams',
    type: 'teams',
    name: 'Microsoft Teams',
    enabled: true,
    status: 'disconnected',
    config: {},
    priorityFilter: ['critical'],
    createdAt: new Date(Date.now() - 70 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ch-webhook-pagerduty',
    type: 'webhook',
    name: 'PagerDuty Webhook',
    enabled: true,
    status: 'connected',
    config: {
      webhookMethod: 'POST',
      webhookHeaders: { 'Content-Type': 'application/json' },
    },
    priorityFilter: ['critical', 'high'],
    createdAt: new Date(Date.now() - 65 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: 'rule-critical',
    name: 'Critical Alerts',
    description: 'Route critical severity alerts to all active channels',
    eventTypes: ['anomaly.critical', 'slo.breached', 'execution.failed'],
    channelIds: ['ch-slack-ops', 'ch-email-default', 'ch-discord', 'ch-webhook-pagerduty'],
    priority: 'critical',
    enabled: true,
    cooldownMinutes: 5,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-high',
    name: 'High Severity',
    description: 'High severity anomalies and SLO warnings',
    eventTypes: ['anomaly.high', 'slo.warning'],
    channelIds: ['ch-slack-ops', 'ch-email-default'],
    priority: 'high',
    enabled: true,
    cooldownMinutes: 10,
    createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-medium',
    name: 'Medium Alerts',
    description: 'Medium severity notifications to dev channels',
    eventTypes: ['anomaly.medium', 'slo.near-violation'],
    channelIds: ['ch-slack-dev'],
    priority: 'medium',
    enabled: false,
    cooldownMinutes: 30,
    createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const CHANNEL_TYPE_META: Record<ChannelType, { label: string; icon: string; color: string; description: string }> = {
  email: { label: 'Email', icon: '✉️', color: '#60a5fa', description: 'SMTP email delivery' },
  slack: { label: 'Slack', icon: '💬', color: '#7c3aed', description: 'Slack webhook integration' },
  discord: { label: 'Discord', icon: '🎮', color: '#5865f2', description: 'Discord webhook integration' },
  teams: { label: 'Microsoft Teams', icon: '🏢', color: '#6364ff', description: 'Teams webhook integration' },
  webhook: { label: 'Webhook', icon: '🔗', color: '#f97316', description: 'Custom HTTP webhook' },
};

/**
 * NotificationEngine - Manages channels, rules, and test notifications.
 */
export class NotificationEngine {
  private channels: NotifyChannel[] = [...DEFAULT_CHANNELS];
  private rules: NotificationRule[] = [...DEFAULT_RULES];
  private sentNotifications: Map<string, number> = new Map(); // eventType -> last sent timestamp

  constructor() {
    // Initialize sent notifications map
    this.rules.forEach((rule) => {
      rule.eventTypes.forEach((eventType) => {
        this.sentNotifications.set(eventType, 0);
      });
    });
  }

  // ─── Channel Management ──────────────────────────────────────────────

  getChannels(): NotifyChannel[] {
    return [...this.channels];
  }

  getChannel(id: string): NotifyChannel | undefined {
    return this.channels.find((c) => c.id === id);
  }

  getEnabledChannels(): NotifyChannel[] {
    return this.channels.filter((c) => c.enabled && c.status === 'connected');
  }

  getChannelsByPriority(priority: ChannelPriority): NotifyChannel[] {
    return this.getEnabledChannels().filter((c) =>
      c.priorityFilter.includes(priority),
    );
  }

  addChannel(channel: Omit<NotifyChannel, 'id' | 'createdAt' | 'updatedAt'>): NotifyChannel {
    const newChannel: NotifyChannel = {
      ...channel,
      id: `ch-${channel.type}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.channels.push(newChannel);
    return newChannel;
  }

  updateChannel(id: string, updates: Partial<NotifyChannel>): NotifyChannel | null {
    const idx = this.channels.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    this.channels[idx] = { ...this.channels[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.channels[idx];
  }

  deleteChannel(id: string): boolean {
    const len = this.channels.length;
    this.channels = this.channels.filter((c) => c.id !== id);
    this.rules = this.rules.map((r) => ({
      ...r,
      channelIds: r.channelIds.filter((cid) => cid !== id),
    }));
    return this.channels.length < len;
  }

  testChannel(id: string): TestResult {
    const channel = this.getChannel(id);
    if (!channel) {
      return {
        success: false,
        channelId: id,
        channelName: 'Unknown',
        channelType: 'webhook',
        message: 'Channel not found',
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    const delay = 200 + Math.random() * 800;
    const success = Math.random() > 0.15; // 85% success rate for simulation

    return {
      success,
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      message: success
        ? `Test notification sent successfully to ${channel.name}`
        : `Failed to deliver test notification to ${channel.name}: Connection timeout`,
      durationMs: delay,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Rule Management ─────────────────────────────────────────────────

  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  getRule(id: string): NotificationRule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  addRule(rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): NotificationRule {
    const newRule: NotificationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.rules.push(newRule);
    return newRule;
  }

  updateRule(id: string, updates: Partial<NotificationRule>): NotificationRule | null {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    this.rules[idx] = { ...this.rules[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.rules[idx];
  }

  deleteRule(id: string): boolean {
    const len = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== id);
    return this.rules.length < len;
  }

  // ─── Notification Dispatch ───────────────────────────────────────────

  /**
   * Evaluate an event and dispatch to matching channels based on rules.
   * Respects cooldown periods to prevent notification storms.
   */
  dispatch(event: NotificationEvent): { dispatched: boolean; channels: string[]; skipped: boolean } {
    const matchingRules = this.rules.filter(
      (r) =>
        r.enabled &&
        r.eventTypes.includes(event.type) &&
        r.priority === event.priority,
    );

    if (matchingRules.length === 0) {
      return { dispatched: false, channels: [], skipped: false };
    }

    const dispatchedChannels: string[] = [];
    let allSkipped = true;

    for (const rule of matchingRules) {
      // Check cooldown
      const lastSent = this.sentNotifications.get(event.type) ?? 0;
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      const now = Date.now();

      if (now - lastSent < cooldownMs) {
        continue; // Skip due to cooldown
      }

      // Find matching channels that support this priority
      const targetChannels = rule.channelIds
        .map((cid) => this.getChannel(cid))
        .filter((ch): ch is NotifyChannel =>
          ch !== undefined &&
          ch.enabled &&
          ch.status === 'connected' &&
          ch.priorityFilter.includes(event.priority),
        );

      if (targetChannels.length > 0) {
        this.sentNotifications.set(event.type, now);
        dispatchedChannels.push(...targetChannels.map((c) => c.name));
        allSkipped = false;
      }
    }

    return {
      dispatched: dispatchedChannels.length > 0,
      channels: dispatchedChannels,
      skipped: allSkipped,
    };
  }

  /**
   * Dispatch a test notification event through the engine.
   */
  dispatchTest(channelId: string): TestResult {
    const result = this.testChannel(channelId);

    // If successful, update the channel's lastTestedAt
    if (result.success) {
      this.updateChannel(channelId, { lastTestedAt: new Date().toISOString() });
    } else {
      this.updateChannel(channelId, {
        status: 'error',
        lastError: result.message,
        lastTestedAt: new Date().toISOString(),
      });
    }

    return result;
  }

  // ─── Statistics ──────────────────────────────────────────────────────

  getStats() {
    const total = this.channels.length;
    const connected = this.channels.filter((c) => c.status === 'connected').length;
    const disconnected = this.channels.filter((c) => c.status === 'disconnected').length;
    const error = this.channels.filter((c) => c.status === 'error').length;
    const enabled = this.channels.filter((c) => c.enabled).length;
    const rulesEnabled = this.rules.filter((r) => r.enabled).length;

    const byType: Record<ChannelType, number> = {
      email: 0, slack: 0, discord: 0, teams: 0, webhook: 0,
    };
    this.channels.forEach((c) => { byType[c.type]++; });

    return {
      totalChannels: total,
      connected,
      disconnected,
      error,
      enabled,
      rulesEnabled,
      byType,
      lastTestedAt: this.channels
        .filter((c) => c.lastTestedAt)
        .sort((a, b) => new Date(b.lastTestedAt!).getTime() - new Date(a.lastTestedAt!).getTime())[0]?.lastTestedAt ?? null,
    };
  }

  getChannelTypeMeta(): Record<ChannelType, { label: string; icon: string; color: string; description: string }> {
    return { ...CHANNEL_TYPE_META };
  }

  /**
   * Toggle channel enabled/disabled status.
   */
  toggleChannel(id: string): NotifyChannel | null {
    const channel = this.getChannel(id);
    if (!channel) return null;
    return this.updateChannel(id, { enabled: !channel.enabled });
  }

  /**
   * Toggle rule enabled/disabled status.
   */
  toggleRule(id: string): NotificationRule | null {
    const rule = this.getRule(id);
    if (!rule) return null;
    return this.updateRule(id, { enabled: !rule.enabled });
  }
}

export const CHANNEL_PRIORITY_LABELS: Record<ChannelPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};