type SnapshotTimelineItem = {
  sequence: number;
  timestamp?: string;
  phase: string;
  stepId?: string;
  stepKind?: string;
  retry?: {
    boundary: boolean;
    attempt?: number;
    maxAttempts?: number;
    exhausted?: boolean;
    errors?: string[];
  };
  usage?: UsageMetadata;
  traceId?: string;
  spanId?: string;
  stateKeys: string[];
  diffSummary: {
    added: number;
    modified: number;
    removed: number;
  };
};

type UsageMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCost?: number;
};

type SnapshotDiffEntry = {
  path: string;
  before?: unknown;
  after?: unknown;
};

type SnapshotInspection = {
  sequence: number;
  timestamp?: string;
  phase: string;
  stepId?: string;
  stepKind?: string;
  retry?: SnapshotTimelineItem['retry'];
  usage?: UsageMetadata;
  traceId?: string;
  spanId?: string;
  snapshot: {
    state: Record<string, unknown>;
  };
  diff: {
    added: SnapshotDiffEntry[];
    modified: SnapshotDiffEntry[];
    removed: SnapshotDiffEntry[];
  };
};

type SnapshotDebuggerProps = {
  timeline?: SnapshotTimelineItem[];
  inspection?: SnapshotInspection;
  selectedSequence: number | null;
  isLoading: boolean;
  isInspectionLoading: boolean;
  error?: unknown;
  onSelectSequence: (sequence: number) => void;
  onRetry?: () => void;
};

export type { SnapshotInspection, SnapshotTimelineItem };

export function SnapshotDebugger({
  timeline,
  inspection,
  selectedSequence,
  isLoading,
  isInspectionLoading,
  error,
  onSelectSequence,
  onRetry,
}: SnapshotDebuggerProps) {
  const rows = timeline ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-[260px_1fr_1fr]">
        <DebuggerSkeleton />
        <DebuggerSkeleton />
        <DebuggerSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
        <div className="font-semibold">Snapshot debugger unavailable</div>
        <div className="mt-1 text-xs text-rose-100/70">{errorMessage(error)}</div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-rose-200/30 bg-rose-200/10 px-3 py-1.5 text-xs font-semibold text-rose-50"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <div className="text-sm font-semibold text-white/70">No snapshots recorded</div>
        <div className="mt-1 text-xs text-white/40">New executions will include debugger snapshots.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-white/60">
          Snapshot Timeline
        </div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {rows.map((item) => (
            <button
              key={item.sequence}
              type="button"
              onClick={() => onSelectSequence(item.sequence)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selectedSequence === item.sequence
                  ? 'border-cyan bg-cyan/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-cyan">#{item.sequence}</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/60">
                  {item.phase}
                </span>
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-white/80">
                {item.stepId ?? 'workflow'}
              </div>
              <div className="mt-1 font-mono text-[10px] text-white/40">
                +{item.diffSummary.added} ~{item.diffSummary.modified} -{item.diffSummary.removed}
              </div>
              {item.retry?.boundary ? (
                <div className="mt-2 rounded bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-200">
                  Retry attempt {item.retry.attempt ?? '?'} of {item.retry.maxAttempts ?? '?'}
                </div>
              ) : null}
              {item.usage?.totalTokens ? (
                <div className="mt-2 font-mono text-[10px] text-cyan">
                  {formatNumber(item.usage.totalTokens)} tokens · {formatCost(item.usage.totalCost)}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <PanelHeading title="State Inspector" detail={inspection?.stepId ?? inspection?.phase} />
        {isInspectionLoading ? (
          <DebuggerSkeleton compact />
        ) : (
          <JsonBlock value={inspection?.snapshot.state ?? {}} />
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
        <PanelHeading
          title="Diff Viewer"
          detail={
            inspection?.usage?.totalTokens
              ? `${formatNumber(inspection.usage.totalTokens)} tokens`
              : inspection?.retry?.boundary
              ? `retry ${inspection.retry.attempt ?? '?'}`
              : inspection?.traceId
                ? `trace ${shortId(inspection.traceId)}`
                : undefined
          }
        />
        {isInspectionLoading ? (
          <DebuggerSkeleton compact />
        ) : inspection ? (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            <DiffGroup label="Added" tone="text-mint" rows={inspection.diff.added} valueKey="after" />
            <DiffGroup label="Modified" tone="text-cyan" rows={inspection.diff.modified} />
            <DiffGroup label="Removed" tone="text-rose-300" rows={inspection.diff.removed} valueKey="before" />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PanelHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="text-xs font-bold uppercase tracking-wider text-white/60">{title}</div>
      {detail ? (
        <div className="truncate rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/50">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function DiffGroup({
  label,
  rows,
  tone,
  valueKey,
}: {
  label: string;
  rows: SnapshotDiffEntry[];
  tone: string;
  valueKey?: 'before' | 'after';
}) {
  return (
    <div>
      <div className={`mb-2 text-xs font-semibold ${tone}`}>
        {label} ({rows.length})
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/40">
          No changes.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={`${label}-${row.path}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <div className="break-all font-mono text-xs text-white/70">{row.path}</div>
              {valueKey ? (
                <pre className="mt-2 max-h-28 overflow-auto rounded bg-black/30 p-2 text-[10px] text-white/50">
                  {formatJson(row[valueKey])}
                </pre>
              ) : (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="max-h-28 overflow-auto rounded bg-black/30 p-2 text-[10px] text-rose-100/70">
                    {formatJson(row.before)}
                  </pre>
                  <pre className="max-h-28 overflow-auto rounded bg-black/30 p-2 text-[10px] text-mint/80">
                    {formatJson(row.after)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/70">
      {formatJson(value)}
    </pre>
  );
}

function DebuggerSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-black/20 p-3 ${compact ? 'h-[420px]' : 'h-48'}`}>
      <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-24 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/10" />
    </div>
  );
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatNumber(value: number | undefined) {
  return Intl.NumberFormat('en-US').format(value ?? 0);
}

function formatCost(value: number | undefined) {
  return `$${(value ?? 0).toFixed(4)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.';
}

function shortId(value: string | undefined) {
  if (!value) return 'n/a';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}
