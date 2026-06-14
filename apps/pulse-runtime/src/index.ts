import {
  createBaseServer,
  initializeTracing,
  loadEnv,
  PulseInfra,
  tenantIdFromHeaders,
  WorkflowRuntime,
} from '@pulsestack/core';
import type { ExecutionRequest } from '@pulsestack/contracts';
import {
  loadPackageDefinition,
  Server,
  ServerCredentials,
  type GrpcObject,
  type sendUnaryData,
  type ServerUnaryCall,
  type ServiceDefinition,
  type UntypedServiceImplementation,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'node:path';

const env = loadEnv();
initializeTracing(env);
const infra = new PulseInfra();
const runtime = new WorkflowRuntime(infra);
const app = await createBaseServer('pulse-runtime');

type RuntimeExecutionRequest = {
  execution_id: string;
};

type RuntimeExecutionResponse = {
  execution_id: string;
  workflow_id: string;
  status: string;
  correlation_id: string;
};

type RuntimeServiceDefinition = {
  service: ServiceDefinition<UntypedServiceImplementation>;
};

type RuntimeGrpcDescriptor = GrpcObject & {
  pulsestack: GrpcObject & {
    runtime: GrpcObject & {
      Runtime: RuntimeServiceDefinition;
    };
  };
};

app.post('/executions', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const body = request.body as ExecutionRequest;
  if (body.workflow?.tenantId !== tenantId || (body.context?.tenantId && body.context.tenantId !== tenantId)) {
    return reply.code(403).send({ message: 'Request tenant does not match workflow tenant' });
  }
  return runtime.execute(
    mergeHeaderTraceContext(
      body,
      request.headers as Record<string, string | string[] | undefined>,
    ),
  );
});

app.get('/executions/:executionId', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const execution = await infra.getExecution(
    (request.params as { executionId: string }).executionId,
    tenantId,
  );
  if (!execution)
    return reply.code(404).send({ message: 'Execution not found' });
  return execution;
});

app.get('/executions/:executionId/usage', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const usage = await infra.getExecutionUsage(
    (request.params as { executionId: string }).executionId,
    tenantId,
  );
  if (!usage) return reply.code(404).send({ message: 'Execution not found' });
  return usage;
});

app.get('/executions', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const query = request.query as { limit?: string; offset?: string };
  const limit = query.limit ? parseInt(query.limit, 10) : 25;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;
  return infra.listExecutions(limit, offset, tenantId);
});

app.get('/workflows/:workflowId/usage', async (request) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  return infra.getWorkflowUsage((request.params as { workflowId: string }).workflowId, tenantId);
});

app.get('/tenants/:tenantId/usage', async (request, reply) => {
  const tenantId = tenantIdFromHeaders(
    request.headers as Record<string, string | string[] | undefined>,
    env.TENANT_ID,
  );
  const requestedTenantId = (request.params as { tenantId: string }).tenantId;
  if (requestedTenantId !== tenantId) {
    return reply.code(403).send({ message: 'Request tenant does not match route tenant' });
  }
  return infra.getTenantUsage(tenantId);
});

const protoPath = path.resolve(process.cwd(), 'proto/pulsestack.proto');
const packageDefinition = loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
});
const grpcDescriptor = loadPackageDefinition(
  packageDefinition,
) as RuntimeGrpcDescriptor;
const grpcServer = new Server();

grpcServer.addService(grpcDescriptor.pulsestack.runtime.Runtime.service, {
  GetExecution: async (
    call: ServerUnaryCall<RuntimeExecutionRequest, RuntimeExecutionResponse>,
    callback: sendUnaryData<RuntimeExecutionResponse>,
  ) => {
    try {
      const metadataTenant = call.metadata.get('x-tenant-id')[0];
      const tenantId = tenantIdFromHeaders(
        {
          'x-tenant-id':
            typeof metadataTenant === 'string' ? metadataTenant : undefined,
        },
        env.TENANT_ID,
      );
      const execution = await infra.getExecution(call.request.execution_id, tenantId);
      callback(null, {
        execution_id: execution?.id ?? '',
        workflow_id: execution?.workflow_id ?? '',
        status: execution?.status ?? 'not_found',
        correlation_id: execution?.correlation_id ?? '',
      });
    } catch (error) {
      callback(
        error instanceof Error ? error : new Error('Failed to fetch execution'),
      );
    }
  },
});

grpcServer.bindAsync(
  `0.0.0.0:${env.GRPC_PORT}`,
  ServerCredentials.createInsecure(),
  (error: Error | null) => {
    if (error) throw error;
    grpcServer.start();
  },
);

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });

function mergeHeaderTraceContext(
  body: ExecutionRequest,
  headers: Record<string, string | string[] | undefined>,
): ExecutionRequest {
  const headerContext = traceContextFromHeaders(headers);
  if (!headerContext) return body;
  return {
    ...body,
    context: {
      ...headerContext,
      ...body.context,
    },
  };
}

function traceContextFromHeaders(
  headers: Record<string, string | string[] | undefined>,
) {
  const traceparent = headerValue(headers.traceparent);
  const match = traceparent?.match(
    /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i,
  );
  if (!match) return undefined;
  return {
    traceId: match[1],
    parentSpanId: match[2],
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
