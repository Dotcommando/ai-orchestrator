export interface IOrchestratorMsg {
  projectId?: string;
  workId?: string;
  actor?: { from?: string; to?: string; role?: string };
  stagePlan?: string[];
  cursor?: { index: number; attempt: number };
  payload?: Record<string, unknown>;
  result?: unknown;
  [k: string]: unknown;
}

export type TReadMode = 'by-key' | 'by-tags' | 'filter' | 'vector';
export type TVisibility = 'self' | 'team' | 'teammates';

export interface IMemoryReadRequest {
  projectId?: string;
  collection?: string;
  mode: TReadMode;
  key?: string;
  tags?: string[];
  filter?: Record<string, unknown>;
  vector?: number[];
  limit?: number;
  topK?: number;
  scope?: string;
  scopeRef?: string;
  actor?: { from?: string; to?: string; role?: string };
}

export interface IMemoryWriteRequest {
  projectId?: string;
  collection?: string;
  key?: string;
  text?: string;
  scope?: string;
  scopeRef?: string;
  visibility?: TVisibility;
  tags?: string[];
  allowed?: { roles?: string[]; members?: string[] };
  owner?: { memberId?: string; roleKey?: string };
  ttlAt?: number;
  createdAt?: number;
  upsert?: boolean;
  actor?: { from?: string; to?: string; role?: string };
}

export interface IOrchestratorMsgExtended extends IOrchestratorMsg {
  memoryRead?: IMemoryReadRequest;
  memoryWrite?: IMemoryWriteRequest;
}
