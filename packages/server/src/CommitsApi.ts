import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { CommitEntry } from '@greppa/core';

export class CommitsApi extends HttpApiGroup.make('commits').add(
  HttpApiEndpoint.get('getCommits', '/api/commits', {
    query: { oldRef: Schema.String, newRef: Schema.String },
    success: Schema.Array(CommitEntry),
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
