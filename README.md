# PulseStack

<p align="center">
  <img src="https://img.shields.io/badge/runtime-ai%20workflows-black?style=for-the-badge" />
  <img src="https://img.shields.io/badge/observability-distributed%20systems-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/status-active%20development-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/license-MIT-orange?style=for-the-badge" />
</p>

<p align="center">
  <h1 align="center">PulseStack</h1>
  <p align="center">
    Observability, Replay, and Runtime Intelligence for Distributed AI Systems.
  </p>
</p>

---

# Why PulseStack Exists

Modern AI systems are no longer single prompts.

They are:

- multi-agent workflows
- distributed automation pipelines
- tool-calling runtimes
- event-driven orchestrators
- long-running autonomous systems

But current observability tooling was built for:

- REST APIs
- microservices
- traditional backend systems

Not for:

- LLM execution chains
- agent memory flows
- workflow DAGs
- deterministic replay
- token-level tracing
- AI runtime debugging

## The Problem

When AI workflows fail in production, teams struggle to answer:

- Which agent step failed?
- What event triggered the cascade?
- Which tool call caused latency spikes?
- Why did the workflow produce inconsistent outputs?
- How do we replay executions deterministically?
- Which tenant or workflow version caused regressions?
- Where are tokens, retries, and costs being consumed?

Traditional monitoring tools cannot fully reconstruct AI-native execution flows.

---

# What PulseStack Solves

PulseStack provides a complete runtime intelligence layer for AI systems.

It enables teams to:

- trace distributed AI workflows in real time
- monitor agent execution pipelines
- replay workflow runs deterministically
- inspect DAG execution graphs
- stream runtime telemetry
- analyze workflow bottlenecks
- correlate events across services
- observe multi-agent systems at scale

---

# Core Architecture

```text
Agents / Workflows
        ↓
 Pulse Gateway API
        ↓
 Distributed Event Bus
        ↓
 Runtime Engine + DAG Executor
        ↓
 Observability Pipeline
        ↓
 ClickHouse + Postgres
        ↓
 Replay Engine + UI Console
```

---

# Features

## AI Workflow Runtime

Execute distributed AI workflows with event-driven orchestration.

## Distributed Event Pipeline

Real-time event streaming across services using async runtime messaging.

## Deterministic Replay Engine

Replay historical workflow executions for debugging and incident analysis.

## OpenTelemetry Tracing

Full execution visibility across agents, tools, services, and runtime events.

## DAG Execution Engine

Dependency-aware workflow execution and graph traversal.

## Plugin System

Extend PulseStack with custom runtime plugins and integrations.

## Runtime Metrics + Analytics

Track:

- latency
- retries
- token usage
- workflow throughput
- execution failures
- runtime anomalies

## React Operations Console

Inspect workflows, traces, and replay sessions visually.

## Kubernetes + Helm Support

Production-ready deployment assets included.

---

# Monorepo Structure

```bash
apps/
  pulse-gateway/
  pulse-runtime/
  pulse-events/
  pulse-web/

packages/
  contracts/
  core/
  sdk/
  plugin-sdk/
  ui/

infra/
  docker/
  helm/
  k8s/

plugins/
  audit-log/

proto/
  pulsestack.proto
```

For a deeper contributor-oriented view of the runtime internals, see
[PulseStack Distributed Runtime Architecture](docs/architecture/distributed-runtime.md).

---

# Tech Stack

| Layer          | Technology                 |
| -------------- | -------------------------- |
| Runtime        | Node.js + TypeScript       |
| Transport      | gRPC + WebSockets          |
| Messaging      | NATS                       |
| Observability  | OpenTelemetry              |
| Analytics      | ClickHouse                 |
| Persistence    | PostgreSQL                 |
| Frontend       | React + Vite               |
| Infrastructure | Docker + Kubernetes + Helm |
| Monorepo       | Turbo + pnpm               |

---

# Local Development

## Prerequisites

- Node.js 20+
- pnpm
- Docker

## Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

## Install Dependencies

```bash
pnpm install
```

## Start Development Runtime

```bash
pnpm dev
```

## Environment Setup

Create a `.env` file from the example file:

### Linux/macOS

```bash
cp .env.example .env
```

### Windows CMD

```cmd
copy .env.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

## Environment Variables

| Variable | Purpose | Default Value |
|----------|---------|---------------|
| RUNTIME_URL | Runtime engine service | http://localhost:4101 |
| EVENTS_URL | Event streaming service | http://localhost:4102 |
| TRACE_URL | Tracing service | http://localhost:4103 |
| REPLAY_URL | Replay engine | http://localhost:4104 |
| METRICS_URL | Metrics service | http://localhost:4105 |
| GRAPH_URL | Workflow graph service | http://localhost:4106 |
| VITE_GATEWAY_URL | Frontend gateway URL | http://localhost:4000 |

A sample `.env.example` file is included with default local development values.

## Troubleshooting

### Port already in use

Stop conflicting local services or change ports.

### Docker services not starting

Ensure Docker Desktop is running before executing:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### pnpm command not found

Install pnpm globally:

```bash
npm install -g pnpm
```

### Docker command not found

Ensure Docker Desktop is installed and running before starting infrastructure services.

# Local Services

| Service      | URL                                                      |
| ------------ | -------------------------------------------------------- |
| Gateway API  | [http://localhost:4000](http://localhost:4000)           |
| Runtime UI   | [http://localhost:3000](http://localhost:3000)           |
| Swagger Docs | [http://localhost:4101/docs](http://localhost:4101/docs) |

---

# Example Workflow Payload

```json
{
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
        "input": {
          "objective": "inspect queue health"
        }
      },
      {
        "id": "s2",
        "name": "FetchLogs",
        "kind": "tool",
        "dependsOn": ["s1"],
        "retry": {
          "maxAttempts": 3,
          "backoffMs": 250,
          "maxBackoffMs": 2000,
          "exponential": true
        },
        "input": {
          "tool": "logs.query",
          "range": "15m"
        }
      },
      {
        "id": "s3",
        "name": "Summarize",
        "kind": "llm",
        "dependsOn": ["s2"],
        "input": {
          "model": "gpt-4.1",
          "prompt": "Summarize anomalies"
        }
      }
    ]
  },
  "input": {
    "environment": "prod"
  },
  "initiatedBy": "operator"
}
```

## Runtime Retry Policies

Workflow steps can opt into bounded retry handling with a `retry` policy:

```json
{
  "id": "fetch_logs",
  "name": "Fetch logs",
  "kind": "tool",
  "retry": {
    "maxAttempts": 3,
    "backoffMs": 250,
    "maxBackoffMs": 2000,
    "exponential": true
  },
  "input": {
    "tool": "logs.query"
  }
}
```

Retries are disabled by default (`maxAttempts: 1`). When enabled, PulseStack emits `step.retrying`
events before another attempt, emits `step.failed` when attempts are exhausted, records retry metadata
in execution output and snapshots under `__retry`, and marks the workflow as failed instead of leaving
the execution in a running state.

---

# Roadmap

- Multi-tenant isolation
- RBAC + auth providers
- Workflow time-travel debugger
- Token cost analytics
- Agent memory visualization
- Live workflow graph rendering
- Distributed replay clustering
- ML anomaly detection
- AI safety event auditing
- CNCF/OpenTelemetry integrations

---

# Open Source Vision

PulseStack is designed as:

- an open runtime observability standard for AI systems
- a contributor-first infrastructure project
- a foundation for AI-native debugging ecosystems

We welcome:

- OSS contributors
- infrastructure engineers
- AI runtime builders
- observability engineers
- GSoC/GSSoC contributors
- distributed systems enthusiasts

---

# Contributing

```bash
git clone https://github.com/sreerevanth/PulseStack.git
cd PulseStack
pnpm install
pnpm dev
```

Open issues, discussions, and PRs are welcome.

---

# License

MIT License

---

# PulseStack
Building observability infrastructure for the next generation of autonomous systems.


# credits 
@sreerevanth - collaborater 
             - initial design 
             - system design 
             - founder of the idea 

```

```
