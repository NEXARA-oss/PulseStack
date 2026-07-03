import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import { z } from 'zod';
import { loadEnv } from './config.js';
import { createLogger } from './logger.js';

const tenantIdSchema = z.string().trim().min(1);

export async function createBaseServer(service: string) {
  const env = loadEnv();
  const logger = createLogger(service);
  const app = Fastify({
    logger,
    bodyLimit: 1048576,
  });

  // Restrict CORS to the configured frontend origin instead of using
  // origin: true, which reflects every incoming Origin header including
  // the literal string "null". Browsers send Origin: null for requests
  // from local file:// pages and sandboxed iframes, so origin: true
  // effectively grants those contexts a permissive CORS response.
  const allowedOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });
  await app.register(rateLimit, { max: 250, timeWindow: '1 minute' });
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${service} API`,
        version: '0.1.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await app.register(websocket);

  app.decorate('verifyTenant', async (request: any, reply: any) => {
    try {
      request.tenantId = tenantIdFromHeaders(request.headers, env.TENANT_ID);
    } catch {
      return reply.code(400).send({ message: 'Missing or invalid tenant context' });
    }
  });

  app.addHook('onRequest', async (request) => {
    request.log.info({
      event: 'audit.request',
      method: request.method,
      url: request.url,
      tenantId: tenantIdFromHeaders(request.headers, env.TENANT_ID),
    });
  });

  app.get('/health', async () => ({ status: 'ok', service }));
  return app;
}

export function tenantIdFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallbackTenantId?: string,
) {
  const headerTenant = headerValue(headers['x-tenant-id']);
  return tenantIdSchema.parse(headerTenant ?? fallbackTenantId);
}

export function isTenantMatch(recordTenantId: string | undefined | null, tenantId: string) {
  return tenantIdSchema.safeParse(recordTenantId).success && recordTenantId === tenantId;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
