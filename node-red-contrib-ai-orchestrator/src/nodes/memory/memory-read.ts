import {
  IMemoryReadRequest,
  IOrchestratorMsg,
  IOrchestratorMsgExtended,
  TReadMode,
} from '../../types';
import { INode, IRED } from '../_common';

interface IMemoryReadConfig {
  name?: string;
  mongo: string;
  collection?: string;
  mode: TReadMode;
  key?: string;
  scope?: string;
  scopeRef?: string;
  tags?: string;
  filterJson?: string;
  vectorJson?: string;
  limit?: number;
  topK?: number;
}

function register(RED: IRED): void {
  function parseTags(csv?: string): string[] | undefined {
    if (!csv) return undefined;
    const items = csv
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    return items.length > 0 ? items : undefined;
  }

  function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null) return false;
    if (Array.isArray(value)) return false;

    return typeof value === 'object';
  }

  function parseFilter(
    json?: string,
    onError?: (text: string) => void,
  ): Record<string, unknown> | undefined {
    if (!json) return undefined;

    try {
      const parsed = JSON.parse(json);

      if (isPlainObject(parsed)) {
        return parsed;
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);

      if (onError) onError('[memory-read] parseFilter JSON error: ' + description);
    }

    return undefined;
  }

  function isNumberArray(value: unknown): value is number[] {
    if (!Array.isArray(value)) return false;

    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'number') return false;
    }

    return true;
  }

  function parseVector(json?: string, onError?: (text: string) => void): number[] | undefined {
    if (!json) return undefined;

    try {
      const parsed = JSON.parse(json);

      if (isNumberArray(parsed)) {
        return parsed.length > 0 ? parsed : undefined;
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);

      if (onError) onError('[memory-read] parseVector JSON error: ' + description);
    }

    return undefined;
  }

  function MemoryRead(this: INode, config: IMemoryReadConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const projectId = msg.projectId;
      const actor = msg.actor;
      const collection = config.collection?.length ? config.collection : undefined;
      const request: IMemoryReadRequest = {
        projectId,
        collection,
        mode: config.mode,
        key: config.key?.length ? config.key : undefined,
        tags: parseTags(config.tags),
        filter: parseFilter(config.filterJson, (text) => this.error(text)),
        vector: parseVector(config.vectorJson, (text) => this.error(text)),
        limit: typeof config.limit === 'number' ? config.limit : undefined,
        topK: typeof config.topK === 'number' ? config.topK : undefined,
        scope: config.scope?.length ? config.scope : undefined,
        scopeRef: config.scopeRef?.length ? config.scopeRef : undefined,
        actor,
      };
      const out: IOrchestratorMsgExtended = { ...msg, memoryRead: request };

      send(out);

      return done();
    });
  }

  RED.nodes.registerType<IMemoryReadConfig>('memory-read', MemoryRead);
}

export default register;
