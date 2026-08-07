import { useConfigVersions } from '../hooks/useConfigVersions';

function DiffBlock({ label, items, type }: { label: string; items: string[] | any[]; type: 'added' | 'removed' | 'modified' }) {
  if (!items || items.length === 0) return null;
  const colorMap: Record<string, string> = { added: 'text-mint', removed: 'text-rose-300', modified: 'text-amber-300' };
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</div>
      {items.map((item, idx) => (
        <div key={idx} className={`text-xs font-mono ${colorMap[type]}`}>
          {typeof item === 'string' ? item : `${item.key}: ${JSON.stringify(item.oldValue)} -> ${JSON.stringify(item.newValue)}`}
        </div>
      ))}
    </div>
  );
}

export function ConfigVersionDashboard() {
  const {
    versions,
    selectedVersion,
    compareVersion,
    diff,
    history,
    selectedVersionId,
    compareWithId,
    isLoading,
    isError,
    setSelectedVersionId,
    setCompareWithId,
    restoreVersion,
  } = useConfigVersions();

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-6 text-center text-rose-200">
        Failed to load configuration versions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          Configuration Version History
        </h3>
        <span className="bg-cyan/15 text-cyan border border-cyan/30 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Change Management
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50">Versions</h4>
          {isLoading ? (
            <div className="text-sm text-white/40">Loading versions...</div>
          ) : (
            versions.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedVersionId === v.id ? 'border-cyan bg-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">v{v.version} - {v.name}</span>
                  <span className="text-xs text-white/40">{v.author}</span>
                </div>
                <div className="text-xs text-white/50">{v.description}</div>
                <div className="mt-1 text-[10px] text-white/30 font-mono">{new Date(v.createdAt).toLocaleString()}</div>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          {selectedVersion ? (
            <>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-semibold text-white mb-2">v{selectedVersion.version} - {selectedVersion.name}</h4>
                <p className="text-xs text-white/50 mb-3">{selectedVersion.description}</p>
                <div className="space-y-2">
                  {Object.entries(selectedVersion.config).map(([key, value]) => (
                    <div key={key} className="rounded border border-white/10 bg-white/5 p-2 text-xs">
                      <div className="font-semibold text-white/70">{key}</div>
                      <div className="font-mono text-white/40 break-all">{JSON.stringify(value)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <select
                    value={compareWithId}
                    onChange={(e) => setCompareWithId(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white focus:border-cyan focus:outline-none"
                  >
                    <option value="">Compare with...</option>
                    {versions.filter((v) => v.id !== selectedVersionId).map((v) => (
                      <option key={v.id} value={v.id}>v{v.version} - {v.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => restoreVersion(selectedVersion.id)}
                    className="rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition"
                  >
                    Restore
                  </button>
                </div>
              </div>

              {diff && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-semibold text-white mb-2">Diff: v{diff.a.version} vs v{diff.b.version}</h4>
                  <div className="space-y-3">
                    <DiffBlock label="Added" items={diff.added} type="added" />
                    <DiffBlock label="Removed" items={diff.removed} type="removed" />
                    <DiffBlock label="Modified" items={diff.modified} type="modified" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-white/40 text-sm">
              Select a version to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
