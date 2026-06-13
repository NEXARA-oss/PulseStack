import { z } from 'zod';

export const tenantIdSchema = z.string().trim().min(1);

export const eventTypeSchema = z.enum([
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'agent.spawned',
  'agent.completed',
  'tool.called',
  'tool.failed',
  'llm.requested',
  'llm.completed',
  'memory.updated',
  'queue.enqueued',
  'queue.processed',
  'trigger.fired',
  'replay.started',
  'replay.completed',
  'span.recorded',
  'step.retrying',
  'step.failed',
]);

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(1),
  backoffMs: z.number().int().min(0).max(300_000).default(0),
  maxBackoffMs: z.number().int().min(0).max(300_000).default(30_000),
  exponential: z.boolean().default(true),
});

export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['agent', 'tool', 'llm', 'queue', 'memory', 'trigger']),
  dependsOn: z.array(z.string()).default([]),
  input: z.record(z.string(), z.unknown()).default({}),
  retry: retryPolicySchema.optional(),
});

export const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  tenantId: tenantIdSchema,
  correlationId: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(workflowStepSchema).min(1),
});

export const executionContextSchema = z.object({
  executionId: z.string(),
  workflowId: z.string(),
  tenantId: tenantIdSchema,
  correlationId: z.string(),
  traceId: z.string(),
  parentSpanId: z.string().optional(),
  retryAttempt: z.number().int().min(1).optional(),
  replaySessionId: z.string().optional(),
});

export const tokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const costEstimateSchema = z.object({
  inputCost: z.number().nonnegative().optional(),
  outputCost: z.number().nonnegative().optional(),
  totalCost: z.number().nonnegative().optional(),
});

export const usageAttributionSchema = z.object({
  tenantId: tenantIdSchema.optional(),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  stepId: z.string().optional(),
  retryAttempt: z.number().int().min(1).optional(),
  replaySessionId: z.string().optional(),
  model: z.string().optional(),
});

export const usageMetadataSchema = z.object({
  ...tokenUsageSchema.shape,
  ...costEstimateSchema.shape,
  attribution: usageAttributionSchema.optional(),
});

export const eventEnvelopeSchema = z.object({
  id: z.string(),
  version: z.literal(1),
  type: eventTypeSchema,
  source: z.string(),
  tenantId: tenantIdSchema,
  correlationId: z.string(),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  spanId: z.string().optional(),
  parentSpanId: z.string().optional(),
  executionContext: executionContextSchema.optional(),
  timestamp: z.string(),
  payload: z.record(z.string(), z.unknown()),
  tags: z.record(z.string(), z.string()).default({}),
});

export const traceSpanSchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().nullable(),
  traceId: z.string(),
  executionId: z.string(),
  workflowId: z.string(),
  name: z.string(),

  kind: z.enum(['workflow', 'agent', 'tool', 'llm', 'queue', 'memory', 'trigger', 'retry', 'replay']),

  status: z.enum(['ok', 'error', 'running']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  usage: usageMetadataSchema.optional(),
  executionContext: executionContextSchema.optional(),
  error: z.string().nullable(),
});

export const executionSnapshotSchema = z.object({
  id: z.string(),
  executionId: z.string(),
  workflowId: z.string(),
  sequence: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
  sideEffects: z.array(
    z.object({
      type: z.string(),
      key: z.string(),
      response: z.unknown(),
    }),
  ),
  executionContext: executionContextSchema.optional(),
  createdAt: z.string(),
});

export const snapshotDiffEntrySchema = z.object({
  path: z.string(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

export const snapshotDiffSchema = z.object({
  added: z.array(snapshotDiffEntrySchema),
  modified: z.array(snapshotDiffEntrySchema),
  removed: z.array(snapshotDiffEntrySchema),
});

export const snapshotInspectionSchema = z.object({
  sequence: z.number().int().nonnegative(),
  timestamp: z.string().optional(),
  phase: z.string(),
  stepId: z.string().optional(),
  stepKind: z.string().optional(),
  retry: z
    .object({
      boundary: z.boolean(),
      attempt: z.number().int().min(1).optional(),
      maxAttempts: z.number().int().min(1).optional(),
      exhausted: z.boolean().optional(),
      errors: z.array(z.string()).optional(),
    })
    .optional(),
  usage: usageMetadataSchema.optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  snapshot: executionSnapshotSchema,
  diff: snapshotDiffSchema,
});

export const executionRequestSchema = z.object({
  workflow: workflowDefinitionSchema,
  input: z.record(z.string(), z.unknown()).default({}),
  initiatedBy: z.string(),
  context: executionContextSchema.partial().optional(),
});

export const pluginManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  entrypoint: z.string(),
  capabilities: z.array(
    z.enum([
      'event-handler',
      'telemetry-exporter',
      'workflow-adapter',
      'storage-adapter',
      'tracing-adapter',
    ]),
  ),
});

export type EventType = z.infer<typeof eventTypeSchema>;
export type TenantId = z.infer<typeof tenantIdSchema>;
export type RetryPolicy = z.infer<typeof retryPolicySchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type ExecutionContext = z.infer<typeof executionContextSchema>;
export type TokenUsage = z.infer<typeof tokenUsageSchema>;
export type CostEstimate = z.infer<typeof costEstimateSchema>;
export type UsageAttribution = z.infer<typeof usageAttributionSchema>;
export type UsageMetadata = z.infer<typeof usageMetadataSchema>;
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
export type TraceSpan = z.infer<typeof traceSpanSchema>;
export type ExecutionSnapshot = z.infer<typeof executionSnapshotSchema>;
export type SnapshotDiffEntry = z.infer<typeof snapshotDiffEntrySchema>;
export type SnapshotDiff = z.infer<typeof snapshotDiffSchema>;
export type SnapshotInspection = z.infer<typeof snapshotInspectionSchema>;
export type ExecutionRequest = z.infer<typeof executionRequestSchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
