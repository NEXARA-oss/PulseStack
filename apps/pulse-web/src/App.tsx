
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { fetchJson } from './lib/api';
import { useUiStore } from './store/ui';

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

export default function App() {
  const selectedExecutionId = useUiStore((state) => state.selectedExecutionId);
  const setSelectedExecutionId = useUiStore((state) => state.setSelectedExecutionId);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);

  const executions = useQuery({
    queryKey: ['executions'],
    queryFn: () => fetchJson<Execution[]>('/api/runtime/executions'),
    refetchInterval: 4000,
  });

  useEffect(() => {
    if (!selectedExecutionId && executions.data?.[0]) setSelectedExecutionId(executions.data[0].id);
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
    const socket = new WebSocket(`${(import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:4000').replace('http', 'ws')}/ws/events`);
    socket.onmessage = (event) => setLiveEvents((current) => [event.data.toString(), ...current].slice(0, 25));
    return () => socket.close();
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
    metrics.data?.latency.length && metrics.data.latency.length > 0
      ? Math.round(
          metrics.data.latency.reduce((sum, item) => sum + Number(item.avg_latency_ms ?? 0), 0) /
            metrics.data.latency.length,
        )
      : 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(86,219,255,0.15),_transparent_40%),linear-gradient(180deg,#040814,#09111f_45%,#02050b)] px-4 py-6 text-white">
      <motion.header initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-mint">PulseStack</p>
        <h1 className="text-4xl font-bold">Observability and Runtime Intelligence for Distributed AI Workflows</h1>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_360px]">
        <Panel title="Executions">
          <div className="space-y-2">
            {executions.data?.map((execution) => (
              <button
                key={execution.id}
                onClick={() => setSelectedExecutionId(execution.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${selectedExecutionId === execution.id ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5'}`}
              >
                <div className="font-mono text-xs text-cyan">{execution.id}</div>
                <div className="text-sm">{execution.workflow_id}</div>
                <div className="text-xs text-white/60">{execution.status}</div>
              </button>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Panel title="Total Runs">
              <div className="font-mono text-3xl font-semibold text-cyan">{metrics.data?.executions.total ?? 0}</div>
              <div className="text-xs uppercase text-white/50">tracked executions</div>
            </Panel>
            <Panel title="Success Rate">
              <div className="font-mono text-3xl font-semibold text-mint">{successRate}%</div>
              <div className="text-xs uppercase text-white/50">{metrics.data?.executions.succeeded ?? 0} succeeded</div>
            </Panel>
            <Panel title="Failed Runs">
              <div className="font-mono text-3xl font-semibold text-rose-300">{metrics.data?.executions.failed ?? 0}</div>
              <div className="text-xs uppercase text-white/50">needs attention</div>
            </Panel>
            <Panel title="Avg Latency">
              <div className="font-mono text-3xl font-semibold text-white">{averageLatency}ms</div>
              <div className="text-xs uppercase text-white/50">trace spans</div>
            </Panel>
          </div>

          <Panel title="Execution DAG">
            <div className="h-[420px] overflow-hidden rounded-xl border border-white/10">
              <ReactFlow nodes={nodes} edges={dag.data?.edges ?? []} fitView>
                <Background color="#16314d" />
                <Controls />
              </ReactFlow>
            </div>
          </Panel>

          <Panel title="Trace Timeline">
            <div className="space-y-2">
              {trace.data?.map((span) => (
                <div key={`${span.span_id}-${span.started_at}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{span.name}</span>
                    <span className="text-xs uppercase text-mint">{span.kind}</span>
                  </div>
                  <div className="font-mono text-xs text-white/60">{span.started_at}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}