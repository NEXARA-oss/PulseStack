create database if not exists pulsestack;

create table if not exists pulsestack.events (
  id String,
  type String,
  source String,
  tenant_id String,
  workflow_id String,
  execution_id String,
  correlation_id String,
  timestamp DateTime64(3),
  payload String,
  tags String
) engine = MergeTree
order by (timestamp, type, execution_id);

create table if not exists pulsestack.traces (
  span_id String,
  parent_span_id String,
  trace_id String,
  execution_id String,
  workflow_id String,
  name String,
  kind String,
  status String,
  started_at DateTime64(3),
  ended_at String,
  attributes String,
  error String
) engine = MergeTree
order by (started_at, execution_id, trace_id)
index idx_traces_execution_id execution_id type hash(4) granularity 4,
index idx_traces_status status type set(100) granularity 10;
