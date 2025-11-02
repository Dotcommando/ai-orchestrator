import {
  IMemoryWriteRequest,
  IOrchestratorMsg,
  IOrchestratorMsgExtended,
  VISIBILITY,
} from '../../types';
import { INode, IRED } from '../_common';

interface IMemoryWriteConfig {
  name?: string;
  mongo: string;
  collection?: string;
  key?: string;
  text?: string;
  scope?: string;
  scopeRef?: string;
  visibility: VISIBILITY;
  tags?: string;
  allowedRolesJson?: string;
  allowedMembersJson?: string;
  ttlMs?: number;
  upsert?: boolean;
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

  function isStringArray(value: unknown): value is string[] {
    if (!Array.isArray(value)) return false;

    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || value[i].length === 0) return false;
    }

    return true;
  }

  function parseJsonArray(raw?: string, onError?: (text: string) => void): string[] | undefined {
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw);

      if (isStringArray(parsed)) {
        return parsed.length > 0 ? parsed : undefined;
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);

      if (onError) onError('[memory-write] parseJsonArray JSON error: ' + description);
    }

    return undefined;
  }

  function toTtlAt(ttlMs?: number): number | undefined {
    if (!ttlMs || ttlMs <= 0) return undefined;

    return Date.now() + ttlMs;
  }

  function MemoryWrite(this: INode, config: IMemoryWriteConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const projectId = msg.projectId;
      const actor = msg.actor;
      const collection = config.collection?.length ? config.collection : undefined;
      const request: IMemoryWriteRequest = {
        projectId,
        collection,
        key: config.key?.length ? config.key : undefined,
        text: config.text?.length ? config.text : undefined,
        scope: config.scope?.length ? config.scope : undefined,
        scopeRef: config.scopeRef?.length ? config.scopeRef : undefined,
        visibility: config.visibility,
        tags: parseTags(config.tags),
        allowed: {
          roles: parseJsonArray(config.allowedRolesJson, (text) => this.error(text)),
          members: parseJsonArray(config.allowedMembersJson, (text) => this.error(text)),
        },
        owner: { memberId: actor?.from, roleKey: actor?.role },
        ttlAt: toTtlAt(typeof config.ttlMs === 'number' ? config.ttlMs : undefined),
        createdAt: Date.now(),
        upsert: config.upsert ?? true,
        actor,
      };
      const out: IOrchestratorMsgExtended = { ...msg, memoryWrite: request };

      send(out);

      return done();
    });
  }

  RED.nodes.registerType<IMemoryWriteConfig>('memory-write', MemoryWrite);
}

export default register;
