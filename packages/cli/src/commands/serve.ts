import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { NodeServices } from '@effect/platform-node';
import { GitService, GitServiceLive, makeHttpLayer, RepoPath } from '@greppa/server';
import { Config, Effect, Layer, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

const detectRepoRoot = () =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();

const port = Flag.integer('port').pipe(
  Flag.withDescription('Port to listen on'),
  Flag.withFallbackConfig(Config.int('API_PORT')),
  Flag.withDefault(4400),
);

const oldRefArg = Argument.string('old-ref').pipe(
  Argument.withDescription('Base ref for comparison (default: auto-detect default branch)'),
  Argument.optional,
);

const newRefArg = Argument.string('new-ref').pipe(
  Argument.withDescription('Target ref for comparison (default: HEAD)'),
  Argument.optional,
);

const resolveRefs = (
  oldRefOption: Option.Option<string>,
  newRefOption: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const git = yield* GitService;

    const oldRef = Option.isSome(oldRefOption)
      ? oldRefOption.value
      : yield* git.detectDefaultBranch();

    const newRef = Option.isSome(newRefOption) ? newRefOption.value : 'HEAD';

    yield* git.resolveRef(oldRef);
    yield* git.resolveRef(newRef);
    const mergeBaseRef = yield* git.mergeBase(oldRef, newRef);

    return { oldRef, newRef, mergeBaseRef };
  });

export const serve = Command.make(
  'serve',
  { port, oldRef: oldRefArg, newRef: newRefArg },
  Effect.fn(function* ({ port: listenPort, oldRef: oldRefOption, newRef: newRefOption }) {
    const repoRoot = detectRepoRoot();
    const repoPathLayer = Layer.succeed(RepoPath, repoRoot);

    const refsConfig = yield* resolveRefs(oldRefOption, newRefOption).pipe(
      Effect.provide(Layer.mergeAll(GitServiceLive, NodeServices.layer, repoPathLayer)),
    );
    const packagedPath = resolve(import.meta.dirname, 'web');
    const workspacePath = resolve(import.meta.dirname, '..', '..', '..', 'web', 'dist');
    const webDistPath = existsSync(packagedPath) ? packagedPath : workspacePath;
    yield* Layer.launch(
      makeHttpLayer(listenPort, refsConfig, webDistPath).pipe(Layer.provide(repoPathLayer)),
    );
  }),
);
