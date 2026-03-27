import { Command } from 'effect/unstable/cli';

import { serve } from './commands/serve';

export const main = Command.make('greppa').pipe(Command.withSubcommands([serve]));
