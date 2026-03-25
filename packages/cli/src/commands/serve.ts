import { Effect, Layer } from 'effect';
import { Command, Flag } from 'effect/unstable/cli';
import { makeHttpLayer } from '@greppa/server';

const port = Flag.integer('port').pipe(
  Flag.withDescription('Port to listen on'),
  Flag.withDefault(4400),
);

export const serve = Command.make(
  'serve',
  { port },
  Effect.fn(function* ({ port: listenPort }) {
    yield* Layer.launch(makeHttpLayer(listenPort));
  }),
);
