import { Schema } from 'effect';

export const name = '@greppa/core' as const;

export const ChangeType = Schema.Union([
  Schema.Literal('added'),
  Schema.Literal('modified'),
  Schema.Literal('deleted'),
  Schema.Literal('renamed'),
]);
export type ChangeType = typeof ChangeType.Type;

export const FileEntry = Schema.Struct({
  path: Schema.String,
  changeType: ChangeType,
  oldPath: Schema.optional(Schema.String),
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
});
export type RefsResponse = typeof RefsResponse.Type;
