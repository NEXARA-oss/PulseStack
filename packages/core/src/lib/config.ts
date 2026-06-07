import { z } from 'zod';

const booleanEnv = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z.string().default('info'),
  SERVICE_NAME: z.string().default('pulsestack'),
  HTTP_PORT: z.coerce.number().default(3000),
  WS_PORT: z.coerce.number().default(3001),
  GRPC_PORT: z.coerce.number().default(50051),
  DATABASE_URL: z
    .string()
    .default('postgres://postgres:postgres@localhost:5432/pulsestack'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CLICKHOUSE_URL: z.string().default('http://localhost:8123'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().default(''),
  NATS_URL: z.string().default('nats://localhost:4222'),
  CORS_ORIGIN: z.string().default(''),
  JWT_SECRET: z.string().default('pulsestack-dev-secret'),
  API_KEY_SALT: z.string().default('pulsestack-api-salt'),
  API_KEY: z.string().default('pulsestack-local-api-key'),
  TENANT_ID: z.string().default('local'),
  PLUGIN_DIR: z.string().default('./plugins'),
  AUTH_DISABLED: booleanEnv.default(true),
  AUTH_DISABLED: z.coerce.boolean().default(false),
  AUTH_DISABLED: booleanEnv.default(false),
  OTEL_TRACING_ENABLED: z.coerce.boolean().default(false),
  OTEL_SERVICE_NAME: z.string().default(''),
  OTEL_TRACES_EXPORTER: z.enum(['none', 'console']).default('none'),

});

export type PulseEnv = z.infer<typeof envSchema>;

export function loadEnv(overrides: NodeJS.ProcessEnv = process.env): PulseEnv {
  return envSchema.parse(overrides);
}
