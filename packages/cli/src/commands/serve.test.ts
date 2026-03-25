import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { Command } from 'effect/unstable/cli';
import { NodeServices } from '@effect/platform-node';
import { main } from '../main';

const run = Command.runWith(main, { version: '0.1.0' });

describe('serve command', () => {
  it('is wired as a subcommand of greppa', async () => {
    const result = await Effect.runPromise(
      run(['serve', '--help']).pipe(Effect.provide(NodeServices.layer)),
    );

    expect(result).toBeUndefined();
  });

  it('greppa --help succeeds', async () => {
    const result = await Effect.runPromise(
      run(['--help']).pipe(Effect.provide(NodeServices.layer)),
    );

    expect(result).toBeUndefined();
  });
});
