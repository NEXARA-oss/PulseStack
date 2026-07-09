import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowGraph } from './components/WorkflowGraph';
import { ReplayScrubber } from './components/ReplayScrubber';
import {
  SnapshotDebugger,
  type SnapshotInspection,
  type SnapshotTimelineItem,
} from './components/SnapshotDebugger';
import { ServiceDependencyGraph } from './components/ServiceDependencyGraph';
import { useWorkflowReplay, type WorkflowEvent } from './hooks/useWorkflowReplay';
import { fetchJson, postJson } from './lib/api';
import { useUiStore } from './store/ui';

type ExecutionContext = {
  executionId: string;
  workflowId: string;
  tenantId: string;
  correlationId: string;
  traceId: string;
  parentSpanId?: string;
  retryAttempt?: number;
  replaySessionId?: string;
};
type Execution = {
  id: string;
  workflow_id: string;
  tenant_id?: string;
  correlation_id?: string;
  status: string;
  output?: { executionContext?: ExecutionContext };
  updated_at: string;
};
type ExecutionList = { rows: Execution[]; total: number; limit: number; offset: number };
type TraceSpan = {
  span_id: string;
  trace_id?: string;
  parent_span_id?: string;
  started_at: string;
  name: string;
  kind: string;
  status?: string;
  attributes?: Record<string, unknown>;
  executionContext?: ExecutionContext;
};
type UsageMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  attribution?: {
    model?: string;
  };
};
type UsageResponse = {
  executionId?: string;
  workflowId?: string;
  tenantId?: string;
  usage: UsageMetadata;
  topWorkflows?: Array<{ id: string; executions: number; usage: UsageMetadata }>;
  topModels?: Array<{ id: string; executions: number; usage: UsageMetadata }>;
};
type ReplayResponse = {
  replaySessionId: string;
  originalUsage?: UsageMetadata;
  replayUsage?: UsageMetadata;
  usageComparison?: {
    inputTokensDelta: number;
    outputTokensDelta: number;
    totalTokensDelta: number;
    totalCostDelta: number;
  };
};
type MetricsSummary = {
  events: Array<{ type: string; total: number }>;
  latency: Array<{ kind: string; avg_latency_ms: number }>;
  executions: {
    total: number;
    succeeded: number;
    failed: number;
    successRate: number;
    byStatus: Array<{ status: string; total: number }>;
    recent: Execution[];
  };
  usage?: UsageResponse;
};

type DashboardStateProps = {
  title: string;
  message?: string;
  minHeight?: string;
  retryLabel?: string;
  isRetrying?: boolean;
  onRetry?: () => void;
};

const MOCK_EVENTS: WorkflowEvent[] = [
  { id: '1', nodeId: 'node-auth', status: 'success', timestamp: 1000 },
  { id: '2', nodeId: 'node-fetch-data', status: 'success', timestamp: 2000 },
  { id: '3', nodeId: 'node-process', status: 'running', timestamp: 3000 },
  { id: '4', nodeId: 'node-save', status: 'failed', timestamp: 4000 },
];

export default function App() {
  const selectedExecutionId = useUiStore((state) => state.selectedExecutionId);
  const setSelectedExecutionId = useUiStore((state) => state.setSelectedExecutionId);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [activeTab, setActiveTab] = useState<'monitor' | 'replay' | 'services'>('monitor');
  const [selectedSnapshotSequence, setSelectedSnapshotSequence] = useState<number | null>(null);
  const [replayRun, setReplayRun] = useState<ReplayResponse | null>(null);
  const [isStartingReplay, setIsStartingReplay] = useState(false);

  const replayState = useWorkflowReplay(MOCK_EVENTS);

  const executions = useQuery({
    queryKey: ['executions'],
    queryFn: () => fetchJson<ExecutionList>('/api/runtime/executions'),
    refetchInterval: 4000,
    retry: 1,
    retryDelay: 1000,
  });

  useEffect(() => {
    if (!selectedExecutionId && executions.data?.rows[0]) setSelectedExecutionId(executions.data.rows[0].id);
  }, [executions.data, selectedExecutionId, setSelectedExecutionId]);

  const metrics = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchJson<MetricsSummary>('/api/metrics/summary'),
    refetchInterval: 5000,
    retry: 1,
    retryDelay: 1000,
  });

  const dag = useQuery({
    queryKey: ['graph', selectedExecutionId],
    queryFn: () => fetchJson<{ nodes: any[]; edges: any[] }>(`/api/graph/${selectedExecutionId}`),
    enabled: Boolean(selectedExecutionId),
    retry: 1,
    retryDelay: 1000,
  });

  const trace = useQuery({
    queryKey: ['trace', selectedExecutionId],
    queryFn: () => fetchJson<TraceSpan[]>(`/api/traces/${selectedExecutionId}`),
    enabled: Boolean(selectedExecutionId),
    retry: 1,
    retryDelay: 1000,
  });

  const snapshotTimeline = useQuery({
    queryKey: ['replay-snapshots', selectedExecutionId],
    queryFn: () => fetchJson<SnapshotTimelineItem[]>(`/api/replay/${selectedExecutionId}/snapshots`),
    enabled: Boolean(selectedExecutionId),
    retry: 1,
    retryDelay: 1000,
  });

  const executionUsage = useQuery({
    queryKey: ['execution-usage', selectedExecutionId],
    queryFn: () => fetchJson<UsageResponse>(`/api/runtime/executions/${selectedExecutionId}/usage`),
    enabled: Boolean(selectedExecutionId),
    retry: 1,
    retryDelay: 1000,
  });

  useEffect(() => {
    const rows = snapshotTimeline.data ?? [];
    if (rows.length === 0) {
      setSelectedSnapshotSequence(null);
      return;
    }
    if (
      selectedSnapshotSequence === null ||
      !rows.some((row) => row.sequence === selectedSnapshotSequence)
    ) {
      setSelectedSnapshotSequence(rows[0].sequence);
    }
  }, [snapshotTimeline.data, selectedSnapshotSequence]);

  const selectedSnapshot = useQuery({
    queryKey: ['replay-snapshot', selectedExecutionId, selectedSnapshotSequence],
    queryFn: () =>
      fetchJson<SnapshotInspection>(
        `/api/replay/${selectedExecutionId}/snapshots/${selectedSnapshotSequence}`,
      ),
    enabled: Boolean(selectedExecutionId) && selectedSnapshotSequence !== null,
    retry: 1,
    retryDelay: 1000,
  });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      setWsStatus('connecting');
      const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000';
      const tenantId = import.meta.env.VITE_TENANT_ID;
      const tenantQuery = typeof tenantId === 'string' && tenantId.trim()
        ? `?tenantId=${encodeURIComponent(tenantId.trim())}`
        : '';
      const wsUrl = `${gatewayUrl.replace('http', 'ws')}/ws/events${tenantQuery}`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        if (isMounted) setWsStatus('connected');
      };

      socket.onmessage = (event) => {
        if (isMounted) {
          setLiveEvents((current) => [event.data.toString(), ...current].slice(0, 25));
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          setWsStatus('disconnected');
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        if (isMounted) {
          setWsStatus('disconnected');
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const nodes = useMemo(
    () =>
      (dag.data?.nodes ?? []).map((node, index) => ({
        ...node,
        position: { x: 120 + index * 180, y: 100 + (index % 2) * 120 },
        style: { background: '#09111f', color: '#fff', border: '1px solid rgba(86,219,255,0.5)', borderRadius: 14, padding: 10 },
      })),
    [dag.data],
  );

  const successRate = Math.round((metrics.data?.executions.successRate ?? 0) * 100);
  const executionRows = executions.data?.rows ?? [];
  const averageLatency =
    metrics.data?.latency && metrics.data.latency.length > 0
      ? Math.round(
          metrics.data.latency.reduce((sum, item) => sum + Number(item.avg_latency_ms ?? 0), 0) /
            metrics.data.latency.length,
        )
      : 0;
  const totalUsage = metrics.data?.usage?.usage;

  async function startReplay() {
    if (!selectedExecutionId) return;
    setIsStartingReplay(true);
    try {
      setReplayRun(await postJson<ReplayResponse>(`/api/replay/${selectedExecutionId}`));
    } finally {
      setIsStartingReplay(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(86,219,255,0.15),_transparent_40%),linear-gradient(180deg,#040814,#09111f_45%,#02050b)] px-4 py-6 text-white">
      <motion.header initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-mint font-semibold">PulseStack</p>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-300">
          Observability and Runtime Intelligence for Distributed AI Workflows
        </h1>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_360px]">
        <Panel title="Executions">
          {executions.isLoading ? (
            <LoadingStack rows={5} minHeight="min-h-[442px]" />
          ) : executions.isError ? (
            <DashboardError
              title="Executions unavailable"
              message={getErrorMessage(executions.error)}
              minHeight="min-h-[442px]"
              isRetrying={executions.isFetching}
              onRetry={() => void executions.refetch()}
            />
          ) : executionRows.length === 0 ? (
            <DashboardEmpty title="No executions yet" message="Runs will appear here after workflows start." minHeight="min-h-[442px]" />
          ) : (
            <div className="space-y-2 min-h-[442px]">
              {executionRows.map((execution) => (
                <button
                  key={execution.id}
                  onClick={() => setSelectedExecutionId(execution.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${selectedExecutionId === execution.id ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                >
                  <div className="font-mono text-xs text-cyan">{execution.id}</div>
                  <div className="text-sm">{execution.workflow_id}</div>
                  <div className="text-xs text-white/60">{execution.status}</div>
                  <div className="mt-2 space-y-1 font-mono text-[10px] text-white/50">
                    <div>corr {execution.correlation_id ?? execution.output?.executionContext?.correlationId ?? 'n/a'}</div>
                    <div>trace {shortId(execution.output?.executionContext?.traceId)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Panel title="Total Runs">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-cyan">
                {metrics.data?.executions.total ?? 0}
              </StatValue>
              <div className="text-xs uppercase text-white/50">tracked executions</div>
            </Panel>
            <Panel title="Success Rate">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-mint">
                {`${successRate}%`}
              </StatValue>
              <div className="text-xs uppercase text-white/50">
                {metrics.isLoading ? <InlineSkeleton width="w-24" /> : metrics.isError ? 'metrics unavailable' : `${metrics.data?.executions.succeeded ?? 0} succeeded`}
              </div>
            </Panel>
            <Panel title="Failed Runs">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-rose-300">
                {metrics.data?.executions.failed ?? 0}
              </StatValue>
              <div className="text-xs uppercase text-white/50">needs attention</div>
            </Panel>
            <Panel title="Avg Latency">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-white">
                {`${averageLatency}ms`}
              </StatValue>
              <div className="text-xs uppercase text-white/50">trace spans</div>
            </Panel>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Panel title="Total Tokens">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-cyan">
                {formatNumber(totalUsage?.totalTokens)}
              </StatValue>
              <div className="text-xs uppercase text-white/50">estimated usage</div>
            </Panel>
            <Panel title="Estimated Cost">
              <StatValue isLoading={metrics.isLoading} isError={metrics.isError} className="text-mint">
                {formatCost(totalUsage?.totalCost)}
              </StatValue>
              <div className="text-xs uppercase text-white/50">configured pricing</div>
            </Panel>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setActiveTab('monitor')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'monitor'
                      ? 'bg-cyan/20 text-cyan shadow-sm border border-cyan/30'
                      : 'text-white/60 hover:text-white border border-transparent'
                  }`}
                >
                  Realtime Monitor
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'services'
                      ? 'bg-cyan/20 text-cyan shadow-sm border border-cyan/30'
                      : 'text-white/60 hover:text-white border border-transparent'
                  }`}
                >
                  Service Graph
                </button>
                <button
                  onClick={() => setActiveTab('replay')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'replay'
                      ? 'bg-cyan/20 text-cyan shadow-sm border border-cyan/30'
                      : 'text-white/60 hover:text-white border border-transparent'
                  }`}
                >
                  Replay Simulator
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono bg-black/25 px-3 py-1.5 rounded-lg border border-white/5">
                <span className={`h-2 w-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-mint shadow-[0_0_8px_rgba(74,222,128,0.5)]'
                    : wsStatus === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                }`} />
                <span className="text-white/60 uppercase tracking-wider text-[10px]">
                  WS: {wsStatus}
                </span>
              </div>
            </div>

            {activeTab === 'monitor' ? (
              <div className="space-y-4">
                <Panel title="Execution DAG">
                  <div className="h-[420px] overflow-hidden rounded-xl border border-white/10 relative">
                    {!selectedExecutionId ? (
                      <DashboardEmpty title="Select an execution" message="Graph details will appear here." minHeight="h-full" />
                    ) : dag.isLoading ? (
                      <GraphSkeleton />
                    ) : dag.isError ? (
                      <DashboardError
                        title="Execution graph unavailable"
                        message={getErrorMessage(dag.error)}
                        minHeight="h-full"
                        isRetrying={dag.isFetching}
                        onRetry={() => void dag.refetch()}
                      />
                    ) : !dag.data || !dag.data.nodes || dag.data.nodes.length === 0 ? (
                      <DashboardEmpty title="No graph data" message="This execution has no DAG nodes yet." minHeight="h-full" />
                    ) : (
                      <ReactFlow nodes={nodes} edges={dag.data?.edges ?? []} fitView>
                        <Background color="#16314d" />
                        <Controls />
                      </ReactFlow>
                    )}
                  </div>
                </Panel>

                <Panel title="Trace Timeline">
                  {trace.isLoading ? (
                    <LoadingStack rows={4} minHeight="min-h-[300px]" />
                  ) : trace.isError ? (
                    <DashboardError
                      title="Trace spans unavailable"
                      message={getErrorMessage(trace.error)}
                      minHeight="min-h-[300px]"
                      isRetrying={trace.isFetching}
                      onRetry={() => void trace.refetch()}
                    />
                  ) : !trace.data || trace.data.length === 0 ? (
                    <DashboardEmpty title="No traces recorded" message="Trace spans will appear after instrumentation emits them." minHeight="min-h-[300px]" />
                  ) : (
                    <div className="space-y-2 max-h-[300px] min-h-[300px] overflow-y-auto pr-1">
                      {trace.data.map((span) => (
                        <div key={`${span.span_id}-${span.started_at}`} className="rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-black/30 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-sm">{span.name}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-mint border border-white/5">{span.kind}</span>
                          </div>
                          <div className="font-mono text-[10px] text-white/40 mt-1">{span.started_at}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            ) : activeTab === 'services' ? (
              <ServiceDependencyGraph />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    PulseStack Replay Viewer
                  </h3>
                  <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Advanced Tier
                  </span>
                </div>

                <WorkflowGraph events={MOCK_EVENTS} currentIndex={replayState.currentStepIndex} />
                <ReplayScrubber events={MOCK_EVENTS} replayState={replayState} />
                <Panel title="Replay Usage">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-mono text-xs text-white/50">
                      {replayRun?.replaySessionId ? `session ${shortId(replayRun.replaySessionId)}` : 'no replay session'}
                    </div>
                    <button
                      type="button"
                      onClick={() => void startReplay()}
                      disabled={!selectedExecutionId || isStartingReplay}
                      className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan transition hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isStartingReplay ? 'Starting...' : 'Run Replay'}
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <UsageCard title="Original" usage={replayRun?.originalUsage ?? executionUsage.data?.usage} />
                    <UsageCard title="Replay" usage={replayRun?.replayUsage} />
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-white/50">Replay Delta</div>
                      <div className="mt-3 font-mono text-2xl text-white">
                        {formatNumber(replayRun?.usageComparison?.totalTokensDelta)}
                      </div>
                      <div className="text-xs uppercase text-white/50">
                        {formatCost(replayRun?.usageComparison?.totalCostDelta)}
                      </div>
                    </div>
                  </div>
                </Panel>
                <SnapshotDebugger
                  timeline={snapshotTimeline.data}
                  inspection={selectedSnapshot.data}
                  selectedSequence={selectedSnapshotSequence}
                  isLoading={snapshotTimeline.isLoading}
                  isInspectionLoading={selectedSnapshot.isLoading}
                  error={snapshotTimeline.error}
                  onSelectSequence={setSelectedSnapshotSequence}
                  onRetry={() => void snapshotTimeline.refetch()}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Event Throughput">
            <div className="space-y-2">
              {metrics.isLoading ? (
                <LoadingStack rows={4} minHeight="min-h-[188px]" compact />
              ) : metrics.isError ? (
                <DashboardError
                  title="Metrics unavailable"
                  message={getErrorMessage(metrics.error)}
                  minHeight="min-h-[188px]"
                  isRetrying={metrics.isFetching}
                  onRetry={() => void metrics.refetch()}
                />
              ) : metrics.data?.events && metrics.data.events.length > 0 ? (
                <div className="space-y-2 min-h-[188px]">
                  {metrics.data.events.map((item) => (
                    <div key={item.type} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 border border-white/5 text-sm hover:border-white/10 transition-colors">
                      <span className="text-white/70">{item.type}</span>
                      <span className="font-mono text-cyan font-bold">{item.total}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <DashboardEmpty title="No events recorded" message="Throughput updates will appear when events arrive." minHeight="min-h-[188px]" />
              )}
            </div>
          </Panel>

          <Panel title="Latency">
            {trace.isLoading ? (
              <LoadingStack rows={4} minHeight="min-h-[300px]" />
            ) : trace.isError ? (
              <DashboardError
                title="Latency spans unavailable"
                message={getErrorMessage(trace.error)}
                minHeight="min-h-[300px]"
                isRetrying={trace.isFetching}
                onRetry={() => void trace.refetch()}
              />
            ) : !trace.data || trace.data.length === 0 ? (
              <DashboardEmpty title="No latency spans" message="Latency details will appear when traces are recorded." minHeight="min-h-[300px]" />
            ) : (
              <div className="space-y-2 min-h-[300px]">
                {trace.data.map((span) => {
                  const context = span.executionContext;
                  return (
                    <div key={`${span.span_id}-${span.started_at}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{span.name}</span>
                        <span className="text-xs uppercase text-mint">{span.kind}</span>
                      </div>
                      <div className="font-mono text-xs text-white/60">{span.started_at}</div>
                      <div className="mt-2 grid gap-1 font-mono text-[10px] text-white/50 md:grid-cols-2">
                        <span>trace {shortId(context?.traceId ?? span.trace_id)}</span>
                        <span>parent {shortId(context?.parentSpanId ?? span.parent_span_id)}</span>
                        {context?.retryAttempt ? <span>retry attempt {context.retryAttempt}</span> : null}
                        {context?.replaySessionId ? <span>replay {context.replaySessionId}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel title="Top Usage">
            <UsageList title="Workflows" rows={metrics.data?.usage?.topWorkflows} />
            <div className="mt-4">
              <UsageList title="Models" rows={metrics.data?.usage?.topModels} />
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function shortId(value: string | undefined) {
  if (!value) return 'n/a';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function formatNumber(value: number | undefined) {
  return Intl.NumberFormat('en-US').format(value ?? 0);
}

function formatCost(value: number | undefined) {
  return `$${(value ?? 0).toFixed(4)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}

function DashboardError({ title, message, minHeight = 'min-h-[160px]', retryLabel = 'Retry', isRetrying, onRetry }: DashboardStateProps) {
  return (
    <div className={`flex ${minHeight} flex-col items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-6 text-center`}>
      <div className="text-sm font-semibold text-rose-200">{title}</div>
      {message ? <div className="mt-1 max-w-[26rem] text-xs text-rose-100/70">{message}</div> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-4 rounded-lg border border-rose-200/30 bg-rose-200/10 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-200/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRetrying ? 'Retrying...' : retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function DashboardEmpty({ title, message, minHeight = 'min-h-[160px]' }: DashboardStateProps) {
  return (
    <div className={`flex ${minHeight} flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center`}>
      <div className="text-sm font-semibold text-white/70">{title}</div>
      {message ? <div className="mt-1 max-w-[24rem] text-xs text-white/40">{message}</div> : null}
    </div>
  );
}

function LoadingStack({ rows, minHeight = 'min-h-[160px]', compact = false }: { rows: number; minHeight?: string; compact?: boolean }) {
  return (
    <div className={`space-y-2 ${minHeight}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={`animate-pulse rounded-xl border border-white/10 bg-white/[0.04] ${compact ? 'p-3' : 'p-4'}`}>
          <div className="h-3 w-2/3 rounded bg-white/10" />
          <div className="mt-3 h-2 w-1/2 rounded bg-white/10" />
          {!compact ? <div className="mt-3 h-2 w-5/6 rounded bg-white/10" /> : null}
        </div>
      ))}
    </div>
  );
}

function GraphSkeleton() {
  return (
    <div className="relative h-full overflow-hidden bg-black/20" aria-busy="true" aria-label="Loading graph">
      <div className="absolute left-[14%] top-[38%] h-12 w-32 animate-pulse rounded-xl border border-cyan/20 bg-cyan/10" />
      <div className="absolute left-[40%] top-[24%] h-12 w-32 animate-pulse rounded-xl border border-cyan/20 bg-cyan/10" />
      <div className="absolute left-[66%] top-[42%] h-12 w-32 animate-pulse rounded-xl border border-cyan/20 bg-cyan/10" />
      <div className="absolute left-[27%] top-[44%] h-px w-[14%] animate-pulse bg-cyan/20" />
      <div className="absolute left-[53%] top-[36%] h-px w-[14%] animate-pulse bg-cyan/20" />
    </div>
  );
}

function StatValue({ children, className, isLoading, isError }: { children: React.ReactNode; className: string; isLoading: boolean; isError: boolean }) {
  return (
    <div className={`flex h-10 items-center font-mono text-3xl font-semibold ${className}`}>
      {isLoading ? <InlineSkeleton width="w-20" /> : isError ? <span className="text-xl text-rose-300">--</span> : children}
    </div>
  );
}

function InlineSkeleton({ width }: { width: string }) {
  return <span className={`inline-block h-6 ${width} animate-pulse rounded bg-white/10 align-middle`} />;
}

function UsageCard({ title, usage }: { title: string; usage?: UsageMetadata }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-bold uppercase tracking-wider text-white/50">{title}</div>
      <div className="mt-3 font-mono text-2xl text-cyan">{formatNumber(usage?.totalTokens)}</div>
      <div className="text-xs uppercase text-white/50">{formatCost(usage?.totalCost)}</div>
    </div>
  );
}

function UsageList({ title, rows }: { title: string; rows?: Array<{ id: string; executions: number; usage: UsageMetadata }> }) {
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">{title}</div>
      {rows && rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${title}-${row.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-white/70">{row.id}</span>
                <span className="font-mono text-cyan">{formatNumber(row.usage.totalTokens)}</span>
              </div>
              <div className="mt-1 text-[10px] uppercase text-white/40">
                {row.executions} runs · {formatCost(row.usage.totalCost)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/40">
          No usage recorded.
        </div>
      )}
    </div>
  );
}
