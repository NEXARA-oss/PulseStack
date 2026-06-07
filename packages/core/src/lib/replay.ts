import { createEvent, publishEvent } from './events.js';
import { createId } from './ids.js';
import type { PulseInfra } from './infra.js';

export class ReplayEngine {
  constructor(private readonly infra: PulseInfra, private readonly source = 'pulse-replay') {}

  async replayExecution(executionId: string) {
    const execution = await this.infra.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    const snapshots = await this.infra.getSnapshots(executionId);
    const replayId = createId('replay');
   
const tenantId = execution.tenant_id ?? 'unknown';
const correlationId = execution.correlation_id ?? executionId;
    await publishEvent(
      this.infra,
      createEvent({
        type: 'replay.started',
        source: this.source,
tenantId,
correlationId,
        workflowId: execution.workflow_id,
        executionId,
        payload: { replayId, snapshotCount: snapshots.length },
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
        payload: { replayId, diff, replayState },
      }),
    );

    return {
      replayId,
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
