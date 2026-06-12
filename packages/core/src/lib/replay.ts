import { createEvent, publishEvent } from './events.js';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';
import { diffSnapshotState } from './snapshot-diff.js';
import type {
  ExecutionContext,
  ExecutionSnapshot,
  SnapshotInspection,
} from '@pulsestack/contracts';

export class ReplayEngine {
  constructor(private readonly infra: PulseInfra, private readonly source = 'pulse-replay') {}

  async replayExecution(executionId: string, tenantId?: string) {
    const execution = await this.infra.getExecution(executionId, tenantId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const executionTenantId = execution.tenant_id ?? 'unknown';
    if (tenantId && executionTenantId !== tenantId) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const snapshots = await this.getExecutionSnapshots(executionId, executionTenantId);
    const replayId = createId('replay');
    const correlationId = execution.correlation_id ?? executionId;
    const originalContext = execution.output?.executionContext as ExecutionContext | undefined;
    const replayContext: ExecutionContext = {
      executionId,
      workflowId: execution.workflow_id,
      tenantId: executionTenantId,
      correlationId,
      traceId: originalContext?.traceId ?? createId('trace'),
      replaySessionId: replayId,
    };

    await publishEvent(
      this.infra,
      createEvent({
        type: 'replay.started',
        source: this.source,
        tenantId: executionTenantId,
        correlationId,
        workflowId: execution.workflow_id,
        executionId,
        executionContext: replayContext,
        payload: {
          replayId,
          replaySessionId: replayId,
          originalExecutionId: executionId,
          snapshotCount: snapshots.length,
        },
      }),
    );

    const finalSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    const replayState = finalSnapshot?.state ?? execution.output ?? {};
    const diff = {
      beforeKeys: Object.keys(execution.output ?? {}),
      replayKeys: Object.keys(replayState ?? {}),
      identical: JSON.stringify(execution.output ?? {}) === JSON.stringify(replayState),
    };

    await publishEvent(
      this.infra,
      createEvent({
        type: 'replay.completed',
        source: this.source,
        tenantId: executionTenantId,
        correlationId,
        workflowId: execution.workflow_id,
        executionId,
        executionContext: replayContext,
        payload: {
          replayId,
          replaySessionId: replayId,
          originalExecutionId: executionId,
          diff,
          replayState,
        },
      }),
    );

    return {
      replayId,
      replaySessionId: replayId,
      executionContext: replayContext,
      execution,
      snapshots,
      replayState,
      diff,
      timeline: buildSnapshotInspections(snapshots).map((inspection) => ({
        sequence: inspection.sequence,
        timestamp: inspection.timestamp,
        phase: inspection.phase,
        stepId: inspection.stepId,
        retry: inspection.retry,
        traceId: inspection.traceId,
        sideEffects: inspection.snapshot.sideEffects,
      })),
    };
  }

  async getSnapshotTimeline(executionId: string, tenantId?: string) {
    const execution = await this.infra.getExecution(executionId, tenantId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const snapshots = await this.getExecutionSnapshots(
      executionId,
      execution.tenant_id ?? tenantId,
    );
    return buildSnapshotInspections(snapshots).map((inspection) => ({
      sequence: inspection.sequence,
      timestamp: inspection.timestamp,
      phase: inspection.phase,
      stepId: inspection.stepId,
      stepKind: inspection.stepKind,
      retry: inspection.retry,
      traceId: inspection.traceId,
      spanId: inspection.spanId,
      stateKeys: Object.keys(inspection.snapshot.state).sort(),
      diffSummary: {
        added: inspection.diff.added.length,
        modified: inspection.diff.modified.length,
        removed: inspection.diff.removed.length,
      },
    }));
  }

  async inspectSnapshot(
    executionId: string,
    sequence: number,
    tenantId?: string,
  ) {
    const inspections = await this.inspectSnapshots(executionId, tenantId);
    const inspection = inspections.find((item) => item.sequence === sequence);
    if (!inspection) {
      throw new Error(`Snapshot ${sequence} not found for execution ${executionId}`);
    }
    return inspection;
  }

  async getStateAtStep(
    executionId: string,
    sequence: number,
    tenantId?: string,
  ) {
    const inspection = await this.inspectSnapshot(executionId, sequence, tenantId);
    return inspection.snapshot.state;
  }

  async getDiffFromPreviousStep(
    executionId: string,
    sequence: number,
    tenantId?: string,
  ) {
    const inspection = await this.inspectSnapshot(executionId, sequence, tenantId);
    return inspection.diff;
  }

  async inspectSnapshots(executionId: string, tenantId?: string) {
    const execution = await this.infra.getExecution(executionId, tenantId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const snapshots = await this.getExecutionSnapshots(
      executionId,
      execution.tenant_id ?? tenantId,
    );
    return buildSnapshotInspections(snapshots);
  }

  private async getExecutionSnapshots(executionId: string, tenantId?: string) {
    const rows = await this.infra.getSnapshots(executionId, tenantId);
    return rows.map(normalizeSnapshot);
  }
}

export function buildSnapshotInspections(
  snapshots: ExecutionSnapshot[],
): SnapshotInspection[] {
  return snapshots.map((snapshot, index) => {
    const previous = index > 0 ? snapshots[index - 1] : undefined;
    const metadata = snapshotMetadata(snapshot);
    return {
      sequence: snapshot.sequence,
      timestamp: snapshot.createdAt,
      phase: metadata.phase,
      stepId: metadata.stepId,
      stepKind: metadata.stepKind,
      retry: metadata.retry,
      traceId: metadata.traceId ?? snapshot.executionContext?.traceId,
      spanId: metadata.spanId,
      snapshot,
      diff: diffSnapshotState(previous?.state, snapshot.state),
    };
  });
}

function normalizeSnapshot(row: any): ExecutionSnapshot {
  return {
    id: String(row.id),
    executionId: String(row.executionId ?? row.execution_id),
    workflowId: String(row.workflowId ?? row.workflow_id),
    sequence: Number(row.sequence),
    state: normalizeRecord(row.state),
    sideEffects: normalizeSideEffects(row.sideEffects ?? row.side_effects),
    executionContext: row.executionContext ?? row.execution_context,
    createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSideEffects(value: unknown): ExecutionSnapshot['sideEffects'] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  return Array.isArray(parsed) ? (parsed as ExecutionSnapshot['sideEffects']) : [];
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function snapshotMetadata(snapshot: ExecutionSnapshot) {
  const effect = snapshot.sideEffects[0];
  const response =
    effect?.response && typeof effect.response === 'object'
      ? (effect.response as Record<string, unknown>)
      : {};
  const phase = String(response.phase ?? effect?.type ?? 'snapshot');
  const retry =
    phase === 'retry.boundary' || response.retry
      ? {
          boundary: phase === 'retry.boundary',
          ...(typeof response.attempt === 'number'
            ? { attempt: response.attempt }
            : {}),
          ...(typeof response.maxAttempts === 'number'
            ? { maxAttempts: response.maxAttempts }
            : {}),
          ...(typeof response.exhausted === 'boolean'
            ? { exhausted: response.exhausted }
            : {}),
          ...(Array.isArray(response.errors)
            ? { errors: response.errors.map(String) }
            : {}),
        }
      : undefined;
  return {
    phase,
    stepId:
      typeof response.stepId === 'string'
        ? response.stepId
        : effect?.key && !effect.key.startsWith('__')
          ? effect.key
          : undefined,
    stepKind:
      typeof response.stepKind === 'string'
        ? response.stepKind
        : effect?.key && !effect.key.startsWith('__')
          ? effect.type
          : undefined,
    retry,
    traceId: typeof response.traceId === 'string' ? response.traceId : undefined,
    spanId: typeof response.spanId === 'string' ? response.spanId : undefined,
  };
}
