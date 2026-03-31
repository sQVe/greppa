import { createServer } from 'node:http';

import { NodeHttpServer } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { HttpRouter } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Api } from './Api';
import { GitService } from './GitService';

const HealthHandlers = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('getHealth', () => Effect.succeed({ status: 'ok' as const }))),
);

const FilesHandlers = HttpApiBuilder.group(Api, 'files', (handlers) =>
  Effect.gen(function* () {
    const git = yield* GitService;
    return handlers.handle('getFiles', ({ query }) =>
      git.listFiles(query.oldRef, query.newRef),
    );
  }),
);

export const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(HealthHandlers),
  Layer.provide(FilesHandlers),
);

export const makeHttpLayer = (port: number) =>
  HttpRouter.serve(ApiRoutes).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port })));
