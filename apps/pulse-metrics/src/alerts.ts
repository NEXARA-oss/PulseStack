import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';

export function registerAlertRoutes(app: any, env: any, infra: PulseInfra) {
  // List alerts with filtering and pagination
  app.get('/alerts', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10);
    const severity = url.searchParams.get('severity')?.split(',').filter(Boolean) ?? [];
    const status = url.searchParams.get('status')?.split(',').filter(Boolean) ?? [];
    const category = url.searchParams.get('category')?.split(',').filter(Boolean) ?? [];
    const search = url.searchParams.get('search') ?? '';
    const source = url.searchParams.get('source') ?? '';
    const dateRange = url.searchParams.get('dateRange') ?? '7d';

    return infra.listAlerts(tenantId, {
      page,
      pageSize,
      severity,
      status,
      category,
      search,
      source,
      dateRange,
    });
  });

  // Acknowledge a single alert
  app.post('/alerts/:alertId/acknowledge', async (request: any, reply: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const alertId = (request.params as { alertId: string }).alertId;
    return infra.updateAlertStatus(tenantId, alertId, 'acknowledged');
  });

  // Resolve a single alert
  app.post('/alerts/:alertId/resolve', async (request: any, reply: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const alertId = (request.params as { alertId: string }).alertId;
    return infra.updateAlertStatus(tenantId, alertId, 'resolved');
  });

  // Batch acknowledge alerts
  app.post('/alerts/acknowledge-batch', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const body = request.body as { alertIds: string[] };
    const results = await Promise.all(
      body.alertIds.map((id: string) => infra.updateAlertStatus(tenantId, id, 'acknowledged')),
    );
    return { acknowledged: results.length, failed: body.alertIds.length - results.length };
  });

  // Notification preferences
  app.get('/alerts/notification-preferences', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    return infra.getNotificationPreferences(tenantId);
  });

  app.put('/alerts/notification-preferences', async (request: any) => {
    const tenantId = tenantIdFromHeaders(
      request.headers as Record<string, string | string[] | undefined>,
      env.TENANT_ID,
    );
    const body = request.body as Record<string, unknown>;
    return infra.updateNotificationPreferences(tenantId, body);
  });
}