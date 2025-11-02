import { IOrchestratorMsg } from '../types';

export interface INode {
  on(
    event: 'input',
    handler: (msg: IOrchestratorMsg, send: (m: unknown) => void, done: () => void) => void,
  ): void;
  send(msg: unknown): void;
  error(message: string): void;
}

export interface IREDNodes {
  createNode(node: unknown, config: unknown): void;
  getNode(id: string): unknown;
  registerType<TConfig = unknown>(
    name: string,
    ctor: (this: INode, config: TConfig) => void,
    options?: unknown,
  ): void;
}

export interface IRED {
  nodes: IREDNodes;
}
