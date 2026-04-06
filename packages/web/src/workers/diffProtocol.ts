export interface DiffLineRange {
  startLineNumber: number;
  endLineNumberExclusive: number;
}

export interface DiffRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface DiffInnerChange {
  originalRange: DiffRange;
  modifiedRange: DiffRange;
}

export interface DiffMapping {
  original: DiffLineRange;
  modified: DiffLineRange;
  innerChanges: DiffInnerChange[] | null;
}

export interface DiffRequest {
  type: 'diff';
  requestId: string;
  filePath: string;
  oldContent: string;
  newContent: string;
}

export interface DiffWorkerResponse {
  type: 'diff-result';
  requestId: string;
  filePath: string;
  changes: DiffMapping[];
  hitTimeout: boolean;
  error: string | null;
}

export type DiffWorkerRequest = DiffRequest;
