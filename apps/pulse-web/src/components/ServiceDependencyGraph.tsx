import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '@pulsestack/ui';
import {
  useServiceDependencies,
  generateMockServiceTopology,
  type ServiceNode,
  type ServiceDependency,
  type ServiceTopology,
} from '../hooks/useServiceDependencies';

const STATUS_COLORS = {
  healthy: { bg: 'rgba(74,222,128,0.15)', border: '#4ade80', text: '#4ade80', glow: 'rgba(74,222,128,0.3)' },
  degraded: { bg: 'rgba(251,191,36,0.15)', border: '#fbbf24', text: '#fbbf24', glow: 'rgba(251,191,36,0.3)' },
  down: { bg: 'rgba(248,113,113,0.15)', border: '#f87171', text: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  unknown: { bg: 'rgba(156,163,175,0.15)', border: '#9ca3af', text: '#9ca3af', glow: 'rgba(156,163,175,0.3)' },
};

const NODE_TYPE_ICONS: Record<string, string> = {
  gateway: '🛡️',
  service: '⚙️',
  database: '🗄️',
  cache: '⚡',
  queue: '📨',
  external: '🌐',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  gateway: '#86d9ff',
  service: '#a78bfa',
  database: '#60a5fa',
  cache: '#fbbf24',
  queue: '#34d399',
  external: '#f472b6',
};

// Pre-computed layout positions for a clear visual topology
function computeLayout(nodes: ServiceNode[], edges: ServiceDependency[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Layer 0: Gateways
  let x = 0;
  nodes.filter((n) => n.type === 'gateway').forEach((n) => {
    positions[n.id] = { x: 400, y: 60 };
  });

  // Layer 1: Core services
  const coreServices = nodes.filter((n) => n.type === 'service' && n.id !== 'analytics-service' && n.id !== 'notification-service');
  coreServices.forEach((n, i) => {
    positions[n.id] = { x: 150 + i * 250, y: 200 };
  });

  // Layer 2: Databases and infrastructure
  const infra = nodes.filter((n) => n.type === 'database' || n.type === 'cache' || n.type === 'queue');
  infra.forEach((n, i) => {
    positions[n.id] = { x: 120 + i * 180, y: 380 };
  });

  // Layer 3: Secondary services
  const secondary = nodes.filter((n) => n.type === 'service' && (n.id === 'analytics-service' || n.id === 'notification-service'));
  secondary.forEach((n, i) => {
    positions[n.id] = { x: 150 + i * 400, y: 520 };
  });

  // Layer 4: External
  nodes.filter((n) => n.type === 'external').forEach((n) => {
    positions[n.id] = { x: 750, y: 520 };
  });

  // Fallback for any unpositioned nodes
  nodes.forEach((n, i) => {
    if (!positions[n.id]) {
      positions[n.id] = { x: 100 + (i % 4) * 180, y: 100 + Math.floor(i / 4) * 160 };
    }
  });

  return positions;
}

function EdgePath({ edge, sourcePos, targetPos, isHighlighted, type }: {
  edge: ServiceDependency;
  sourcePos: { x: number; y: number };
  targetPos: { x: number; y: number };
  isHighlighted: boolean;
  type: string;
}) {
  const midX = (sourcePos.x + targetPos.x) / 2;
  const midY = (sourcePos.y + targetPos.y) / 2;
  const color = type === 'async' ? 'rgba(251,191,36,0.5)' : type === 'stream' ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.2)';
  const highlightColor = type === 'async' ? '#fbbf24' : type === 'stream' ? '#60a5fa' : '#86d9ff';
  const dashArray = type === 'async' ? '8,4' : type === 'stream' ? '4,4' : undefined;

  return (
    <g>
      <line
        x1={sourcePos.x}
        y1={sourcePos.y}
        x2={targetPos.x}
        y2={targetPos.y}
        stroke={isHighlighted ? highlightColor : color}
        strokeWidth={isHighlighted ? 2.5 : 1.5}
        strokeDasharray={dashArray}
        className="transition-all duration-300"
      />
      <circle cx={midX} cy={midY} r={3} fill={isHighlighted ? highlightColor : color} />
      {isHighlighted && (
        <text x={midX + 8} y={midY - 8} fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily="monospace">
          {edge.avgLatency}ms
        </text>
      )}
    </g>
  );
}

export function ServiceDependencyGraph() {
  const [mockTopology] = useState<ServiceTopology>(() => generateMockServiceTopology());
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 900, h: 650 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const deps = useServiceDependencies();
  const topology = deps.data ?? mockTopology;
  const { nodes, edges } = topology;

  const positions = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.3, Math.min(3, prev * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewBox.x, y: e.clientY - viewBox.y });
    }
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setViewBox((prev) => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const relatedEdges = useMemo(() => {
    if (!highlightedNode) return new Set<string>();
    const related = new Set<string>();
    edges.forEach((e) => {
      if (e.source === highlightedNode || e.target === highlightedNode) {
        related.add(`${e.source}-${e.target}`);
      }
    });
    return related;
  }, [highlightedNode, edges]);

  const nodeByStatus = useMemo(() => {
    const grouped: Record<string, ServiceNode[]> = { healthy: [], degraded: [], down: [], unknown: [] };
    nodes.forEach((n) => grouped[n.status].push(n));
    return grouped;
  }, [nodes]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Service Dependency Graph</h2>
          <p className="text-xs text-white/50 font-mono mt-0.5">
            {nodes.length} services · {edges.length} dependencies
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={deps.searchQuery}
              onChange={(e) => deps.setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="w-48 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:border-cyan/40 focus:outline-none"
            />
            {deps.searchQuery && (
              <button
                onClick={() => deps.setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                ✕
              </button>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
            <button onClick={() => setScale((s) => Math.min(3, s * 1.2))} className="px-2 py-1 rounded-md text-xs text-white/60 hover:text-white hover:bg-white/10">+</button>
            <span className="px-2 py-1 text-xs text-white/40 font-mono">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.max(0.3, s / 1.2))} className="px-2 py-1 rounded-md text-xs text-white/60 hover:text-white hover:bg-white/10">−</button>
            <button onClick={() => { setScale(1); setViewBox({ x: 0, y: 0, w: 900, h: 650 }); }} className="px-2 py-1 rounded-md text-xs text-white/60 hover:text-white hover:bg-white/10">⟲</button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => deps.refetch()}
            disabled={deps.isFetching}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.06] disabled:opacity-50"
          >
            {deps.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(nodeByStatus).map(([status, services]) => (
          <div key={status} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS]?.border ?? '#9ca3af' }} />
            <span className="text-white/60 capitalize">{status}</span>
            <span className="font-mono text-white/40">{services.length}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs ml-auto">
          <span className="text-white/40">Auto-refresh: {deps.isFetching ? '⟳' : '✓'}</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="relative rounded-2xl border border-white/10 bg-black/20 overflow-hidden" style={{ height: 600 }}>
        {/* Loading overlay */}
        {deps.isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-white/50">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
              <span className="text-sm font-mono">Loading topology...</span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w / scale} ${viewBox.h / scale}`}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width={20} height={20} patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map((edge) => {
            const src = positions[edge.source];
            const tgt = positions[edge.target];
            if (!src || !tgt) return null;
            const edgeKey = `${edge.source}-${edge.target}`;
            return (
              <EdgePath
                key={edgeKey}
                edge={edge}
                sourcePos={src}
                targetPos={tgt}
                isHighlighted={relatedEdges.has(edgeKey) || hoveredEdge === edgeKey}
                type={edge.type}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const statusColor = STATUS_COLORS[node.status];
            const isHighlighted = highlightedNode === node.id || !highlightedNode;
            const isSelected = deps.selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHighlightedNode(node.id)}
                onMouseLeave={() => setHighlightedNode(null)}
                onClick={() => deps.setSelectedNodeId(deps.selectedNodeId === node.id ? null : node.id)}
              >
                {/* Selection glow */}
                {isSelected && (
                  <circle cx={0} cy={0} r={38} fill="none" stroke={statusColor.border} strokeWidth={2} opacity={0.5}>
                    <animate attributeName="r" values="35;42;35" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Node body */}
                <circle
                  cx={0}
                  cy={0}
                  r={28}
                  fill={statusColor.bg}
                  stroke={isSelected ? statusColor.border : isHighlighted ? statusColor.border : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isSelected ? 3 : isHighlighted ? 2 : 1.5}
                  className="transition-all duration-200"
                />
                {isHighlighted && (
                  <circle cx={0} cy={0} r={30} fill="none" stroke={statusColor.glow} strokeWidth={4} opacity={0.3}>
                    <animate attributeName="r" values="28;34;28" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.1;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Status indicator dot */}
                <circle cx={18} cy={-18} r={4} fill={statusColor.border} stroke="#09111f" strokeWidth={2} />

                {/* Node type icon */}
                <text x={0} y={-2} textAnchor="middle" fontSize={16} fill="white">
                  {NODE_TYPE_ICONS[node.type] ?? '⚙️'}
                </text>

                {/* Node label */}
                <text x={0} y={44} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" fontFamily="monospace" className="select-none">
                  {node.name.length > 18 ? `${node.name.slice(0, 16)}...` : node.name}
                </text>

                {/* Node type badge */}
                <text x={0} y={54} textAnchor="middle" fontSize={8} fill={NODE_TYPE_COLORS[node.type] ?? 'rgba(255,255,255,0.4)'} fontFamily="monospace" className="select-none">
                  {node.type}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Node Detail Panel */}
        <AnimatePresence>
          {deps.selectedNodeId && (() => {
            const node = nodes.find((n) => n.id === deps.selectedNodeId);
            if (!node) return null;
            const statusColor = STATUS_COLORS[node.status];
            const deps_list = edges
              .filter((e) => e.source === node.id || e.target === node.id)
              .map((e) => {
                const otherId = e.source === node.id ? e.target : e.source;
                const other = nodes.find((n) => n.id === otherId);
                return { edge: e, other: other ?? { id: otherId, name: otherId, type: 'service' as const } };
              });

            return (
              <motion.div
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                className="absolute right-0 top-0 bottom-0 w-[320px] border-l border-white/10 bg-black/80 backdrop-blur-xl p-4 overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{NODE_TYPE_ICONS[node.type]}</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{node.name}</h3>
                      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: NODE_TYPE_COLORS[node.type] }}>{node.type}</span>
                    </div>
                  </div>
                  <button onClick={() => deps.setSelectedNodeId(null)} className="text-white/40 hover:text-white/70 text-sm">✕</button>
                </div>

                {/* Status */}
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60 uppercase tracking-wider">Status</span>
                    <span className="text-xs font-bold font-mono" style={{ color: statusColor.text }}>{node.status.toUpperCase()}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: node.status === 'healthy' ? '100%' : node.status === 'degraded' ? '60%' : node.status === 'down' ? '10%' : '50%',
                      backgroundColor: statusColor.border,
                    }} />
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <MetricCard label="Latency" value={`${node.metrics.latency}ms`} color={node.metrics.latency < 20 ? '#4ade80' : node.metrics.latency < 50 ? '#fbbf24' : '#f87171'} />
                  <MetricCard label="Error Rate" value={`${node.metrics.errorRate}%`} color={node.metrics.errorRate < 1 ? '#4ade80' : node.metrics.errorRate < 5 ? '#fbbf24' : '#f87171'} />
                  <MetricCard label="Requests/min" value={formatMetric(node.metrics.requestsPerMin)} color="#86d9ff" />
                  <MetricCard label="Uptime" value={`${node.metrics.uptime}%`} color={node.metrics.uptime >= 99.9 ? '#4ade80' : node.metrics.uptime >= 99 ? '#fbbf24' : '#f87171'} />
                </div>

                {/* Dependencies */}
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wider mb-2">
                    Dependencies ({deps_list.length})
                  </div>
                  <div className="space-y-1.5">
                    {deps_list.map(({ edge, other }) => (
                      <div
                        key={`${edge.source}-${edge.target}`}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{NODE_TYPE_ICONS[other.type] ?? '⚙️'}</span>
                          <span className="text-white/80">{other.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono ${edge.type === 'async' ? 'text-amber-300' : edge.type === 'stream' ? 'text-blue-300' : 'text-white/50'}`}>
                            {edge.type}
                          </span>
                          <span className="text-white/40 font-mono">{edge.avgLatency}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Bottom legend */}
      <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-white/20" /> Sync
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 border-t-2 border-dashed border-amber-400/40" /> Async
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 border-t-2 border-dotted border-blue-400/40" /> Stream
          </span>
        </div>
        <div>
          Last updated: {new Date(topology.lastUpdated).toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5" style={{ color }}>{value}</div>
    </div>
  );
}

function formatMetric(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}