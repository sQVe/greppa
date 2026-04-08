import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { StateData, StateSaveRequest, StateSaveResponse } from '@greppa/core';

export class StateApi extends HttpApiGroup.make('state')
  .add(
    HttpApiEndpoint.post('saveState', '/api/state', {
      payload: StateSaveRequest,
      success: StateSaveResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get('getState', '/api/state/:id', {
      params: { id: Schema.String },
      success: StateData,
      error: Schema.Struct({ _tag: Schema.Literal('StateNotFound'), message: Schema.String }),
    }),
  ) {}
