import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { ChangeType } from '@greppa/core';

export class DiffApi extends HttpApiGroup.make('diff').add(
  HttpApiEndpoint.get('getDiff', '/api/diff/:oldRef/:newRef/*', {
    params: { oldRef: Schema.String, newRef: Schema.String },
    success: Schema.Struct({
      path: Schema.String,
      changeType: ChangeType,
      oldPath: Schema.optional(Schema.String),
      oldContent: Schema.String,
      newContent: Schema.String,
    }),
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
