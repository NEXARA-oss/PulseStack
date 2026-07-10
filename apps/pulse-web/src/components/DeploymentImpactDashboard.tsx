import { useDeployments } from '../hooks/useDeployments';

export function DeploymentImpactDashboard() {
  const {
    deployments,
    events,
    impact,
    summary,
    services,
    serviceFilter,
    environmentFilter,
    selectedDeploymentId,
    isLoading,
    isError,
    setServiceFilter,
    setEnvironmentFilter,
    setSelectedDeploymentId,
    STATUS_COLORS,
    ROLLBACK_COLORS,
  } = useDeployments();

  const environments = ['all', ...new Set(deployments.map((d) => d.environment))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Deployments & Impact Analysis
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Deployment Tracker
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Total Deployments</div>
          <div className="mt-2 font-mono text-2xl text-cyan">{summary.totalDeployments}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Success Rate</div>
          <div className="mt-2 font-mono text-2xl text-mint">{summary.successRate}%</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Rolled Back</div>
          <div className="mt-2 font-mono text-2xl text-white">{summary.rolledBackDeployments}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider">Regressions</div>
          <div className="mt-2 font-mono text-2xl text-rose-300">{summary.regressionsDetected}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          <option value="all">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={environmentFilter}
          onChange={(e) => setEnvironmentFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
        >
          {environments.map((e) => (
            <option key={e} value={e}>{e === 'all' ? 'All Environments' : e}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
          Loading deployments...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
          Failed to load deployments.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <button
                key={deployment.id}
                onClick={() => setSelectedDeploymentId(deployment.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedDeploymentId === deployment.id
                    ? 'border-cyan bg-cyan/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-cyan">{deployment.service}</span>
                  <span
                    className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border"
                    style={{
                      background: STATUS_COLORS[deployment.status].bg,
                      color: STATUS_COLORS[deployment.status].text,
                      borderColor: STATUS_COLORS[deployment.status].border,
                    }}
                  >
                    {deployment.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-1 text-sm">{deployment.version} ({deployment.commit})</div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/50">
                  <span>{deployment.environment}</span>
                  <span
                    className="rounded px-1.5 py-0.5 border"
                    style={{
                      background: ROLLBACK_COLORS[deployment.rollback].bg,
                      color: ROLLBACK_COLORS[deployment.rollback].text,
                    }}
                  >
                    rollback: {deployment.rollback.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            {selectedDeploymentId ? (
              <div className="space-y-4">
                <h4 className="font-semibold text-white">Deployment Details</h4>
                {impact && (
                  <div
                    className="rounded-lg border p-3"
                    style={{
                      background: impact.regressionDetected ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)',
                      borderColor: impact.regressionDetected ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)',
                    }}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Impact Analysis
                    </div>
                    <div className="mt-1 text-sm">
                      {impact.regressionDetected ? (
                        <>
                          <span className="text-rose-300">Regression detected</span>
                          <span className="text-white/60"> ({impact.severity})</span>
                        </>
                      ) : (
                        <span className="text-mint">No significant regression</span>
                      )}
                    </div>
                    {impact.affectedMetrics.length > 0 && (
                      <div className="mt-1 text-xs text-white/50">
                        Affected: {impact.affectedMetrics.join(', ')}
                      </div>
                    )}
                    <div className="mt-2 text-xs text-white/60">{impact.suggestedAction}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                    Events
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white/80">{event.type.replace('_', ' ')}</span>
                          <span className="text-white/40 font-mono">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 text-xs text-white/50">{event.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
                Select a deployment to view impact analysis.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
