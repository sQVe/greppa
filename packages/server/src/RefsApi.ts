import { RefsResponse } from '@greppa/core';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

export class RefsApi extends HttpApiGroup.make('refs').add(
  HttpApiEndpoint.get('getRefs', '/api/refs', {
    success: RefsResponse,
  }),
) {}
