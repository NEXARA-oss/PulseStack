import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, type NotifyChannel, type NotificationRule, type ChannelType } from '../hooks/useNotifications';

export function NotificationsDashboard() {
  const {
    channels, rules, stats, isLoading, isSimulated,
    testChannel, toggleChannel, toggleRule,
    testResult, isTesting, refetch,
    STATUS_COLORS, CHANNEL_META, PRIORITY_COLORS,
  } = useNotifications();

  const [selectedChannel, setSelectedChannel] = useState<NotifyChannel | null>(null);
  const [showTestResult, setShowTestResult] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ChannelType | 'all'>('all');

  const filteredChannels = typeFilter === 'all' ? channels : channels.filter((c) => c.type === typeFilter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  const handleTest = async (channelId: string) => {
    setShowTestResult(channelId);
    await testChannel(channelId);
    setTimeout(() => setShowTestResult(null), 4000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">Notification Channel Management</h2>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border ${
              isSimulated ? 'bg-amber-400/10 text-amber-300 border-amber-400/30' : 'bg-mint/10 text-mint border-mint/30'
            }`}>
              {isSimulated ? '🔬 Demo' : '🟢 Live'}
            </span>
          </div>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {stats.totalChannels} channels · {stats.connected} connected · {stats.enabled} enabled · {stats.rulesEnabled} active rules
          </p>
        </div>
        <button onClick={refetch} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-white/[0.03] text-white/60 hover:text-white">
          Refresh
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <StatCard label="Total Channels" value={stats.totalChannels} color="#60a5fa" />
        <StatCard label="Connected" value={stats.connected} color="#34d399" />
        <StatCard label="Disconnected" value={stats.disconnected} color="#9ca3af" />
        <StatCard label="Errors" value={stats.error} color="#ef4444" pulse={stats.error > 0} />
        <StatCard label="Active Rules" value={stats.rulesEnabled} color="#a78bfa" />
      </div>

      {/* Type filter */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'email', 'slack', 'discord', 'teams', 'webhook'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-mono uppercase transition-all ${
              typeFilter === type
                ? 'bg-cyan/20 text-cyan border border-cyan/30'
                : 'text-white/40 border border-transparent hover:text-white/60'
            }`}
          >
            {type === 'all' ? 'All' : `${CHANNEL_META[type].icon} ${CHANNEL_META[type].label}`}
          </button>
        ))}
      </div>

      {/* Channel Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredChannels.length === 0 ? (
          <div className="col-span-full p-8 text-center text-sm text-white/40">
            No channels match the selected filter
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const meta = CHANNEL_META[channel.type];
            const statusColor = STATUS_COLORS[channel.status];
            const isSelected = selectedChannel?.id === channel.id;
            const isTestingThis = showTestResult === channel.id;
            const testResultData = testResult?.channelId === channel.id ? testResult : null;

            return (
              <motion.div
                key={channel.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedChannel(isSelected ? null : channel)}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                  isSelected ? 'border-cyan/50 bg-cyan/[0.03]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '1.2rem' }}>{meta.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-white">{channel.name}</div>
                      <div className="text-[9px] font-mono text-white/40">{meta.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleChannel(channel.id); }}
                      className={`relative w-8 h-4 rounded-full transition-all ${
                        channel.enabled ? 'bg-mint/40' : 'bg-white/10'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                        channel.enabled ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase"
                    style={{ backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}>
                    {channel.status}
                  </span>
                  {channel.priorityFilter.map((p) => (
                    <span key={p} className="text-[8px] font-mono uppercase" style={{ color: PRIORITY_COLORS[p] }}>
                      {p}
                    </span>
                  ))}
                </div>

                {/* Config summary */}
                <div className="text-[9px] font-mono text-white/30 space-y-0.5">
                  {channel.type === 'email' && (
                    <div>To: {(channel.config as any).toAddresses?.join(', ') ?? '—'}</div>
                  )}
                  {channel.type === 'slack' && (
                    <div>Channel: {(channel.config as any).slackChannel ?? '—'}</div>
                  )}
                  {channel.type === 'discord' && (
                    <div>Channel: {(channel.config as any).discordChannel ?? '—'}</div>
                  )}
                </div>

                {/* Test button + result */}
                <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleTest(channel.id)}
                    disabled={isTesting}
                    className="px-2 py-1 rounded text-[8px] font-mono border border-white/10 text-white/40 hover:text-white disabled:opacity-50"
                  >
                    {isTestingThis && isTesting ? 'Testing...' : '🔍 Test'}
                  </button>
                  {testResultData && (
                    <span className={`text-[8px] font-mono ${testResultData.success ? 'text-mint' : 'text-rose-300'}`}>
                      {testResultData.success ? '✓ Delivered' : '✗ Failed'}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Notification Rules Section */}
      {rules.length > 0 && (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">📋 Notification Routing Rules</div>
          </div>
          <div className="divide-y divide-white/5">
            {rules.map((rule) => (
              <div key={rule.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">{rule.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase"
                      style={{ color: PRIORITY_COLORS[rule.priority], backgroundColor: `${PRIORITY_COLORS[rule.priority]}1a`, border: `1px solid ${PRIORITY_COLORS[rule.priority]}33` }}>
                      {rule.priority}
                    </span>
                  </div>
                  <div className="text-[9px] font-mono text-white/40 mt-0.5 truncate">{rule.description}</div>
                  <div className="text-[8px] font-mono text-white/30 mt-0.5">
                    Events: {rule.eventTypes.join(', ')} · Cooldown: {rule.cooldownMinutes}m
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-[8px] font-mono text-white/30">
                    {rule.channelIds.length} channels
                  </span>
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`relative w-8 h-4 rounded-full transition-all ${
                      rule.enabled ? 'bg-mint/40' : 'bg-white/10'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                      rule.enabled ? 'left-4' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Detail Panel */}
      <AnimatePresence>
        {selectedChannel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '1.5rem' }}>{CHANNEL_META[selectedChannel.type].icon}</span>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedChannel.name}</h3>
                  <p className="text-[10px] font-mono text-white/40 mt-0.5">ID: {selectedChannel.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedChannel(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <div className="text-[9px] font-mono text-white/40 uppercase">Type</div>
                <div className="text-xs font-semibold" style={{ color: CHANNEL_META[selectedChannel.type].color }}>
                  {CHANNEL_META[selectedChannel.type].label}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <div className="text-[9px] font-mono text-white/40 uppercase">Status</div>
                <div className="text-xs font-semibold" style={{ color: STATUS_COLORS[selectedChannel.status].text }}>
                  {selectedChannel.status}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <div className="text-[9px] font-mono text-white/40 uppercase">Enabled</div>
                <div className="text-xs font-semibold" style={{ color: selectedChannel.enabled ? '#34d399' : '#9ca3af' }}>
                  {selectedChannel.enabled ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Priority filter badges */}
            <div className="mb-4">
              <div className="text-[9px] font-mono text-white/40 uppercase mb-1.5">Priority Filter</div>
              <div className="flex gap-1">
                {selectedChannel.priorityFilter.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase"
                    style={{ color: PRIORITY_COLORS[p], backgroundColor: `${PRIORITY_COLORS[p]}1a`, border: `1px solid ${PRIORITY_COLORS[p]}33` }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Last test/error */}
            {selectedChannel.lastError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 mb-2">
                <div className="text-[9px] font-mono text-rose-300 uppercase">Last Error</div>
                <div className="text-[10px] font-mono text-rose-200/70 mt-0.5">{selectedChannel.lastError}</div>
              </div>
            )}

            {selectedChannel.lastTestedAt && (
              <div className="text-[9px] font-mono text-white/30">
                Last tested: {new Date(selectedChannel.lastTestedAt).toLocaleString()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 hover:bg-white/[0.05] transition-all">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-lg font-bold mt-0.5 flex items-center gap-1.5" style={{ color }}>
        {pulse && value > 0 && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
        {value}
      </div>
    </div>
  );
}