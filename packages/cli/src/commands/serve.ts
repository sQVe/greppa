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

    const oldRefInput = Option.isSome(oldRefOption)
      ? oldRefOption.value
      : yield* git.detectDefaultBranch();

    const newRefInput = Option.isSome(newRefOption) ? newRefOption.value : 'HEAD';

    // Resolve to immutable SHAs so downstream caches (file list, diff content,
    // and the web's IndexedDB diffCache) key on commits that don't move out
    // from under them when branches advance.
    const oldRef = yield* git.resolveRef(oldRefInput);
    const newRef = yield* git.resolveRef(newRefInput);
    const mergeBaseRef = yield* git.mergeBase(oldRef, newRef);

    return { oldRef, newRef, mergeBaseRef };
  });

export const serve = Command.make(
  'serve',
  { port, oldRef: oldRefArg, newRef: newRefArg },
  Effect.fn(function* ({ port: listenPort, oldRef: oldRefOption, newRef: newRefOption }) {
    const repoRoot = yield* Effect.try({
      try: detectRepoRoot,
      catch: () => new Error('Unable to detect repository root. Run this command inside a Git repository.'),
    });
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
