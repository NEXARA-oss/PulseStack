import { PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';

export function registerLogRoutes(app: any, env: any, infra: PulseInfra) {
  // List logs with filtering and pagination
  app.get('/logs', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
    const query = url.searchParams.get('query') ?? '';
    const level = url.searchParams.get('level')?.split(',').filter(Boolean) ?? [];
    const source = url.searchParams.get('source')?.split(',').filter(Boolean) ?? [];
    const timeRange = url.searchParams.get('timeRange') ?? '1h';
    const traceId = url.searchParams.get('traceId') ?? '';
    const executionId = url.searchParams.get('executionId') ?? '';
    const startDate = url.searchParams.get('startDate') ?? '';
    const endDate = url.searchParams.get('endDate') ?? '';

    return infra.queryLogs(tenantId, {
      page, pageSize, query, level, source, timeRange,
      traceId, executionId, startDate, endDate,
    });
  });

  // Get log stats
  app.get('/logs/stats', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const timeRange = url.searchParams.get('timeRange') ?? '1h';
    return infra.getLogStats(tenantId, timeRange);
  });
}