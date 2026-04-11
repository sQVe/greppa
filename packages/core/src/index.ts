import { Schema } from 'effect';

export const name = '@greppa/core' as const;

export const ChangeType = Schema.Union([
  Schema.Literal('added'),
  Schema.Literal('modified'),
  Schema.Literal('deleted'),
  Schema.Literal('renamed'),
]);
export type ChangeType = typeof ChangeType.Type;

export const SizeTier = Schema.Union([
  Schema.Literal('small'),
  Schema.Literal('medium'),
  Schema.Literal('large'),
]);
export type SizeTier = typeof SizeTier.Type;

export const FileEntry = Schema.Struct({
  path: Schema.String,
  changeType: ChangeType,
  oldPath: Schema.optional(Schema.String),
  sizeTier: SizeTier,
});
export type FileEntry = typeof FileEntry.Type;

export const DiffResponse = Schema.Struct({
  path: Schema.String,
  changeType: ChangeType,
  oldPath: Schema.optional(Schema.String),
  oldContent: Schema.String,
  newContent: Schema.String,
});
export type DiffResponse = typeof DiffResponse.Type;

export const RefsResponse = Schema.Struct({
  oldRef: Schema.String,
  newRef: Schema.String,
  mergeBaseRef: Schema.String,
});
export type RefsResponse = typeof RefsResponse.Type;

export const StateData = Schema.Struct({
  file: Schema.Array(Schema.String),
  wt: Schema.Array(Schema.String),
  commits: Schema.Array(Schema.String),
});
export type StateData = typeof StateData.Type;

export const StateSaveRequest = Schema.Struct({
  ...StateData.fields,
  id: Schema.String,
});
export type StateSaveRequest = typeof StateSaveRequest.Type;

export const StateSaveResponse = Schema.Struct({
  id: Schema.String,
});
export type StateSaveResponse = typeof StateSaveResponse.Type;

export const CommitEntry = Schema.Struct({
  sha: Schema.String,
  abbrevSha: Schema.String,
  subject: Schema.String,
  author: Schema.String,
  date: Schema.String,
});
export type CommitEntry = typeof CommitEntry.Type;
