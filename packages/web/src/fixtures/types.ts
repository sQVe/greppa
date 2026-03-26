export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';
export type ReviewStatus = 'reviewed' | 'unreviewed';

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  changeType?: ChangeType;
  status?: ReviewStatus;
  oldPath?: string;
  children?: FileNode[];
}

export type LineType = 'added' | 'removed' | 'context';

export interface DiffLine {
  lineType: LineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
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
  lastModified: string;
  changeFrequency: number;
  authors: string[];
  relatedPRs: number[];
}
