# Production Deployment

This guide covers the minimum production-ready shape for running PulseStack outside a local contributor machine.

## Runtime Components

Deploy these services as independently scalable processes:

- `pulse-gateway`: public HTTP API, WebSocket event stream, auth, and service proxy
- `pulse-runtime`: workflow execution API and gRPC runtime service
- `pulse-events`: runtime event stream service
- `pulse-trace`: trace query service
- `pulse-replay`: replay reconstruction service
- `pulse-metrics`: workflow and observability metrics API
- `pulse-graph`: execution DAG API
- `pulse-web`: browser dashboard

Required backing services:

- PostgreSQL for workflows, executions, and snapshots
- Redis for event stream buffering
- NATS for runtime event fanout
- ClickHouse for events and traces

## Environment

Set these values for every backend service unless noted:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production`. |
| `LOG_LEVEL` | Runtime log level, usually `info`. |
| `HTTP_PORT` | HTTP listener port for the service. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection string. |
| `NATS_URL` | NATS connection string. |
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint. |
| `CLICKHOUSE_USER` | ClickHouse username. |
| `CLICKHOUSE_PASSWORD` | ClickHouse password. |
| `JWT_SECRET` | Strong secret used to sign gateway tokens. |
| `API_KEY` | Administrative API key for automation. |
| `TENANT_ID` | Default tenant used when no tenant header is supplied. |
| `PLUGIN_DIR` | Plugin directory mounted into runtime services. |
| `AUTH_DISABLED` | Must be `false` in production. |

Set service URLs on `pulse-gateway`:

| Variable | Default target |
| --- | --- |
| `RUNTIME_URL` | `http://pulse-runtime:4101` |
| `EVENTS_URL` | `http://pulse-events:4102` |
| `TRACE_URL` | `http://pulse-trace:4103` |
| `REPLAY_URL` | `http://pulse-replay:4104` |
| `METRICS_URL` | `http://pulse-metrics:4105` |
| `GRAPH_URL` | `http://pulse-graph:4106` |

Set `VITE_GATEWAY_URL` for `pulse-web` at build time so the dashboard points to the public gateway URL.

## Build

Install dependencies and build all packages:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Build container images from the compiled workspace or use the Helm chart in `infra/helm/pulsestack` as the deployment base.

## Startup Order

1. Start PostgreSQL, Redis, NATS, and ClickHouse.
2. Apply `infra/postgres-init.sql` and `infra/clickhouse-init.sql`.
3. Start `pulse-runtime`, `pulse-events`, `pulse-trace`, `pulse-replay`, `pulse-metrics`, and `pulse-graph`.
4. Start `pulse-gateway` after internal service DNS is available.
5. Serve `pulse-web` with `VITE_GATEWAY_URL` pointing at the gateway.

## Health Checks

Every backend exposes:

```text
GET /health
```

The gateway also exposes proxied runtime surfaces under `/api/*`. Use these checks after deployment:

```bash
curl https://gateway.example.com/health
curl -H "x-api-key: $API_KEY" https://gateway.example.com/api/runtime/executions
curl -H "x-api-key: $API_KEY" https://gateway.example.com/api/metrics/summary
```

## Authentication And RBAC

Production deployments must set `AUTH_DISABLED=false`.

Clients can authenticate with either:

- `x-api-key: <API_KEY>` for administrative automation
- `Authorization: Bearer <token>` from `POST /auth/token`

PulseStack includes three foundation roles:

| Role | Access |
| --- | --- |
| `admin` | All permissions. |
| `operator` | Read observability data, create executions, and run replay. |
| `viewer` | Read executions, events, traces, graphs, and metrics. |

Mutating execution and replay endpoints require write permissions. Read-only dashboard traffic can use the `viewer` role.

## Local Smoke Test

1. Start infrastructure:
   `docker compose -f infra/docker/docker-compose.yml up -d`
2. Install dependencies:
   `pnpm install`
3. Run services:
   `pnpm dev`

Default ports:

- `pulse-gateway`: `4000`
- `pulse-runtime`: `4101`
- `pulse-events`: `4102`
- `pulse-trace`: `4103`
- `pulse-replay`: `4104`
- `pulse-metrics`: `4105`
- `pulse-graph`: `4106`
- `pulse-web`: `3000`

## Kubernetes

Apply `infra/k8s/*.yaml` after publishing images, or install the Helm chart from `infra/helm/pulsestack`.

Before exposing the gateway publicly:

- replace all default secrets in chart values
- set `AUTH_DISABLED=false`
- configure TLS at the ingress or load balancer
- restrict direct access to internal services
- verify `/health`, `/api/runtime/executions`, and `/api/metrics/summary`

## Troubleshooting

- Database connection errors usually mean `DATABASE_URL` is wrong or migrations/init SQL did not run.
- Empty metrics usually mean ClickHouse is reachable but no runtime events or traces have been written yet.
- Gateway `401` responses mean no bearer token or API key was supplied.
- Gateway `403` responses mean the authenticated role lacks the endpoint permission.
- WebSocket failures on `/ws/events` usually mean the gateway cannot reach `EVENTS_URL`.
