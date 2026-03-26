import { makeHttpLayer } from '@greppa/server';
import { Config, Effect, Layer } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';

const port = Flag.integer('port').pipe(
  Flag.withDescription('Port to listen on'),
  Flag.withFallbackConfig(Config.int('API_PORT')),
  Flag.withDefault(4400),
);

export const serve = Command.make(
  'serve',
  { port },
  Effect.fn(function* ({ port: listenPort }) {
    yield* Layer.launch(makeHttpLayer(listenPort));
  }),
);
