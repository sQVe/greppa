export interface HighlightLine {
  key: string;
  content: string;
}

export interface HighlightToken {
  content: string;
  color?: string;
}

export interface HighlightRequest {
  type: 'highlight';
  requestId: number;
  filePath: string;
  language: string;
  theme: string;
  lines: HighlightLine[];
  oldContent?: string;
  newContent?: string;
}

export interface HighlightResponse {
  type: 'highlight-result';
  requestId: number;
  filePath: string;
  tokens: Record<string, HighlightToken[]>;
}

export type WorkerRequest = HighlightRequest;
export type WorkerResponse = HighlightResponse;
