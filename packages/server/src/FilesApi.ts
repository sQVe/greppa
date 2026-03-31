import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { FileEntry } from '@greppa/core';

export class FilesApi extends HttpApiGroup.make('files').add(
  HttpApiEndpoint.get('getFiles', '/api/files', {
    query: { oldRef: Schema.String, newRef: Schema.String },
    success: Schema.Array(FileEntry),
    error: Schema.Struct({ _tag: Schema.Literal('GitError'), message: Schema.String }),
  }),
) {}
