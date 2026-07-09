import { createBaseServer, loadEnv, PulseInfra, tenantIdFromHeaders } from '@pulsestack/core';

const env = loadEnv();
const infra = new PulseInfra();
const app = await createBaseServer('pulse-metrics');

app.get('/summary', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.readMetrics(tenantId);
});

// Performance Trends API
app.get('/trends', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const range = url.searchParams.get('range') ?? '7d';
  return infra.readTrends(tenantId, range);
});

// Trend Export API
app.get('/trends/export', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const range = url.searchParams.get('range') ?? '7d';
  const data = await infra.readTrends(tenantId, range);
  const rows = data.daily ?? data.hourly ?? [];
  const headers = 'Date,CPU Usage (%),Memory (%),Response Time (ms),Error Rate (%),Executions,Tokens Used,Cost ($)';
  const csvRows = rows.map((d: any) =>
    `${d.date},${d.cpuUsage.toFixed(2)},${d.memoryUtilization.toFixed(2)},${d.responseTime.toFixed(2)},${d.errorRate.toFixed(2)},${d.executions},${d.tokensUsed},${d.cost.toFixed(4)}`
  );
  const csv = [headers, ...csvRows].join('\n');
  return { csv };
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });