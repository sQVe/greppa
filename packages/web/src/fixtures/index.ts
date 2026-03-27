import rawComments from './comments.json';
import rawConfig from './diffs/config.json';
import rawCreateLogger from './diffs/createLogger.json';
import rawHashPassword from './diffs/hashPassword.json';
import rawRateLimiter from './diffs/rateLimiter.json';
import rawValidateToken from './diffs/validateToken.json';
import rawFileInfo from './fileInfo.json';
import rawFiles from './files.json';
import type { CommentThread, DiffFile, FileInfo, FileNode } from './types';

// oxlint-disable-next-line no-unsafe-type-assertion -- JSON imports produce wide types; cast once at the boundary
export const files = rawFiles as FileNode[];

// oxlint-disable-next-line no-unsafe-type-assertion
const diffList = [
  rawConfig,
  rawCreateLogger,
  rawHashPassword,
  rawRateLimiter,
  rawValidateToken,
] as DiffFile[];

export const diffs = new Map(diffList.map((d) => [d.path, d]));

// oxlint-disable-next-line no-unsafe-type-assertion
export const comments = rawComments as CommentThread[];

// oxlint-disable-next-line no-unsafe-type-assertion
const fileInfoList = rawFileInfo as FileInfo[];

export const fileInfoMap = new Map(fileInfoList.map((f) => [f.path, f]));
