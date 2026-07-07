-- PostgreSQL Indexes for improved query performance
-- These indexes support common query patterns for executions and workflows

create index if not exists idx_executions_tenant_id on executions(tenant_id);
create index if not exists idx_executions_tenant_created_at on executions(tenant_id, created_at desc);
create index if not exists idx_workflows_tenant_id on workflows(tenant_id);
