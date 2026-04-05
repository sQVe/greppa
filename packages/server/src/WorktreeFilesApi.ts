import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { FileEntry } from '@greppa/core';

export class WorktreeFilesApi extends HttpApiGroup.make('worktreeFiles').add(
  HttpApiEndpoint.get('getWorktreeFiles', '/api/worktree/files', {
    success: Schema.Array(FileEntry),
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
