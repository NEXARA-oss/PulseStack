import { json } from 'stream/consumers';
import { can, createBaseServer, isTenantMatch, loadEnv, tenantIdFromHeaders, type Permission, type Principal } from '@pulsestack/core';
import { request } from 'undici';

const env = loadEnv();
type JwtCapableApp = Awaited<ReturnType<typeof createBaseServer>> & {
  jwt: {
    sign(payload: Record<string, unknown>): string;
  };
  get(path: string, opts: { websocket: true }, handler: WebsocketHandlerLike): unknown;
};

type JwtCapableRequest = {
  url: string;
  headers: {
    authorization?: string;
    'x-api-key'?: string | string[];
    'x-tenant-id'?: string | string[];
  };
  jwtVerify(): Promise<Principal>;
  user?: Principal;
};

type WebsocketLike = {
  send(data: string): void;
  close(): void;
  on(event: 'close', listener: () => void): void;
};

type WebsocketHandlerLike = (socket: WebsocketLike, request: JwtCapableRequest) => void | Promise<void>;

const app = (await createBaseServer('pulse-gateway')) as JwtCapableApp;

const services = {
  runtime: process.env.RUNTIME_URL ?? 'http://localhost:4101',
  events: process.env.EVENTS_URL ?? 'http://localhost:4102',
  trace: process.env.TRACE_URL ?? 'http://localhost:4103',
  replay: process.env.REPLAY_URL ?? 'http://localhost:4104',
  metrics: process.env.METRICS_URL ?? 'http://localhost:4105',
  graph: process.env.GRAPH_URL ?? 'http://localhost:4106',
};

async function proxyJson(
  url: string,
  init?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  },
) {
  const response = await request(url, {
    method: init?.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...forwardLineageHeaders(init?.headers),
      ...forwardTenantHeader(init?.headers),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  return await json(response.body);
}

app.post('/auth/token', async (request, reply) => {
  const body = (request.body as { apiKey?: string }) ?? {};
  if (body.apiKey !== env.API_KEY) {
    return reply.code(401).send({ message: 'Unauthorized' });
  }
  // Role is always assigned server-side. Accepting a caller-supplied role field
  // would allow any holder of a valid API key to self-escalate to admin.
  return { token: app.jwt.sign({ sub: 'operator', tenantId: env.TENANT_ID, role: 'operator' }) };
});

function requiredPermission(method: string, url: string): Permission | null {
  if (!url.startsWith('/api')) return null;
  if (url.startsWith('/api/runtime/executions') && method === 'POST') return 'execution:write';
  if (url.startsWith('/api/runtime/executions')) return 'execution:read';
  if (url.startsWith('/api/runtime/workflows')) return 'execution:read';
  if (url.startsWith('/api/runtime/tenants')) return 'execution:read';
  if (url.startsWith('/api/events')) return 'event:read';
  if (url.startsWith('/api/traces')) return 'trace:read';
  if (url.startsWith('/api/graph')) return 'graph:read';
  if (url.startsWith('/api/metrics')) return 'metric:read';
  if (url.startsWith('/api/replay') && method === 'POST') return 'replay:write';
  if (url.startsWith('/api/replay')) return 'trace:read';
  return null;
}

function authenticateRequest(request: JwtCapableRequest, reply: any): boolean {
  const apiKey = request.headers['x-api-key'];
  if (apiKey === env.API_KEY) {
    request.user = { sub: 'api-key', tenantId: env.TENANT_ID, role: 'admin' };
    return true;
  }
  const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!bearer) {
    reply.code(401).send({ message: 'Unauthorized: Missing or invalid authentication. Provide X-Api-Key header or Authorization bearer token.' });
    return false;
  }
  return false;
}

app.addHook('preHandler', async (request, reply) => {
  const jwtRequest = request as unknown as JwtCapableRequest;
  const permission = requiredPermission(request.method, request.url);
  if (!permission) return;
  if (env.AUTH_DISABLED) {
    jwtRequest.user = { sub: 'local', tenantId: env.TENANT_ID, role: 'admin' };
    return validateRequestTenant(jwtRequest, reply);
  }
  const apiKey = jwtRequest.headers['x-api-key'];
  if (apiKey === env.API_KEY) {
    jwtRequest.user = { sub: 'api-key', tenantId: env.TENANT_ID, role: 'admin' };
    return validateRequestTenant(jwtRequest, reply);
  }
  const bearer = jwtRequest.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!bearer) return reply.code(401).send({ message: 'Unauthorized: Missing or invalid authentication. Provide X-Api-Key header or Authorization bearer token.' });
  const principal = await jwtRequest.jwtVerify();
  jwtRequest.user = principal;
  if (!can(principal, permission)) return reply.code(403).send({ message: 'Forbidden', permission });
  return validateRequestTenant(jwtRequest, reply);
});

app.post('/api/runtime/executions', async (request) =>
  proxyJson(`${services.runtime}/executions`, {
    method: 'POST',
    body: request.body,
    headers: request.headers,
  }),
);
app.get('/api/runtime/executions', async (request) => {
  const { limit, offset } = request.query as { limit?: string; offset?: string };
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  return proxyJson(`${services.runtime}/executions${qs ? `?${qs}` : ''}`, {
    headers: request.headers,
  });
});
app.get('/api/runtime/executions/:executionId', async (request) =>
  proxyJson(`${services.runtime}/executions/${(request.params as { executionId: string }).executionId}`, {
    headers: request.headers,
  }),
);
app.get('/api/runtime/executions/:executionId/usage', async (request) =>
  proxyJson(`${services.runtime}/executions/${(request.params as { executionId: string }).executionId}/usage`, {
    headers: request.headers,
  }),
);
app.get('/api/runtime/workflows/:workflowId/usage', async (request) =>
  proxyJson(`${services.runtime}/workflows/${(request.params as { workflowId: string }).workflowId}/usage`, {
    headers: request.headers,
  }),
);
app.get('/api/runtime/tenants/:tenantId/usage', async (request) =>
  proxyJson(`${services.runtime}/tenants/${(request.params as { tenantId: string }).tenantId}/usage`, {
    headers: request.headers,
  }),
);
app.get('/api/events/recent', async (request) =>
  proxyJson(`${services.events}/recent`, { headers: request.headers }),
);
app.get('/api/traces/:executionId', async (request) =>
  proxyJson(`${services.trace}/executions/${(request.params as { executionId: string }).executionId}`, {
    headers: request.headers,
  }),
);
app.get('/api/graph/:executionId', async (request) =>
  proxyJson(`${services.graph}/executions/${(request.params as { executionId: string }).executionId}/dag`, {
    headers: request.headers,
  }),
);
app.get('/api/metrics/summary', async (request) =>
  proxyJson(`${services.metrics}/summary`, { headers: request.headers }),
);
app.post('/api/replay/:executionId', async (request) =>
  proxyJson(`${services.replay}/executions/${(request.params as { executionId: string }).executionId}/replay`, {
    method: 'POST',
    headers: request.headers,
  }),
);
app.get('/api/replay/:executionId/snapshots', async (request) =>
  proxyJson(`${services.replay}/executions/${(request.params as { executionId: string }).executionId}/snapshots`, {
    headers: request.headers,
  }),
);
app.get('/api/replay/:executionId/snapshots/:sequence', async (request) => {
  const params = request.params as { executionId: string; sequence: string };
  return proxyJson(`${services.replay}/executions/${params.executionId}/snapshots/${params.sequence}`, {
    headers: request.headers,
  });
});
app.get('/api/replay/:executionId/snapshots/:sequence/state', async (request) => {
  const params = request.params as { executionId: string; sequence: string };
  return proxyJson(`${services.replay}/executions/${params.executionId}/snapshots/${params.sequence}/state`, {
    headers: request.headers,
  });
});
app.get('/api/replay/:executionId/snapshots/:sequence/diff', async (request) => {
  const params = request.params as { executionId: string; sequence: string };
  return proxyJson(`${services.replay}/executions/${params.executionId}/snapshots/${params.sequence}/diff`, {
    headers: request.headers,
  });
});
app.get('/api/traces/:executionId/snapshots', async (request) =>
  proxyJson(`${services.trace}/executions/${(request.params as { executionId: string }).executionId}/snapshots`, {
    headers: request.headers,
  }),
);

app.get('/ws/events', { websocket: true }, async (socket, request) => {
  if (!env.AUTH_DISABLED) {
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const apiKey = request.headers['x-api-key'];
    if (apiKey !== env.API_KEY && !bearer) {
      socket.send(JSON.stringify({ error: 'Unauthorized' }));
      socket.close();
      return;
    }
    if (bearer) {
      try {
        request.user = await request.jwtVerify();
      } catch {
        socket.send(JSON.stringify({ error: 'Unauthorized' }));
        socket.close();
        return;
      }
    }
    if (apiKey === env.API_KEY) {
      request.user = { sub: 'api-key', tenantId: env.TENANT_ID, role: 'admin' };
    }
  } else {
    request.user = { sub: 'local', tenantId: env.TENANT_ID, role: 'admin' };
  }

  const queryTenantId = (request as unknown as { query?: { tenantId?: string } }).query?.tenantId;
  const requestedTenantId = tenantIdFromHeaders(
    {
      ...request.headers,
      ...(queryTenantId ? { 'x-tenant-id': queryTenantId } : {}),
    },
    request.user?.tenantId ?? env.TENANT_ID,
  );
  if (!isTenantMatch(request.user?.tenantId, requestedTenantId)) {
    socket.send(JSON.stringify({ error: 'Forbidden', reason: 'Tenant mismatch' }));
    socket.close();
    return;
  }

  const upstream = new WebSocket(
    `${services.events.replace('http', 'ws')}/stream?tenantId=${encodeURIComponent(requestedTenantId)}`,
  );
  upstream.onmessage = (event) => socket.send(event.data.toString());
  upstream.onclose = () => socket.close();
  socket.on('close', () => upstream.close());
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });

function validateRequestTenant(request: JwtCapableRequest, reply: any) {
  let requestedTenantId: string;
  try {
    requestedTenantId = tenantIdFromHeaders(request.headers, request.user?.tenantId ?? env.TENANT_ID);
  } catch {
    return reply.code(400).send({ message: 'Missing or invalid tenant context' });
  }
  if (!isTenantMatch(request.user?.tenantId, requestedTenantId)) {
    return reply.code(403).send({ message: 'Forbidden', reason: 'Tenant mismatch' });
  }
  request.headers['x-tenant-id'] = requestedTenantId;
}

function forwardLineageHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
) {
  if (!headers) return {};
  return {
    ...singleHeader(headers, 'traceparent'),
    ...singleHeader(headers, 'tracestate'),
    ...singleHeader(headers, 'x-correlation-id'),
  };
}

function forwardTenantHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
) {
  if (!headers) return {};
  return singleHeader(headers, 'x-tenant-id');
}

function singleHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name];
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized ? { [name]: normalized } : {};
}
