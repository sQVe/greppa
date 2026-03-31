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
  filePath: string;
  language: string;
  theme: string;
  lines: HighlightLine[];
}

export interface HighlightResponse {
  type: 'highlight-result';
  filePath: string;
  tokens: Record<string, HighlightToken[]>;
}

export type WorkerRequest = HighlightRequest;
export type WorkerResponse = HighlightResponse;
