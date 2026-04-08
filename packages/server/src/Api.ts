import { HttpApi } from 'effect/unstable/httpapi';

import { CommitsApi } from './CommitsApi';
import { DiffApi } from './DiffApi';
import { FilesApi } from './FilesApi';
import { HealthApi } from './HealthApi';
import { RefsApi } from './RefsApi';
import { StateApi } from './StateApi';
import { WorktreeDiffApi } from './WorktreeDiffApi';
import { WorktreeFilesApi } from './WorktreeFilesApi';

export class Api extends HttpApi.make('greppa')
  .add(HealthApi)
  .add(FilesApi)
  .add(DiffApi)
  .add(RefsApi)
  .add(CommitsApi)
  .add(WorktreeFilesApi)
  .add(WorktreeDiffApi)
  .add(StateApi) {}
