import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { DiffResponse } from '@greppa/core';

export class DiffApi extends HttpApiGroup.make('diff').add(
  HttpApiEndpoint.get('getDiff', '/api/diff/:oldRef/:newRef/*', {
    params: { oldRef: Schema.String, newRef: Schema.String },
    success: DiffResponse,
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
