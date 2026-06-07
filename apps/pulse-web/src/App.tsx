import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { fetchJson } from './lib/api';
import { useUiStore } from './store/ui';

import { ReplayScrubber } from './components/ReplayScrubber';
import { WorkflowGraph } from './components/WorkflowGraph';
import { useWorkflowReplay, WorkflowEvent } from './hooks/useWorkflowReplay';

type Execution = { id: string; workflow_id: string; status: string; updated_at: string };
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'replay'>('monitor');

  const replayState = useWorkflowReplay(MOCK_EVENTS);

  const executions = useQuery({
    queryKey: ['executions'],
    queryFn: () => fetchJson<Execution[]>('/api/runtime/executions'),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!selectedExecutionId && executions.data?.[0]) {
      setSelectedExecutionId(executions.data[0].id);
    }
  }, [executions.data, selectedExecutionId, setSelectedExecutionId]);

  const metrics = useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetchJson<MetricsSummary>('/api/metrics/summary'),
    refetchInterval: 5000,
  });

  const dag = useQuery({
    queryKey: ['graph', selectedExecutionId],
    queryFn: () => fetchJson<{ nodes: any[]; edges: any[] }>(`/api/graph/${selectedExecutionId}`),
    enabled: Boolean(selectedExecutionId),
  });

  const trace = useQuery({
    queryKey: ['trace', selectedExecutionId],
    queryFn: () => fetchJson<any[]>(`/api/traces/${selectedExecutionId}`),
    enabled: Boolean(selectedExecutionId),
  });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      setWsStatus('connecting');
      const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000';
      const wsUrl = `${gatewayUrl.replace('http', 'ws')}/ws/events`;
      
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
  const averageLatency =
    metrics.data?.latency && metrics.data.latency.length > 0
      ? Math.round(
          metrics.data.latency.reduce((sum, item) => sum + Number(item.avg_latency_ms ?? 0), 0) /
            metrics.data.latency.length,
        )
      : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(86,219,255,0.15),_transparent_40%),linear-gradient(180deg,#040814,#09111f_45%,#02050b)] px-4 py-6 text-white">
      <motion.header initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-mint font-semibold">PulseStack</p>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-300">
          Observability and Runtime Intelligence for Distributed AI Workflows
        </h1>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_360px]">
        {/* Left Column: Executions */}
        <Panel title="Executions">
          {executions.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-cyan animate-pulse">
              <span className="text-2xl mb-2">⚡</span>
              <span className="text-xs font-mono tracking-widest uppercase">Loading executions...</span>
            </div>
          ) : executions.isError ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
              Failed to load executions
            </div>
          ) : !executions.data || executions.data.length === 0 ? (
            <div className="text-center py-12 text-sm text-white/40">
              No executions found
            </div>
          ) : (
            <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-1">
              {executions.data.map((execution) => (
                <button
                  key={execution.id}
                  onClick={() => setSelectedExecutionId(execution.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:scale-[1.02] ${
                    selectedExecutionId === execution.id
                      ? 'border-cyan bg-cyan/15 shadow-[0_0_12px_rgba(86,219,255,0.15)]'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-cyan font-bold">{execution.id}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      execution.status === 'completed'
                        ? 'bg-mint/15 text-mint border border-mint/20'
                        : execution.status === 'failed'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                    }`}>
                      {execution.status}
                    </span>
                  </div>
                  <div className="text-sm truncate text-white/80 font-medium">{execution.workflow_id}</div>
                  <div className="text-[10px] text-white/40 mt-1 font-mono">{execution.updated_at}</div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* Center Column: Graphs and Timelines */}
        <div className="flex flex-col gap-4">
          {/* Top Panel stats */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Panel title="Total Runs">
              <div className="font-mono text-3xl font-semibold text-cyan">
                {metrics.isLoading ? '...' : (metrics.data?.executions.total ?? 0)}
              </div>
              <div className="text-xs uppercase text-white/50">tracked executions</div>
            </Panel>
            <Panel title="Success Rate">
              <div className="font-mono text-3xl font-semibold text-mint">
                {metrics.isLoading ? '...' : `${successRate}%`}
              </div>
              <div className="text-xs uppercase text-white/50">
                {metrics.isLoading ? '...' : `${metrics.data?.executions.succeeded ?? 0} succeeded`}
              </div>
            </Panel>
            <Panel title="Failed Runs">
              <div className="font-mono text-3xl font-semibold text-rose-300">
                {metrics.isLoading ? '...' : (metrics.data?.executions.failed ?? 0)}
              </div>
              <div className="text-xs uppercase text-white/50">needs attention</div>
            </Panel>
            <Panel title="Avg Latency">
              <div className="font-mono text-3xl font-semibold text-white">
                {metrics.isLoading ? '...' : `${averageLatency}ms`}
              </div>
              <div className="text-xs uppercase text-white/50">trace spans</div>
            </Panel>
          </div>

          {/* Tab Selection */}
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
                  🖥️ Realtime Monitor
                </button>
                <button
                  onClick={() => setActiveTab('replay')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === 'replay'
                      ? 'bg-cyan/20 text-cyan shadow-sm border border-cyan/30'
                      : 'text-white/60 hover:text-white border border-transparent'
                  }`}
                >
                  🎬 Replay Simulator
                </button>
              </div>

              {/* WebSocket Status Indicator */}
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
                {/* Execution DAG Panel */}
                <Panel title="Execution DAG">
                  <div className="h-[420px] overflow-hidden rounded-xl border border-white/10 relative">
                    {dag.isLoading ? (
                      <div className="flex items-center justify-center h-full text-cyan animate-pulse">
                        Loading execution graph...
                      </div>
                    ) : dag.isError ? (
                      <div className="flex items-center justify-center h-full text-rose-400 text-sm">
                        Failed to load execution graph
                      </div>
                    ) : !dag.data || !dag.data.nodes || dag.data.nodes.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-white/40 text-sm">
                        No graph data available. Select an execution.
                      </div>
                    ) : (
                      <ReactFlow nodes={nodes} edges={dag.data?.edges ?? []} fitView>
                        <Background color="#16314d" />
                        <Controls />
                      </ReactFlow>
                    )}
                  </div>
                </Panel>

                {/* Trace Timeline Panel */}
                <Panel title="Trace Timeline">
                  {trace.isLoading ? (
                    <div className="flex items-center justify-center py-8 text-cyan animate-pulse">
                      Loading trace spans...
                    </div>
                  ) : trace.isError ? (
                    <div className="text-rose-400 py-4 text-center text-sm">
                      Failed to load trace spans
                    </div>
                  ) : !trace.data || trace.data.length === 0 ? (
                    <div className="text-center py-8 text-sm text-white/40">
                      No traces recorded. Select an execution.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {trace.data.map((span) => (
                        <div key={`${span.span_id}-${span.started_at}`} className="rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-black/30 transition-colors">
                          <div className="flex items-center justify-between">
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
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    PulseStack Replay Viewer 🎬
                  </h3>
                  <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Advanced Tier
                  </span>
                </div>
                
                {/* Graph Component */}
                <WorkflowGraph events={MOCK_EVENTS} currentIndex={replayState.currentStepIndex} />

                {/* Timeline UI Component */}
                <ReplayScrubber events={MOCK_EVENTS} replayState={replayState} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Statistics & Live Events */}
        <div className="flex flex-col gap-4">
          <Panel title="Event Throughput">
            <div className="space-y-2">
              {metrics.isLoading ? (
                <div className="text-cyan animate-pulse py-4 text-center text-xs">Loading metrics...</div>
              ) : metrics.isError ? (
                <div className="text-rose-400 py-4 text-center text-xs">Failed to load metrics</div>
              ) : metrics.data?.events && metrics.data.events.length > 0 ? (
                metrics.data.events.map((item) => (
                  <div key={item.type} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 border border-white/5 text-sm hover:border-white/10 transition-colors">
                    <span className="text-white/70">{item.type}</span>
                    <span className="font-mono text-cyan font-bold">{item.total}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-white/40">No events recorded</div>
              )}
            </div>
          </Panel>

          <Panel title="Latency">
            <div className="space-y-2">
              {metrics.isLoading ? (
                <div className="text-cyan animate-pulse py-4 text-center text-xs">Loading latency...</div>
              ) : metrics.isError ? (
                <div className="text-rose-400 py-4 text-center text-xs">Failed to load latency</div>
              ) : metrics.data?.latency && metrics.data.latency.length > 0 ? (
                metrics.data.latency.map((item) => (
                  <div key={item.kind} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 border border-white/5 text-sm hover:border-white/10 transition-colors">
                    <span className="text-white/70">{item.kind}</span>
                    <span className="font-mono text-cyan font-bold">{Math.round(item.avg_latency_ms ?? 0)}ms</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-white/40">No latency details</div>
              )}
            </div>
          </Panel>

          <Panel title="Execution Status">
            <div className="space-y-2">
              {metrics.isLoading ? (
                <div className="text-cyan animate-pulse py-4 text-center text-xs">Loading status...</div>
              ) : metrics.isError ? (
                <div className="text-rose-400 py-4 text-center text-xs">Failed to load status</div>
              ) : metrics.data?.executions?.byStatus && metrics.data.executions.byStatus.length > 0 ? (
                metrics.data.executions.byStatus.map((item) => (
                  <div key={item.status} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 border border-white/5 text-sm hover:border-white/10 transition-colors">
                    <span className="text-white/70 capitalize">{item.status}</span>
                    <span className="font-mono text-cyan font-bold">{item.total}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-white/40">No execution states</div>
              )}
            </div>
          </Panel>

          <Panel title="Live Event Console">
            <div className="flex flex-col gap-2">
              {liveEvents.length > 0 ? (
                <div className="h-[360px] overflow-y-auto font-mono text-[10px] text-mint space-y-2 pr-1 custom-scrollbar">
                  {liveEvents.map((event, index) => (
                    <pre key={`${event}-${index}`} className="whitespace-pre-wrap rounded-lg bg-black/30 p-2 border border-white/5 shadow-inner">
                      {event}
                    </pre>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-white/40 italic border border-white/5 rounded-xl bg-black/10">
                  {wsStatus === 'connected' ? 'Listening for live events...' : 'Waiting for connection...'}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}