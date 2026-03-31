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
  filePath: string;
  oldContent: string;
  newContent: string;
}

export interface DiffResponse {
  type: 'diff-result';
  filePath: string;
  changes: DiffMapping[];
  hitTimeout: boolean;
}

export type DiffWorkerRequest = DiffRequest;
