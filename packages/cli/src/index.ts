import { resolve } from 'node:path';
import { Effect } from 'effect';
import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Command } from 'effect/unstable/cli';
import { main } from './main';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env.local'));
} catch {
  // .env.local may not exist yet — fall back to defaults
}

main.pipe(
  Command.run({ version: '0.1.0' }),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
