import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { HttpRouter } from 'effect/unstable/http';
import { NodeHttpServer } from '@effect/platform-node';
import { createServer } from 'node:http';
import { Api } from './Api';

const HealthHandlers = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('getHealth', () => Effect.succeed({ status: 'ok' as const }))),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(Layer.provide(HealthHandlers));

export const makeHttpLayer = (port: number) =>
  HttpRouter.serve(ApiRoutes).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port })));
