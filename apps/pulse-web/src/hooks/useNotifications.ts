import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchJson, postJson } from '../lib/api';

export type ChannelType = 'email' | 'slack' | 'discord' | 'teams' | 'webhook';
export type ChannelStatus = 'connected' | 'disconnected' | 'error';
export type ChannelPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotifyChannel = {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  status: ChannelStatus;
  config: Record<string, unknown>;
  priorityFilter: ChannelPriority[];
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastError?: string;
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

export type TestResult = {
  success: boolean;
  channelId: string;
  channelName: string;
  channelType: ChannelType;
  message: string;
  durationMs: number;
  timestamp: string;
};

export type NotifyStats = {
  totalChannels: number;
  connected: number;
  disconnected: number;
  error: number;
  enabled: number;
  rulesEnabled: number;
  byType: Record<ChannelType, number>;
  lastTestedAt: string | null;
};

const STATUS_COLORS: Record<ChannelStatus, { bg: string; text: string; border: string }> = {
  connected: { bg: 'rgba(52,211,153,0.12)', text: '#34d399', border: 'rgba(52,211,153,0.3)' },
  disconnected: { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af', border: 'rgba(156,163,175,0.3)' },
  error: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

const CHANNEL_META: Record<ChannelType, { label: string; icon: string; color: string }> = {
  email: { label: 'Email', icon: '✉️', color: '#60a5fa' },
  slack: { label: 'Slack', icon: '💬', color: '#7c3aed' },
  discord: { label: 'Discord', icon: '🎮', color: '#5865f2' },
  teams: { label: 'Microsoft Teams', icon: '🏢', color: '#6364ff' },
  webhook: { label: 'Webhook', icon: '🔗', color: '#f97316' },
};

const PRIORITY_COLORS: Record<ChannelPriority, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#9ca3af',
};

export function useNotifications() {
  const [isSimulated, setIsSimulated] = useState(false);

  const channelsQuery = useQuery({
    queryKey: ['notify-channels'],
    queryFn: () => fetchJson<NotifyChannel[]>('/api/notify/channels'),
    refetchInterval: 15000,
    retry: 2,
  });

  const rulesQuery = useQuery({
    queryKey: ['notify-rules'],
    queryFn: () => fetchJson<NotificationRule[]>('/api/notify/rules'),
    refetchInterval: 15000,
    retry: 2,
  });

  const statsQuery = useQuery({
    queryKey: ['notify-stats'],
    queryFn: () => fetchJson<NotifyStats>('/api/notify/stats'),
    refetchInterval: 15000,
    retry: 2,
  });

  const testMutation = useMutation({
    mutationFn: (channelId: string) =>
      postJson<TestResult>(`/api/notify/channels/${channelId}/test`),
  });

  const toggleChannelMutation = useMutation({
    mutationFn: (channelId: string) =>
      postJson<NotifyChannel>(`/api/notify/channels/${channelId}/toggle`),
    onSuccess: () => channelsQuery.refetch(),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (ruleId: string) =>
      postJson<NotificationRule>(`/api/notify/rules/${ruleId}/toggle`),
    onSuccess: () => rulesQuery.refetch(),
  });

  // Simulated fallback data
  const simulated = generateSimulatedData();

  const channels: NotifyChannel[] = channelsQuery.data ?? (isSimulated ? simulated.channels : []);
  const rules: NotificationRule[] = rulesQuery.data ?? (isSimulated ? simulated.rules : []);
  const stats: NotifyStats = statsQuery.data ?? (isSimulated ? simulated.stats : {
    totalChannels: 0, connected: 0, disconnected: 0, error: 0, enabled: 0, rulesEnabled: 0,
    byType: { email: 0, slack: 0, discord: 0, teams: 0, webhook: 0 }, lastTestedAt: null,
  });

  return {
    channels,
    rules,
    stats,
    isLoading: channelsQuery.isLoading && !isSimulated,
    isError: channelsQuery.isError && !isSimulated,
    isSimulated,
    testChannel: (channelId: string) => testMutation.mutateAsync(channelId),
    toggleChannel: (channelId: string) => toggleChannelMutation.mutateAsync(channelId),
    toggleRule: (ruleId: string) => toggleRuleMutation.mutateAsync(ruleId),
    testResult: testMutation.data ?? null,
    isTesting: testMutation.isPending,
    refetch: () => { channelsQuery.refetch(); rulesQuery.refetch(); statsQuery.refetch(); },
    STATUS_COLORS,
    CHANNEL_META,
    PRIORITY_COLORS,
  };
}

function generateSimulatedData() {
  const channels: NotifyChannel[] = [
    {
      id: 'ch-email-default', type: 'email', name: 'Email Notifications', enabled: true, status: 'disconnected',
      config: { fromAddress: 'alerts@pulsestack.io', toAddresses: ['ops@pulsestack.io'] },
      priorityFilter: ['critical', 'high'],
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ch-slack-ops', type: 'slack', name: 'Slack #ops-alerts', enabled: true, status: 'connected',
      config: { slackChannel: '#ops-alerts' },
      priorityFilter: ['critical', 'high', 'medium'],
      createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ch-slack-dev', type: 'slack', name: 'Slack #dev-monitoring', enabled: false, status: 'disconnected',
      config: { slackChannel: '#dev-monitoring' },
      priorityFilter: ['medium', 'low'],
      createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ch-discord', type: 'discord', name: 'Discord Alerts', enabled: true, status: 'connected',
      config: { discordChannel: '#alerts' },
      priorityFilter: ['critical', 'high'],
      createdAt: new Date(Date.now() - 75 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ch-teams', type: 'teams', name: 'Microsoft Teams', enabled: true, status: 'disconnected',
      config: {},
      priorityFilter: ['critical'],
      createdAt: new Date(Date.now() - 70 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ch-webhook-pagerduty', type: 'webhook', name: 'PagerDuty Webhook', enabled: true, status: 'connected',
      config: { webhookMethod: 'POST' },
      priorityFilter: ['critical', 'high'],
      createdAt: new Date(Date.now() - 65 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const rules: NotificationRule[] = [
    {
      id: 'rule-critical', name: 'Critical Alerts',
      description: 'Route critical severity alerts to all active channels',
      eventTypes: ['anomaly.critical', 'slo.breached', 'execution.failed'],
      channelIds: ['ch-slack-ops', 'ch-email-default', 'ch-discord', 'ch-webhook-pagerduty'],
      priority: 'critical', enabled: true, cooldownMinutes: 5,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rule-high', name: 'High Severity',
      description: 'High severity anomalies and SLO warnings',
      eventTypes: ['anomaly.high', 'slo.warning'],
      channelIds: ['ch-slack-ops', 'ch-email-default'],
      priority: 'high', enabled: true, cooldownMinutes: 10,
      createdAt: new Date(Date.now() - 85 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rule-medium', name: 'Medium Alerts',
      description: 'Medium severity notifications to dev channels',
      eventTypes: ['anomaly.medium', 'slo.near-violation'],
      channelIds: ['ch-slack-dev'],
      priority: 'medium', enabled: false, cooldownMinutes: 30,
      createdAt: new Date(Date.now() - 80 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const stats: NotifyStats = {
    totalChannels: 6, connected: 3, disconnected: 2, error: 1, enabled: 5, rulesEnabled: 2,
    byType: { email: 1, slack: 2, discord: 1, teams: 1, webhook: 1 },
    lastTestedAt: new Date(Date.now() - 3600000).toISOString(),
  };

  return { channels, rules, stats };
}