import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { DiffResponse } from '@greppa/core';

export class WorktreeDiffApi extends HttpApiGroup.make('worktreeDiff').add(
  HttpApiEndpoint.get('getWorktreeDiff', '/api/worktree/diff/*', {
    success: DiffResponse,
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
