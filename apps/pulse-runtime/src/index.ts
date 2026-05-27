import { createBaseServer, loadEnv, loadPlugins, PulseInfra, WorkflowRuntime } from '@pulsestack/core';
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
const infra = new PulseInfra();
const plugins = await loadPlugins();
const runtime = new WorkflowRuntime(infra, 'pulse-runtime', plugins);
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

app.post('/executions', async (request) => {
  return runtime.execute(request.body as never);
});

app.get('/executions/:executionId', async (request, reply) => {
  const execution = await infra.getExecution((request.params as { executionId: string }).executionId);
  if (!execution) return reply.code(404).send({ message: 'Execution not found' });
  return execution;
});

app.get('/executions', async () => {
  return infra.listExecutions();
});

const protoPath = path.resolve(process.cwd(), 'proto/pulsestack.proto');
const packageDefinition = loadSync(protoPath, { keepCase: true, longs: String, enums: String, defaults: true });
const grpcDescriptor = loadPackageDefinition(packageDefinition) as RuntimeGrpcDescriptor;
const grpcServer = new Server();

grpcServer.addService(grpcDescriptor.pulsestack.runtime.Runtime.service, {
  GetExecution: async (
    call: ServerUnaryCall<RuntimeExecutionRequest, RuntimeExecutionResponse>,
    callback: sendUnaryData<RuntimeExecutionResponse>,
  ) => {
    try {
      const execution = await infra.getExecution(call.request.execution_id);
      callback(null, {
        execution_id: execution?.id ?? '',
        workflow_id: execution?.workflow_id ?? '',
        status: execution?.status ?? 'not_found',
        correlation_id: execution?.correlation_id ?? '',
      });
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Failed to fetch execution'));
    }
  },
});

grpcServer.bindAsync(`0.0.0.0:${env.GRPC_PORT}`, ServerCredentials.createInsecure(), (error: Error | null) => {
  if (error) throw error;
  grpcServer.start();
});

await app.listen({ host: '0.0.0.0', port: env.HTTP_PORT });
