import { createEvent, publishEvent } from './events.js';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';
import type { ExecutionContext } from '@pulsestack/contracts';

export class ReplayEngine {
  constructor(private readonly infra: PulseInfra, private readonly source = 'pulse-replay') {}

  async replayExecution(executionId: string) {
    const execution = await this.infra.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const snapshots = await this.infra.getSnapshots(executionId);
    const replayId = createId('replay');
    const originalContext = execution.output?.executionContext as
      | ExecutionContext
      | undefined;
    const replayContext: ExecutionContext = {
      executionId,
      workflowId: execution.workflow_id,
      tenantId: execution.tenant_id,
      correlationId: execution.correlation_id,
      traceId: originalContext?.traceId ?? execution.correlation_id,
      ...(originalContext?.parentSpanId
        ? { parentSpanId: originalContext.parentSpanId }
        : {}),
      replaySessionId: replayId,
    };
    await publishEvent(
      this.infra,
      createEvent({
        type: 'replay.started',
        source: this.source,
tenantId,
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
        tenantId,
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
      timeline: snapshots.map((snapshot: any) => ({
        sequence: snapshot.sequence,
        timestamp: snapshot.created_at,
        sideEffects: snapshot.side_effects,
      })),
    };
  }
}
