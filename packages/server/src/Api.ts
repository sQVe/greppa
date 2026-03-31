import { HttpApi } from 'effect/unstable/httpapi';

import { DiffApi } from './DiffApi';
import { FilesApi } from './FilesApi';
import { HealthApi } from './HealthApi';

export class Api extends HttpApi.make('greppa').add(HealthApi).add(FilesApi).add(DiffApi) {}
