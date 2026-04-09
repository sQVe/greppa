export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export type SizeTier = 'small' | 'medium' | 'large';

export interface FileNode {
  path: string;
  name: string;
  displayName?: string;
  type: 'file' | 'directory';
  changeType?: ChangeType;
  oldPath?: string;
  lineCount?: number;
  sizeTier?: SizeTier;
  children?: FileNode[];
}

export type LineType = 'added' | 'removed' | 'context';

export interface CharRange {
  startColumn: number;
  endColumn: number;
}

export interface DiffLine {
  lineType: LineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
  charRanges?: CharRange[];
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  oldPath?: string;
  changeType: ChangeType;
  language: string;
  hunks: DiffHunk[];
  oldContent?: string;
  newContent?: string;
}

export interface Comment {
  id: string;
  author: string;
  timestamp: string;
  body: string;
}

export interface CommentThread {
  id: string;
  filePath: string;
  lineNumber: number;
  resolved: boolean;
  comments: Comment[];
}

export interface FileInfo {
  path: string;
  language: string;
  encoding: string;
  lastModified: string;
  changeFrequency: number;
  authors: string[];
  relatedPRs: number[];
}
