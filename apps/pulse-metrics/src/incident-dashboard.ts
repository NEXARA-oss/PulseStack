// ── Inline Types (no external package imports needed for testability) ──────────

type EventEnvelope = {
  id: string;
  type: string;
  source: string;
  tenantId: string;
  correlationId: string;
  workflowId?: string;
  executionId?: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
  tags: Record<string, string>;
};

type TraceSpan = {
  spanId: string;
  parentSpanId: string | null;
  traceId: string;
  executionId: string;
  workflowId: string;
  name: string;
  kind: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  attributes: Record<string, unknown>;
  usage?: Record<string, unknown>;
  error: string | null;
};

type ExecutionRecord = {
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

type ExecutionSnapshot = {
  id: string;
  execution_id: string;
  workflow_id: string;
  sequence: number;
  state: Record<string, unknown>;
  side_effects: Array<{ type: string; key: string; response: unknown }>;
  created_at?: string;
};

type PgQueryResult<T> = { rows: T[] };
type ClickHouseQueryResult<T> = { json: () => Promise<T[]> };

type PulseInfraLike = {
  pg: {
    query: <T>(text: string, params?: unknown[]) => Promise<PgQueryResult<T>>;
  };
  clickhouse: {
    query: (opts: { query: string; query_params?: Record<string, unknown>; format: string }) => Promise<ClickHouseQueryResult<Record<string, unknown>>>;
  };
  readRecentEvents: (limit: number, tenantId?: string) => Promise<unknown>;
  readTrace: (executionId: string, tenantId?: string) => Promise<unknown>;
};

// ── Failure Event Types ────────────────────────────────────────────────────────

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type IncidentStatus = 'active' | 'investigating' | 'mitigated' | 'resolved' | 'closed';

export type IncidentTimelineEntryType =
  | 'service_failure'
  | 'alert'
  | 'recovery'
  | 'root_cause_note'
  | 'snapshot_change'
  | 'event_anomaly'
  | 'workflow_failure'
  | 'execution_failure';

export type IncidentTimelineEntry = {
  id: string;
  incidentId: string;
  timestamp: string;
  type: IncidentTimelineEntryType;
  title: string;
  description: string;
  severity: IncidentSeverity;
  source: string;
  relatedResourceId?: string;
  relatedResourceType?: 'workflow' | 'execution' | 'event' | 'trace' | 'snapshot';
  metadata: Record<string, unknown>;
};

export type ServiceFailure = {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  tenantId: string;
  failedAt: string;
  failureType: string;
  errorMessage: string;
  errorTrace: string[];
  duration: number;
  affectedServices: string[];
  severity: IncidentSeverity;
  recovered: boolean;
  recoveredAt?: string;
};

export type AlertEvent = {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  message: string;
  severity: IncidentSeverity;
  source: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  relatedExecutionId?: string;
  relatedWorkflowId?: string;
};

export type RecoveryEvent = {
  id: string;
  executionId: string;
  workflowId: string;
  recoveredAt: string;
  recoveryType: 'auto' | 'manual' | 'retry' | 'rollback';
  durationMs: number;
  attempts: number;
  details: string;
};

export type RootCauseNote = {
  id: string;
  incidentId: string;
  createdAt: string;
  author: string;
  summary: string;
  detail: string;
  impactedServices: string[];
  contributingFactors: string[];
  resolution: string;
  preventativeMeasures: string[];
};

export type Incident = {
  id: string;
  tenantId?: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  detectedAt: string;
  mitigatedAt?: string;
  resolvedAt?: string;
  duration?: number;
  affectedServices: string[];
  failureCount: number;
  recoveryCount: number;
  timeline: IncidentTimelineEntry[];
  failures: ServiceFailure[];
  alerts: AlertEvent[];
  recoveries: RecoveryEvent[];
  rootCauseNotes: RootCauseNote[];
  relatedIncidentIds: string[];
};

export type IncidentSummary = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  detectedAt: string;
  mitigatedAt?: string;
  resolvedAt?: string;
  duration?: number;
  affectedServices: string[];
  failureCount: number;
  recoveryCount: number;
  rootCauseCount: number;
};

export type IncidentDashboard = {
  tenantId?: string;
  generatedAt: string;
  activeIncidents: IncidentSummary[];
  recentIncidents: IncidentSummary[];
  incidentTrends: {
    totalToday: number;
    totalThisWeek: number;
    totalThisMonth: number;
    avgResolutionTime: number;
    mostAffectedServices: Array<{ service: string; count: number }>;
    severityDistribution: Record<string, number>;
  };
  stats: {
    totalIncidents: number;
    activeCount: number;
    resolvedCount: number;
    openFailures: number;
    avgTimeToRecovery: number;
    currentUpstreamFailures: number;
  };
};

// ── Error event type patterns ──────────────────────────────────────────────────

const FAILURE_EVENT_TYPES = new Set([
  'workflow.failed',
  'step.failed',
  'tool.failed',
]);

const RECOVERY_EVENT_TYPES = new Set([
  'workflow.completed',
  'step.retrying',
  'replay.completed',
]);

const ALERT_EVENT_TYPES = new Set([
  'workflow.failed',
  'step.failed',
  'tool.failed',
]);

// ── Incident Timeline & Root Cause Analyzer ────────────────────────────────────

export class IncidentAnalyzer {
  constructor(private infra: PulseInfraLike) {}

  /**
   * Get full incident detail including timeline, failures, and root cause notes
   */
  async getIncident(incidentId: string, tenantId?: string): Promise<Incident | null> {
    // In a real implementation, this would query an incidents table.
    // For now, we reconstruct from execution/event data.
    const parts = incidentId.split(':');
    if (parts.length < 2) return null;

    const correlationId = parts[0];
    const workflowIdFilter = parts.length > 1 ? parts[1] : undefined;

    const [executions, events, traces] = await Promise.all([
      this.getExecutions(tenantId, correlationId),
      this.getEvents(200, tenantId),
      workflowIdFilter ? this.getTracesForWorkflow(workflowIdFilter, tenantId) : [],
    ]);

    if (executions.length === 0) return null;

    const failures = this.extractFailures(executions, traces);
    const alerts = this.extractAlerts(events);
    const recoveries = this.extractRecoveries(executions, events);
    const timeline = this.buildTimeline(executions, events, failures, alerts, recoveries);
    const affectedServices = [...new Set(executions.map((e) => e.workflow_id))];
    const failureCount = failures.length;
    const recoveryCount = recoveries.length;

    const startDate = new Date(
      Math.min(...executions.map((e) => new Date(e.created_at).getTime())),
    );
    const endDate = new Date(
      Math.max(...executions.map((e) => new Date(e.updated_at).getTime())),
    );

    return {
      id: incidentId,
      tenantId,
      title: `Incident: ${correlationId.slice(0, 8)}`,
      description: `Incident detected with ${failureCount} failure(s) across ${affectedServices.length} service(s)`,
      severity: this.determineSeverity(failureCount, affectedServices.length),
      status: recoveryCount >= failureCount && failureCount > 0 ? 'resolved' : 'active',
      startedAt: startDate.toISOString(),
      detectedAt: startDate.toISOString(),
      mitigatedAt: recoveryCount > 0 ? endDate.toISOString() : undefined,
      resolvedAt: recoveryCount >= failureCount ? endDate.toISOString() : undefined,
      duration: endDate.getTime() - startDate.getTime(),
      affectedServices,
      failureCount,
      recoveryCount,
      timeline,
      failures,
      alerts,
      recoveries,
      rootCauseNotes: [],
      relatedIncidentIds: [],
    };
  }

  /**
   * Get dashboard with all incident summaries and stats
   */
  async getDashboard(tenantId?: string): Promise<IncidentDashboard> {
    const [executions, events] = await Promise.all([
      this.getExecutions(tenantId),
      this.getEvents(500, tenantId),
    ]);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const failedExecs = executions.filter((e) => e.status === 'failed');
    const activeFailures = failedExecs.filter(
      (e) => new Date(e.updated_at).getTime() > now.getTime() - 24 * 60 * 60 * 1000,
    );

    // Build incidents grouped by correlation_id
    const incidentMap = this.groupIncidents(executions);

    const incidentSummaries: IncidentSummary[] = Array.from(incidentMap.entries())
      .map(([correlationId, execs]) => this.buildIncidentSummary(correlationId, execs))
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const activeIncidents = incidentSummaries.filter((i) => i.status === 'active' || i.status === 'investigating');
    const recentIncidents = incidentSummaries.filter(
      (i) => new Date(i.detectedAt) >= weekStart,
    );

    const todayIncidents = incidentSummaries.filter(
      (i) => new Date(i.detectedAt) >= todayStart,
    );
    const weekIncidents = incidentSummaries.filter(
      (i) => new Date(i.detectedAt) >= weekStart,
    );
    const monthIncidents = incidentSummaries.filter(
      (i) => new Date(i.detectedAt) >= monthStart,
    );

    const resolvedIncidents = incidentSummaries.filter((i) => i.resolvedAt);
    const avgResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, i) => sum + (i.duration ?? 0), 0) / resolvedIncidents.length
      : 0;

    const serviceCounts = new Map<string, number>();
    for (const execs of incidentMap.values()) {
      for (const e of execs) {
        serviceCounts.set(e.workflow_id, (serviceCounts.get(e.workflow_id) ?? 0) + 1);
      }
    }
    const mostAffectedServices = Array.from(serviceCounts.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const severityDistribution: Record<string, number> = {};
    for (const inc of incidentSummaries) {
      severityDistribution[inc.severity] = (severityDistribution[inc.severity] ?? 0) + 1;
    }

    const resolvedExecs = executions.filter((e) =>
      ['completed', 'success', 'succeeded'].includes(e.status),
    );
    const recoveries = executions.filter(
      (e) =>
        ['completed', 'success', 'succeeded'].includes(e.status) &&
        new Date(e.created_at).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const avgTimeToRecovery = recoveries.length > 0
      ? recoveries.reduce((sum, e) => {
          const created = new Date(e.created_at).getTime();
          const updated = new Date(e.updated_at).getTime();
          return sum + (updated - created);
        }, 0) / recoveries.length
      : 0;

    return {
      tenantId,
      generatedAt: now.toISOString(),
      activeIncidents,
      recentIncidents,
      incidentTrends: {
        totalToday: todayIncidents.length,
        totalThisWeek: weekIncidents.length,
        totalThisMonth: monthIncidents.length,
        avgResolutionTime,
        mostAffectedServices,
        severityDistribution,
      },
      stats: {
        totalIncidents: incidentSummaries.length,
        activeCount: activeIncidents.length,
        resolvedCount: resolvedIncidents.length,
        openFailures: activeFailures.length,
        avgTimeToRecovery,
        currentUpstreamFailures: activeFailures.length,
      },
    };
  }

  /**
   * Export incident report as structured data
   */
  async exportIncidentReport(
    incidentId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown> | null> {
    const incident = await this.getIncident(incidentId, tenantId);
    if (!incident) return null;

    return {
      report: {
        title: `Incident Report: ${incident.title}`,
        generatedAt: new Date().toISOString(),
        incident: {
          id: incident.id,
          severity: incident.severity,
          status: incident.status,
          startedAt: incident.startedAt,
          detectedAt: incident.detectedAt,
          resolvedAt: incident.resolvedAt,
          duration: incident.duration,
          affectedServices: incident.affectedServices,
        },
        failures: incident.failures.map((f) => ({
          id: f.id,
          workflowId: f.workflowId,
          failedAt: f.failedAt,
          failureType: f.failureType,
          errorMessage: f.errorMessage,
          severity: f.severity,
          recovered: f.recovered,
        })),
        timeline: incident.timeline.map((e) => ({
          timestamp: e.timestamp,
          type: e.type,
          title: e.title,
          severity: e.severity,
        })),
        recovery: {
          totalRecoveries: incident.recoveries.length,
          averageDurationMs: incident.recoveries.length > 0
            ? incident.recoveries.reduce((s, r) => s + r.durationMs, 0) / incident.recoveries.length
            : 0,
        },
        rootCauseNotes: incident.rootCauseNotes,
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        formatVersion: '1.0',
      },
    };
  }

  /**
   * Add a root cause note to an incident
   */
  async addRootCauseNote(
    incidentId: string,
    note: Omit<RootCauseNote, 'id' | 'incidentId' | 'createdAt'>,
  ): Promise<RootCauseNote> {
    return {
      id: `rcn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      incidentId,
      createdAt: new Date().toISOString(),
      ...note,
    };
  }

  // ── Private Data Access Methods ──────────────────────────────────────────

  private async getExecutions(tenantId?: string, correlationId?: string): Promise<ExecutionRecord[]> {
    let query: string;
    const params: unknown[] = [];

    if (tenantId && correlationId) {
      query = 'select * from executions where tenant_id = $1 and correlation_id = $2 order by created_at desc';
      params.push(tenantId, correlationId);
    } else if (tenantId) {
      query = 'select * from executions where tenant_id = $1 order by created_at desc';
      params.push(tenantId);
    } else if (correlationId) {
      query = 'select * from executions where correlation_id = $1 order by created_at desc';
      params.push(correlationId);
    } else {
      query = 'select * from executions order by created_at desc';
    }

    const result = await this.infra.pg.query<ExecutionRecord>(query, params);
    return result.rows;
  }

  private async getEvents(limit: number, tenantId?: string): Promise<EventEnvelope[]> {
    const rawEvents = await this.infra.readRecentEvents(limit, tenantId) as Array<Record<string, unknown>>;
    return rawEvents.map((e) => ({
      id: String(e.id ?? ''),
      type: String(e.type ?? ''),
      source: String(e.source ?? ''),
      tenantId: String(e.tenant_id ?? e.tenantId ?? ''),
      correlationId: String(e.correlation_id ?? e.correlationId ?? ''),
      workflowId: e.workflow_id ? String(e.workflow_id) : undefined,
      executionId: e.execution_id ? String(e.execution_id) : undefined,
      timestamp: String(e.timestamp ?? ''),
      payload: typeof e.payload === 'string' ? safeParseJson(e.payload) : (e.payload as Record<string, unknown>) ?? {},
      tags: typeof e.tags === 'string' ? (safeParseJson(e.tags) as Record<string, string>) : (e.tags as Record<string, string>) ?? {},
    }));
  }

  private async getTracesForWorkflow(workflowId: string, tenantId?: string): Promise<TraceSpan[]> {
    // Use query method on clickhouse
    const result = await this.infra.clickhouse.query({
      query: 'select * from traces where workflow_id = {workflowId:String} order by started_at asc',
      query_params: { workflowId },
      format: 'JSONEachRow',
    });
    const rows = await result.json();
    return rows.map((r) => ({
      spanId: String(r.span_id ?? ''),
      parentSpanId: r.parent_span_id ? String(r.parent_span_id) : null,
      traceId: String(r.trace_id ?? ''),
      executionId: String(r.execution_id ?? ''),
      workflowId: String(r.workflow_id ?? ''),
      name: String(r.name ?? ''),
      kind: String(r.kind ?? ''),
      status: String(r.status ?? ''),
      startedAt: String(r.started_at ?? ''),
      endedAt: r.ended_at ? String(r.ended_at) : null,
      attributes: typeof r.attributes === 'string' ? safeParseJson(r.attributes) : (r.attributes as Record<string, unknown>) ?? {},
      error: r.error ? String(r.error) : null,
    }));
  }

  // ── Analysis Methods ─────────────────────────────────────────────────────────

  private extractFailures(
    executions: ExecutionRecord[],
    traces: TraceSpan[],
  ): ServiceFailure[] {
    const failures: ServiceFailure[] = [];
    const failedExecs = executions.filter((e) => ['failed', 'error'].includes(e.status));

    for (const exec of failedExecs) {
      const errorOutput = exec.output?.error;
      const errorMessage = typeof errorOutput === 'string' ? errorOutput : JSON.stringify(exec.output ?? {});

      const relevantTraces = traces.filter(
        (t) =>
          t.executionId === exec.id && t.status === 'error',
      );

      const errorTrace = relevantTraces.map((t) => `[${t.kind}] ${t.name}: ${t.error ?? 'unknown error'}`);

      const execTime = new Date(exec.updated_at).getTime() - new Date(exec.created_at).getTime();

      failures.push({
        id: `failure-${exec.id}`,
        executionId: exec.id,
        workflowId: exec.workflow_id,
        workflowName: exec.workflow_id,
        tenantId: exec.tenant_id,
        failedAt: exec.updated_at,
        failureType: errorTrace.length > 0 ? errorTrace[0].split(':')[0] : 'execution_error',
        errorMessage: errorMessage.length > 200 ? errorMessage.slice(0, 200) : errorMessage,
        errorTrace,
        duration: execTime,
        affectedServices: [exec.workflow_id],
        severity: 'high',
        recovered: false,
      });
    }

    return failures;
  }

  private extractAlerts(events: EventEnvelope[]): AlertEvent[] {
    return events
      .filter((e) => FAILURE_EVENT_TYPES.has(e.type))
      .map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        type: e.type,
        title: this.getAlertTitle(e),
        message: typeof e.payload?.error === 'string' ? e.payload.error : `Event: ${e.type}`,
        severity: e.type === 'workflow.failed' ? 'high' : 'medium',
        source: e.source,
        acknowledged: false,
        relatedExecutionId: e.executionId,
        relatedWorkflowId: e.workflowId,
      }));
  }

  private extractRecoveries(
    executions: ExecutionRecord[],
    events: EventEnvelope[],
  ): RecoveryEvent[] {
    const recoveries: RecoveryEvent[] = [];
    const completedExecs = executions.filter((e) =>
      ['completed', 'success', 'succeeded'].includes(e.status),
    );

    for (const exec of completedExecs) {
      const created = new Date(exec.created_at).getTime();
      const updated = new Date(exec.updated_at).getTime();
      const duration = Math.max(updated - created, 0);

      // Count retry events for this execution
      const retryEvents = events.filter(
        (e) => e.executionId === exec.id && e.type === 'step.retrying',
      );

      recoveries.push({
        id: `recovery-${exec.id}`,
        executionId: exec.id,
        workflowId: exec.workflow_id,
        recoveredAt: exec.updated_at,
        recoveryType: retryEvents.length > 0 ? 'retry' : 'auto',
        durationMs: duration,
        attempts: Math.max(retryEvents.length + 1, 1),
        details: `Execution completed after ${duration}ms`,
      });
    }

    return recoveries;
  }

  private buildTimeline(
    executions: ExecutionRecord[],
    events: EventEnvelope[],
    failures: ServiceFailure[],
    alerts: AlertEvent[],
    recoveries: RecoveryEvent[],
  ): IncidentTimelineEntry[] {
    const entries: IncidentTimelineEntry[] = [];
    const incidentId = `inc-${executions[0]?.correlation_id ?? 'unknown'}`;

    // Add failure events
    for (const failure of failures) {
      entries.push({
        id: `tl-failure-${failure.id}`,
        incidentId,
        timestamp: failure.failedAt,
        type: 'service_failure',
        title: `Failure: ${failure.workflowName}`,
        description: failure.errorMessage,
        severity: failure.severity,
        source: 'execution',
        relatedResourceId: failure.executionId,
        relatedResourceType: 'execution',
        metadata: { failureType: failure.failureType, errorTrace: failure.errorTrace },
      });
    }

    // Add alert events
    for (const alert of alerts) {
      entries.push({
        id: `tl-alert-${alert.id}`,
        incidentId,
        timestamp: alert.timestamp,
        type: 'alert',
        title: alert.title,
        description: alert.message,
        severity: alert.severity,
        source: alert.source,
        relatedResourceId: alert.relatedExecutionId,
        relatedResourceType: 'event',
        metadata: { eventType: alert.type, acknowledged: alert.acknowledged },
      });
    }

    // Add recovery events
    for (const recovery of recoveries) {
      entries.push({
        id: `tl-recovery-${recovery.id}`,
        incidentId,
        timestamp: recovery.recoveredAt,
        type: 'recovery',
        title: `Recovery: ${recovery.workflowId}`,
        description: recovery.details,
        severity: 'info',
        source: 'execution',
        relatedResourceId: recovery.executionId,
        relatedResourceType: 'execution',
        metadata: {
          recoveryType: recovery.recoveryType,
          attempts: recovery.attempts,
          durationMs: recovery.durationMs,
        },
      });
    }

    // Add workflow failure events from event stream
    for (const event of events) {
      if (event.type === 'workflow.failed') {
        entries.push({
          id: `tl-wf-failure-${event.id}`,
          incidentId,
          timestamp: event.timestamp,
          type: 'workflow_failure',
          title: `Workflow Failed: ${event.workflowId ?? 'unknown'}`,
          description: typeof event.payload?.error === 'string' ? event.payload.error : 'Workflow execution failed',
          severity: 'high',
          source: event.source,
          relatedResourceId: event.executionId,
          relatedResourceType: 'workflow',
          metadata: { eventType: event.type, payload: event.payload },
        });
      }
    }

    // Sort by timestamp ascending
    return entries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  private groupIncidents(
    executions: ExecutionRecord[],
  ): Map<string, ExecutionRecord[]> {
    const groupMap = new Map<string, ExecutionRecord[]>();

    for (const exec of executions) {
      const key = exec.correlation_id || exec.id;
      const existing = groupMap.get(key) ?? [];
      existing.push(exec);
      groupMap.set(key, existing);
    }

    return groupMap;
  }

  private buildIncidentSummary(
    correlationId: string,
    executions: ExecutionRecord[],
  ): IncidentSummary {
    const failures = executions.filter((e) => ['failed', 'error'].includes(e.status));
    const recoveries = executions.filter((e) =>
      ['completed', 'success', 'succeeded'].includes(e.status),
    );
    const affectedServices = [...new Set(executions.map((e) => e.workflow_id))];
    const failureCount = failures.length;
    const recoveryCount = recoveries.length;

    const startDate = new Date(
      Math.min(...executions.map((e) => new Date(e.created_at).getTime())),
    );
    const endDate = new Date(
      Math.max(...executions.map((e) => new Date(e.updated_at).getTime())),
    );
    const duration = endDate.getTime() - startDate.getTime();

    const status: IncidentStatus =
      failureCount === 0
        ? 'resolved'
        : recoveryCount > 0 && recoveryCount >= failureCount
          ? 'resolved'
          : recoveryCount > 0
            ? 'mitigated'
            : 'active';

    return {
      id: `inc-${correlationId}`,
      title: `Incident: ${correlationId.slice(0, 8)}`,
      severity: this.determineSeverity(failureCount, affectedServices.length),
      status,
      startedAt: startDate.toISOString(),
      detectedAt: startDate.toISOString(),
      mitigatedAt: status === 'mitigated' || status === 'resolved' ? endDate.toISOString() : undefined,
      resolvedAt: status === 'resolved' ? endDate.toISOString() : undefined,
      duration,
      affectedServices,
      failureCount,
      recoveryCount,
      rootCauseCount: 0,
    };
  }

  private determineSeverity(
    failureCount: number,
    serviceCount: number,
  ): IncidentSeverity {
    if (failureCount > 10 || serviceCount > 5) return 'critical';
    if (failureCount > 5 || serviceCount > 3) return 'high';
    if (failureCount > 2 || serviceCount > 1) return 'medium';
    if (failureCount > 0) return 'low';
    return 'info';
  }

  private getAlertTitle(event: EventEnvelope): string {
    switch (event.type) {
      case 'workflow.failed':
        return `Workflow Failure: ${event.workflowId ?? 'unknown'}`;
      case 'step.failed':
        return `Step Failure: ${event.workflowId ?? 'unknown'}`;
      case 'tool.failed':
        return `Tool Failure: ${event.workflowId ?? 'unknown'}`;
      default:
        return `Alert: ${event.type}`;
    }
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function safeParseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return (value as Record<string, unknown>) ?? {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}