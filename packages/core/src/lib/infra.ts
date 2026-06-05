import { createClient } from '@clickhouse/client';
import type { EventEnvelope, ExecutionSnapshot, TraceSpan, WorkflowDefinition } from '@pulsestack/contracts';
import { Redis } from 'ioredis';
import { connect, type NatsConnection, StringCodec } from 'nats';
import { Pool } from 'pg';
import { loadEnv } from './config.js';

const codec = StringCodec();

export type ExecutionRecord = {
  id: string;
  workflow_id: string;
  tenant_id: string;
  correlation_id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export class PulseInfra {
  readonly env = loadEnv();
  readonly pg = new Pool({ connectionString: this.env.DATABASE_URL });
  readonly redis = new Redis(this.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  readonly clickhouse = createClient({
    url: this.env.CLICKHOUSE_URL,
    username: this.env.CLICKHOUSE_USER,
    password: this.env.CLICKHOUSE_PASSWORD,
  });
  private natsPromise?: Promise<NatsConnection>;

  async nats() {
    if (!this.natsPromise) {
      this.natsPromise = connect({ servers: this.env.NATS_URL });
    }
    return this.natsPromise;
  }

  async persistWorkflow(workflow: WorkflowDefinition) {
    await this.pg.query(
      `insert into workflows (id, tenant_id, name, version, definition, correlation_id)
       values ($1, $2, $3, $4, $5::jsonb, $6)
       on conflict (id) do update
       set name = excluded.name, version = excluded.version, definition = excluded.definition, correlation_id = excluded.correlation_id`,
      [workflow.id, workflow.tenantId, workflow.name, workflow.version, JSON.stringify(workflow), workflow.correlationId],
    );
  }

  async createExecution(params: {
    executionId: string;
    workflowId: string;
    tenantId: string;
    correlationId: string;
    input: Record<string, unknown>;
  }) {
    await this.pg.query(
      `insert into executions (id, workflow_id, tenant_id, correlation_id, status, input, output)
       values ($1, $2, $3, $4, 'running', $5::jsonb, '{}'::jsonb)`,
      [params.executionId, params.workflowId, params.tenantId, params.correlationId, JSON.stringify(params.input)],
    );
  }

  async completeExecution(executionId: string, status: string, output: Record<string, unknown>) {
    await this.pg.query(
      `update executions set status = $2, output = $3::jsonb, updated_at = now() where id = $1`,
      [executionId, status, JSON.stringify(output)],
    );
  }

  async getExecution(executionId: string) {
    const result = await this.pg.query<ExecutionRecord>('select * from executions where id = $1', [executionId]);
    return result.rows[0] ?? null;
  }

  async listExecutions(limit = 25, offset = 0) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const safeOffset = Math.max(offset, 0);
    const result = await this.pg.query<ExecutionRecord>(
      'select * from executions order by created_at desc limit $1 offset $2',
      [safeLimit, safeOffset],
    );
    const countResult = await this.pg.query<{ total: string }>(
      'select count(*) as total from executions',
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);
    return { rows: result.rows, total, limit: safeLimit, offset: safeOffset };
  }

  async writeSnapshot(snapshot: ExecutionSnapshot) {
    await this.pg.query(
      `insert into snapshots (id, execution_id, workflow_id, sequence, state, side_effects)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        snapshot.id,
        snapshot.executionId,
        snapshot.workflowId,
        snapshot.sequence,
        JSON.stringify(snapshot.state),
        JSON.stringify(snapshot.sideEffects),
      ],
    );
  }

  async getSnapshots(executionId: string) {
    const result = await this.pg.query(
      'select * from snapshots where execution_id = $1 order by sequence asc',
      [executionId],
    );
    return result.rows;
  }

  async writeEvent(event: EventEnvelope) {
    const nc = await this.nats();
    nc.publish(`pulse.events.${event.type}`, codec.encode(JSON.stringify(event)));
    await this.redis.xadd('pulse:events', '*', 'event', JSON.stringify(event));
    await this.clickhouse.insert({
      table: 'events',
      values: [
        {
          id: event.id,
          type: event.type,
          source: event.source,
          tenant_id: event.tenantId,
          workflow_id: event.workflowId ?? '',
          execution_id: event.executionId ?? '',
          correlation_id: event.correlationId,
          timestamp: event.timestamp,
          payload: JSON.stringify(event.payload),
          tags: JSON.stringify(event.tags),
        },
      ],
      format: 'JSONEachRow',
    });
  }

  async writeSpan(span: TraceSpan) {
    await this.clickhouse.insert({
      table: 'traces',
      values: [
        {
          span_id: span.spanId,
          parent_span_id: span.parentSpanId ?? '',
          trace_id: span.traceId,
          execution_id: span.executionId,
          workflow_id: span.workflowId,
          name: span.name,
          kind: span.kind,
          status: span.status,
          started_at: span.startedAt,
          ended_at: span.endedAt ?? '',
          attributes: JSON.stringify(span.attributes),
          error: span.error ?? '',
        },
      ],
      format: 'JSONEachRow',
    });
  }

  async readRecentEvents(limit = 200) {
    const result = await this.clickhouse.query({
      query: `select * from events order by timestamp desc limit {limit:UInt32}`,
      query_params: { limit },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async readTrace(executionId: string) {
    const result = await this.clickhouse.query({
      query: `select * from traces where execution_id = {executionId:String} order by started_at asc`,
      query_params: { executionId },
      format: 'JSONEachRow',
    });
    return result.json();
  }

  async readMetrics() {
    const [totals, latency, executionTotals, recentExecutions] = await Promise.all([
      this.clickhouse.query({
        query:
          "select type, count() as total from events group by type order by total desc format JSONEachRow",
      }),
      this.clickhouse.query({
        query:
          "select kind, avg(dateDiff('millisecond', parseDateTime64BestEffort(started_at), parseDateTime64BestEffort(ended_at))) as avg_latency_ms from traces where ended_at != '' group by kind format JSONEachRow",
      }),
      this.pg.query<{ status: string; total: string }>(
        `select status, count(*)::text as total
         from executions
         group by status
         order by total desc`,
      ),
      this.pg.query<{ id: string; workflow_id: string; status: string; updated_at: string }>(
        `select id, workflow_id, status, updated_at
         from executions
         order by updated_at desc
         limit 10`,
      ),
    ]);
    const executionsByStatus = executionTotals.rows.map((row) => ({
      status: row.status,
      total: Number(row.total),
    }));
    const executionCount = executionsByStatus.reduce((sum, row) => sum + row.total, 0);
    const successfulExecutions = executionsByStatus
      .filter((row) => ['completed', 'success', 'succeeded'].includes(row.status))
      .reduce((sum, row) => sum + row.total, 0);
    const failedExecutions = executionsByStatus
      .filter((row) => ['failed', 'error'].includes(row.status))
      .reduce((sum, row) => sum + row.total, 0);

    return {
      events: await totals.json(),
      latency: await latency.json(),
      executions: {
        total: executionCount,
        succeeded: successfulExecutions,
        failed: failedExecutions,
        successRate: executionCount > 0 ? successfulExecutions / executionCount : 0,
        byStatus: executionsByStatus,
        recent: recentExecutions.rows,
      },
    };
  }

  async shutdown() {
    await this.pg.end();
    this.redis.disconnect();
    const nc = await this.nats().catch(() => null);
    nc?.close();
  }
}
