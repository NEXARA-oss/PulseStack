# API Reference

PulseStack exposes a unified REST API through the **pulse-gateway** service (default port `4000`). All `/api/*` routes require authentication unless `AUTH_DISABLED=true` is set.

---

## Authentication

All `/api/*` endpoints require one of:

- `Authorization: Bearer <jwt>` header
- `X-API-Key: <api_key>` header

Obtain a JWT by exchanging your API key at the token endpoint.

### `POST /auth/token`

Exchange an API key for a signed JWT.

**Request Headers**

| Header         | Value              | Required |
| -------------- | ------------------ | -------- |
| Content-Type   | application/json   | Yes      |

**Request Body**

| Field    | Type   | Required | Description          |
| -------- | ------ | -------- | -------------------- |
| `apiKey` | string | Yes      | Your platform API key |

**Example Request**

```bash
curl -X POST http://localhost:4000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your-api-key"}'
```

**Success Response** `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Error Response** `200` (denied token returned for invalid key)

```json
"eyJhbGciOiJIUzI1NiIs..."
```

The returned token will contain `"denied": true` in its payload when the key is invalid.

---

## Workflow Executions

### `POST /api/runtime/executions`

Create and execute a workflow.

**Request Headers**

| Header         | Value              | Required |
| -------------- | ------------------ | -------- |
| Content-Type   | application/json   | Yes      |
| Authorization  | Bearer \<token\>   | Yes*     |
| X-API-Key      | \<api_key\>        | Yes*     |

\* Provide either `Authorization` or `X-API-Key`.

**Request Body**

| Field                          | Type     | Required | Description                                    |
| ------------------------------ | -------- | -------- | ---------------------------------------------- |
| `workflow`                     | object   | Yes      | Workflow definition                            |
| `workflow.id`                  | string   | Yes      | Unique workflow identifier                     |
| `workflow.name`                | string   | Yes      | Human-readable workflow name                   |
| `workflow.version`             | string   | Yes      | Semantic version                               |
| `workflow.tenantId`            | string   | Yes      | Tenant identifier                              |
| `workflow.correlationId`       | string   | Yes      | Correlation ID for tracing                     |
| `workflow.metadata`            | object   | No       | Arbitrary key-value metadata                   |
| `workflow.steps`               | array    | Yes      | At least one workflow step (see below)         |
| `workflow.steps[].id`          | string   | Yes      | Unique step identifier                         |
| `workflow.steps[].name`        | string   | Yes      | Step display name                              |
| `workflow.steps[].kind`        | string   | Yes      | One of: `agent`, `tool`, `llm`, `queue`, `memory`, `trigger` |
| `workflow.steps[].dependsOn`   | string[] | No       | IDs of steps this step depends on              |
| `workflow.steps[].input`       | object   | No       | Step-specific input parameters                 |
| `workflow.steps[].retry`       | object   | No       | Retry policy (see below)                       |
| `input`                        | object   | No       | Global workflow input parameters               |
| `initiatedBy`                  | string   | Yes      | Identity of the caller                         |

**Retry Policy**

| Field          | Type    | Default | Description                          |
| -------------- | ------- | ------- | ------------------------------------ |
| `maxAttempts`  | integer | 1       | Max retry attempts (1–10)            |
| `backoffMs`    | integer | 0       | Initial backoff in milliseconds      |
| `maxBackoffMs` | integer | 30000   | Maximum backoff cap in milliseconds  |
| `exponential`  | boolean | true    | Use exponential backoff              |

**Example Request**

```bash
curl -X POST http://localhost:4000/api/runtime/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -d '{
    "workflow": {
      "id": "wf_agent_ops",
      "name": "Agent Ops",
      "version": "1.0.0",
      "tenantId": "local",
      "correlationId": "corr_agent_ops",
      "metadata": {},
      "steps": [
        {
          "id": "s1",
          "name": "Plan",
          "kind": "agent",
          "dependsOn": [],
          "input": { "objective": "inspect queue health" }
        },
        {
          "id": "s2",
          "name": "FetchLogs",
          "kind": "tool",
          "dependsOn": ["s1"],
          "retry": { "maxAttempts": 3, "backoffMs": 250, "maxBackoffMs": 2000, "exponential": true },
          "input": { "tool": "logs.query", "range": "15m" }
        },
        {
          "id": "s3",
          "name": "Summarize",
          "kind": "llm",
          "dependsOn": ["s2"],
          "input": { "model": "gpt-4.1", "prompt": "Summarize anomalies" }
        }
      ]
    },
    "input": { "environment": "prod" },
    "initiatedBy": "operator"
  }'
```

**Success Response** `200 OK`

```json
{
  "executionId": "exec_abc123",
  "traceId": "trace_abc",
  "output": {
    "steps": [
      {
        "stepId": "s1",
        "output": {},
        "costUsd": 0.002,
        "tokens": 0,
        "attempts": 1,
        "retry": { "maxAttempts": 1, "exhausted": false, "errors": [] }
      }
    ],
    "totalCostUsd": 0.018,
    "totalTokens": 350,
    "finalState": {}
  }
}
```

> **Note:** The execution runs synchronously and returns the full output on completion. For long-running workflows, monitor progress via the WebSocket event stream.

**Error Responses**

`401 Unauthorized`

```json
{ "message": "Unauthorized" }
```

`400 Bad Request` (validation failure)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Workflow validation failed",
  "issues": [
    { "stepId": "s2", "issue": "dependency 's1' not found" }
  ]
}
```

---

### `GET /api/runtime/executions`

List all executions.

**Request Headers**

| Header        | Value            | Required |
| ------------- | ---------------- | -------- |
| Authorization | Bearer \<token\> | Yes*     |
| X-API-Key     | \<api_key\>      | Yes*     |

**Example Request**

```bash
curl http://localhost:4000/api/runtime/executions \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
[
  {
    "id": "exec_abc123",
    "workflow_id": "wf_agent_ops",
    "tenant_id": "local",
    "correlation_id": "corr_agent_ops",
    "status": "completed",
    "input": {},
    "output": {},
    "created_at": "2026-05-28T10:00:00.000Z",
    "updated_at": "2026-05-28T10:00:05.000Z"
  }
]
```

---

### `GET /api/runtime/executions/:executionId`

Get a single execution by ID.

**Path Parameters**

| Parameter     | Type   | Description            |
| ------------- | ------ | ---------------------- |
| `executionId` | string | The execution identifier |

**Example Request**

```bash
curl http://localhost:4000/api/runtime/executions/exec_abc123 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
{
  "id": "exec_abc123",
  "workflow_id": "wf_agent_ops",
  "tenant_id": "local",
  "correlation_id": "corr_agent_ops",
  "status": "completed",
  "input": {},
  "output": {},
  "created_at": "2026-05-28T10:00:00.000Z",
  "updated_at": "2026-05-28T10:00:05.000Z"
}
```

**Error Response** `404 Not Found`

```json
{ "message": "Execution not found" }
```

---

## Events

### `GET /api/events/recent`

Fetch recently ingested events.

**Example Request**

```bash
curl http://localhost:4000/api/events/recent \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
[
  {
    "id": "evt_001",
    "type": "workflow.started",
    "source": "pulse-runtime",
    "tenant_id": "local",
    "correlation_id": "corr_agent_ops",
    "workflow_id": "wf_agent_ops",
    "execution_id": "exec_abc123",
    "timestamp": "2026-05-28T10:00:00.000Z",
    "payload": "{}",
    "tags": "{}"
  }
]
```

---

### `WS /ws/events`

WebSocket stream of real-time events from the NATS event bus.

**Connection**

```
ws://localhost:4000/ws/events
```

**Message Format**

Each message is a JSON-encoded `EventEnvelope` (published via NATS before storage):

```json
{
  "id": "evt_002",
  "version": 1,
  "type": "tool.called",
  "source": "pulse-runtime",
  "tenantId": "local",
  "correlationId": "corr_agent_ops",
  "workflowId": "wf_agent_ops",
  "executionId": "exec_abc123",
  "timestamp": "2026-05-28T10:00:01.000Z",
  "payload": { "tool": "logs.query" },
  "tags": { "traceparent": "00-abc123-def456-01" }
}
```

---

## Traces

### `GET /api/traces/:executionId`

Retrieve trace spans for a workflow execution.

**Path Parameters**

| Parameter     | Type   | Description            |
| ------------- | ------ | ---------------------- |
| `executionId` | string | The execution identifier |

**Example Request**

```bash
curl http://localhost:4000/api/traces/exec_abc123 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
[
  {
    "span_id": "span_001",
    "parent_span_id": "",
    "trace_id": "trace_abc",
    "execution_id": "exec_abc123",
    "workflow_id": "wf_agent_ops",
    "name": "workflow.execute",
    "kind": "workflow",
    "status": "ok",
    "started_at": "2026-05-28T10:00:00.000Z",
    "ended_at": "2026-05-28T10:00:05.000Z",
    "attributes": "{}",
    "error": ""
  },
  {
    "span_id": "span_002",
    "parent_span_id": "span_001",
    "trace_id": "trace_abc",
    "execution_id": "exec_abc123",
    "workflow_id": "wf_agent_ops",
    "name": "workflow.step.tool",
    "kind": "tool",
    "status": "ok",
    "started_at": "2026-05-28T10:00:01.000Z",
    "ended_at": "2026-05-28T10:00:02.000Z",
    "attributes": "{\"pulsestack.step.id\":\"s2\",\"pulsestack.step.kind\":\"tool\"}",
    "error": ""
  }
]
```

**Error Response** `200` (empty array when no traces found)

```json
[]
```

---

## Workflow Graph

### `GET /api/graph/:executionId`

Retrieve the DAG (directed acyclic graph) for a workflow execution.

**Path Parameters**

| Parameter     | Type   | Description            |
| ------------- | ------ | ---------------------- |
| `executionId` | string | The execution identifier |

**Example Request**

```bash
curl http://localhost:4000/api/graph/exec_abc123 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
{
  "nodes": [
    { "id": "s1", "data": { "label": "Plan", "kind": "agent" } },
    { "id": "s2", "data": { "label": "FetchLogs", "kind": "tool" } },
    { "id": "s3", "data": { "label": "Summarize", "kind": "llm" } }
  ],
  "edges": [
    { "id": "s1-s2", "source": "s1", "target": "s2" },
    { "id": "s2-s3", "source": "s2", "target": "s3" }
  ]
}
```

**Error Response** `404 Not Found`

```json
{ "message": "Execution not found" }
```

```json
{ "message": "Workflow not found" }
```

---

## Replay

### `POST /api/replay/:executionId`

Replay a completed execution deterministically from persisted snapshots.

**Path Parameters**

| Parameter     | Type   | Description            |
| ------------- | ------ | ---------------------- |
| `executionId` | string | The execution identifier |

**Example Request**

```bash
curl -X POST http://localhost:4000/api/replay/exec_abc123 \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
{
  "replayId": "replay_abc123",
  "execution": {
    "id": "exec_abc123",
    "workflow_id": "wf_agent_ops",
    "tenant_id": "local",
    "correlation_id": "corr_agent_ops",
    "status": "completed",
    "input": {},
    "output": {},
    "created_at": "2026-05-28T10:00:00.000Z",
    "updated_at": "2026-05-28T10:00:05.000Z"
  },
  "snapshots": [
    {
      "id": "snap_001",
      "execution_id": "exec_abc123",
      "workflow_id": "wf_agent_ops",
      "sequence": 0,
      "state": {},
      "side_effects": [{ "type": "agent", "key": "s1", "response": {} }],
      "created_at": "2026-05-28T10:00:01.000Z"
    }
  ],
  "replayState": {},
  "diff": {
    "beforeKeys": ["steps", "totalCostUsd", "totalTokens", "finalState"],
    "replayKeys": ["environment", "s1", "__retry"],
    "identical": false
  },
  "timeline": [
    {
      "sequence": 0,
      "timestamp": "2026-05-28T10:00:01.000Z",
      "sideEffects": [{ "type": "agent", "key": "s1", "response": {} }]
    }
  ]
}
```

---

## Metrics

### `GET /api/metrics/summary`

Retrieve aggregated runtime metrics (event volume, latency, throughput).

**Example Request**

```bash
curl http://localhost:4000/api/metrics/summary \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Success Response** `200 OK`

```json
{
  "events": [
    { "type": "tool.called", "total": "210" },
    { "type": "llm.requested", "total": "174" },
    { "type": "workflow.started", "total": "87" },
    { "type": "workflow.completed", "total": "85" },
    { "type": "workflow.failed", "total": "2" }
  ],
  "latency": [
    { "kind": "tool", "avg_latency_ms": 120.5 },
    { "kind": "llm", "avg_latency_ms": 450.3 },
    { "kind": "workflow", "avg_latency_ms": 5200.0 }
  ]
}
```

---

## Internal Service Endpoints

These endpoints are exposed by individual services and proxied through the gateway. They are documented here for direct-access scenarios (service mesh, gRPC, testing).

### pulse-events (port 4102)

| Method | Path         | Description                              |
| ------ | ------------ | ---------------------------------------- |
| POST   | `/ingest`    | Ingest a raw event envelope              |
| POST   | `/emit/:type`| Emit a typed event with trace context    |
| GET    | `/recent`    | Fetch recent events                      |
| WS     | `/stream`    | WebSocket stream of all NATS events      |

### pulse-runtime (port 4101)

| Method | Path                       | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/executions`              | Execute a workflow       |
| GET    | `/executions`              | List executions          |
| GET    | `/executions/:executionId` | Get execution by ID      |
| gRPC   | `Runtime.GetExecution`     | Get execution via gRPC   |

### pulse-trace (port 4103)

| Method | Path                       | Description                    |
| ------ | -------------------------- | ------------------------------ |
| GET    | `/executions/:executionId` | Get traces for execution       |
| GET    | `/search?executionId=`     | Search traces by execution ID  |

### pulse-replay (port 4104)

| Method | Path                                | Description         |
| ------ | ----------------------------------- | ------------------- |
| POST   | `/executions/:executionId/replay`   | Replay an execution |

### pulse-metrics (port 4105)

| Method | Path       | Description         |
| ------ | ---------- | ------------------- |
| GET    | `/summary` | Get metrics summary |

### pulse-graph (port 4106)

| Method | Path                            | Description     |
| ------ | ------------------------------- | --------------- |
| GET    | `/executions/:executionId/dag`  | Get workflow DAG |

---

## Event Types

Events emitted by the runtime use these types:

| Type                 | Description                              |
| -------------------- | ---------------------------------------- |
| `workflow.started`   | Workflow execution began                 |
| `workflow.completed` | Workflow execution finished successfully |
| `workflow.failed`    | Workflow execution failed                |
| `agent.spawned`      | Agent step started                       |
| `agent.completed`    | Agent step finished                      |
| `tool.called`        | Tool invocation started                  |
| `tool.failed`        | Tool invocation failed                   |
| `llm.requested`      | LLM call initiated                       |
| `llm.completed`      | LLM call returned                        |
| `memory.updated`     | Memory store was updated                 |
| `queue.enqueued`     | Item added to queue                      |
| `queue.processed`    | Queue item processed                     |
| `trigger.fired`      | Trigger condition met                    |
| `replay.started`     | Replay session began                     |
| `replay.completed`   | Replay session finished                  |
| `span.recorded`      | Trace span was recorded                  |
| `step.retrying`      | Step retry attempt starting              |
| `step.failed`        | Step exhausted all retry attempts        |

---

## Error Handling

All endpoints return errors in a consistent format:

**401 Unauthorized** — Missing or invalid authentication.

```json
{ "message": "Unauthorized" }
```

**404 Not Found** — Resource does not exist.

```json
{ "message": "Execution not found" }
```

**400 Bad Request** — Request validation failed.

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation error description"
}
```

**500 Internal Server Error** — Unexpected server failure.

```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```
