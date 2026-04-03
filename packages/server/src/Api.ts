import { HttpApi } from 'effect/unstable/httpapi';

import { DiffApi } from './DiffApi';
import { FilesApi } from './FilesApi';
import { HealthApi } from './HealthApi';
import { RefsApi } from './RefsApi';

export class Api extends HttpApi.make('greppa').add(HealthApi).add(FilesApi).add(DiffApi).add(RefsApi) {}
