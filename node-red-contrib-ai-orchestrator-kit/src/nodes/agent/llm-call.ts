import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

enum THREAD_SCOPE {
  PER_TEAMMATE = 'per-teammate',
  PER_PROJECT = 'per-project',
  PER_TASK = 'per-task',
}

enum BACKOFF_MODE {
  NONE = 'none',
  FIXED = 'fixed',
  EXP = 'exp',
}

interface IActorInfo {
  from?: string;
  to?: string;
  role?: string;
}

interface IPolicy {
  retries?: { maxAttempts?: number; backoff?: BACKOFF_MODE; delayMs?: number };
  timeouts?: { humanGateMs?: number; stageMs?: number };
  [k: string]: unknown;
}

interface IRoleProfileParams {
  providerKey?: string;
  model?: string;
  threadScope?: THREAD_SCOPE;
  maxContextTokens?: number;
  responseFormat?: 'text' | 'json';
  [k: string]: unknown;
}

interface IRoleProfile {
  key?: string;
  params?: IRoleProfileParams;
  [k: string]: unknown;
}

interface IPromptObject {
  system?: string;
  user?: string;
  variables?: Record<string, string>;
}

interface IResultProviderMeta {
  key: string;
  model: string;
  threadId?: string;
  stopReason?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
}

interface ILLMResult {
  text?: string;
  json?: unknown;
  toolCalls?: ReadonlyArray<unknown>;
  provider: IResultProviderMeta;
}

interface ILLMCallConfig {
  name?: string;
  providerKey?: string;
  model?: string;
  threadScope?: THREAD_SCOPE;
  responseFormat?: 'text' | 'json';
  useSystem?: boolean;
  useUser?: boolean;
}

interface ILLMCallParams {
  system?: string;
  user?: string;
  responseFormat: 'text' | 'json';
  timeoutMs: number;
}

interface ILLMCallOutput {
  text?: string;
  json?: unknown;
  stopReason?: string;
  tokenUsage?: { prompt: number; completion: number; total: number };
}

interface ILLMProvider {
  key: string;
  ensureThread(scopeKey: string): Promise<string>;
  call(threadId: string, params: ILLMCallParams): Promise<ILLMCallOutput>;
}

const threadCache: Map<string, string> = new Map();

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function nonEmpty(value: string | undefined): string | undefined {
  if (!value) return undefined;

  return value.trim().length > 0 ? value.trim() : undefined;
}

function isBackoffMode(value: unknown): value is BACKOFF_MODE {
  return value === BACKOFF_MODE.NONE || value === BACKOFF_MODE.FIXED || value === BACKOFF_MODE.EXP;
}

function choose<T>(overrideValue: T | undefined, fallbackValue: T | undefined, defaultValue: T): T {
  if (overrideValue !== undefined) return overrideValue;
  if (fallbackValue !== undefined) return fallbackValue;

  return defaultValue;
}

function toScopeKey(
  providerKey: string,
  scope: THREAD_SCOPE,
  projectId?: string,
  actor?: IActorInfo,
  workId?: string,
): string | undefined {
  if (!isString(providerKey) || providerKey.length === 0) return undefined;
  if (!isString(projectId) || projectId.length === 0) return undefined;
  if (scope === THREAD_SCOPE.PER_TEAMMATE) {
    const teammate = actor?.to;

    return isString(teammate) && teammate.length > 0
      ? providerKey + ':' + projectId + ':' + teammate
      : undefined;
  }
  if (scope === THREAD_SCOPE.PER_PROJECT) return providerKey + ':' + projectId;

  return (
    providerKey + ':' + projectId + ':' + (isString(workId) && workId.length > 0 ? workId : 'work')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function backoffDelay(attempt: number, mode: BACKOFF_MODE, baseMs: number): number {
  if (mode === BACKOFF_MODE.NONE) return 0;
  if (mode === BACKOFF_MODE.FIXED) return baseMs;

  const factor = 2 ** (attempt - 1);

  return baseMs * factor;
}

class EchoProvider implements ILLMProvider {
  key: string;
  constructor() {
    this.key = 'echo';
  }

  async ensureThread(scopeKey: string): Promise<string> {
    const cached = threadCache.get(scopeKey);

    if (cached) return cached;

    const threadId = 'echo:' + scopeKey;

    threadCache.set(scopeKey, threadId);

    return threadId;
  }

  async call(threadId: string, params: ILLMCallParams): Promise<ILLMCallOutput> {
    void threadId;
    const parts: string[] = [];

    if (isString(params.system) && params.system.length > 0)
      parts.push('[system] ' + params.system);
    if (isString(params.user) && params.user.length > 0) parts.push('[user] ' + params.user);

    const joined = parts.join('\n');

    if (params.responseFormat === 'json') {
      try {
        const parsed = JSON.parse(joined);

        return {
          json: parsed,
          stopReason: 'echo',
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
        };
      } catch {
        return {
          text: joined,
          stopReason: 'echo',
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
        };
      }
    }

    return { text: joined, stopReason: 'echo', tokenUsage: { prompt: 0, completion: 0, total: 0 } };
  }
}

function makeProvider(providerKey: string): ILLMProvider | undefined {
  if (providerKey === 'echo') return new EchoProvider();

  return undefined;
}

function register(RED: IRED): void {
  function LlmCall(this: INode, config: ILLMCallConfig): void {
    RED.nodes.createNode(this, config);

    this.on(
      'input',
      (msg: IOrchestratorMsg, send: (m: unknown) => void, done: () => void): void => {
        const run = async (): Promise<void> => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const access = msg as {
            roleProfile?: IRoleProfile;
            policy?: IPolicy;
            prompt?: IPromptObject;
            actor?: IActorInfo;
          };
          const roleParams = access.roleProfile?.params;
          const providerKey = nonEmpty(config.providerKey) ?? nonEmpty(roleParams?.providerKey) ?? '';
          const model = nonEmpty(config.model) ?? nonEmpty(roleParams?.model) ?? '';
          const threadScope = config.threadScope ?? roleParams?.threadScope ?? THREAD_SCOPE.PER_TEAMMATE;
          const responseFormat = config.responseFormat ?? roleParams?.responseFormat ?? 'text';
          const useSystem = config.useSystem ?? true;
          const useUser = config.useUser ?? true;
          const timeoutMs = choose<number>(access.policy?.timeouts?.stageMs, undefined, 30000);
          const maxAttempts = choose<number>(access.policy?.retries?.maxAttempts, undefined, 2);
          const configuredBackoff = access.policy?.retries?.backoff;
          const backoffMode = isBackoffMode(configuredBackoff)
            ? configuredBackoff
            : BACKOFF_MODE.FIXED;
          const backoffBase = choose<number>(access.policy?.retries?.delayMs, undefined, 1000);
          const provider = makeProvider(providerKey);

          if (!provider || !isString(model) || model.length === 0) {
            const providerMeta: IResultProviderMeta = {
              key: providerKey || '(none)',
              model: model || '(none)',
            };
            const out: IOrchestratorMsg = {
              ...msg,
              exit: 'failure',
              result: { provider: providerMeta },
            };

            send(out);

            return;
          }

          const scopeKey = toScopeKey(
            provider.key,
            threadScope,
            msg.projectId,
            access.actor,
            msg.workId,
          );

          if (!scopeKey) {
            const providerMeta: IResultProviderMeta = { key: provider.key, model };
            const out: IOrchestratorMsg = {
              ...msg,
              exit: 'failure',
              result: { provider: providerMeta },
            };

            send(out);

            return;
          }

          const systemText = useSystem ? access.prompt?.system : undefined;
          const userText = useUser ? access.prompt?.user : undefined;

          if (!isString(systemText) && !isString(userText)) {
            const providerMeta: IResultProviderMeta = { key: provider.key, model };
            const out: IOrchestratorMsg = {
              ...msg,
              exit: 'failure',
              result: { provider: providerMeta },
            };

            send(out);

            return;
          }

          let attempt = 0;
          let finalResult: ILLMCallOutput | undefined;
          let finalExit: IOrchestratorMsg['exit'] = 'failure';
          let finalThreadId: string | undefined;

          while (attempt < Math.max(1, maxAttempts)) {
            attempt += 1;

            try {
              const threadId = await provider.ensureThread(scopeKey);

              finalThreadId = threadId;

              const result = await provider.call(threadId, {
                system: systemText,
                user: userText,
                responseFormat,
                timeoutMs,
              });

              finalResult = result;
              finalExit = 'success';
              break;
            } catch {
              if (attempt >= Math.max(1, maxAttempts)) {
                finalExit = 'retry';
                break;
              }

              const waitMs = backoffDelay(attempt, backoffMode, backoffBase);

              await delay(waitMs);
            }
          }

          const providerMeta: IResultProviderMeta = {
            key: provider.key,
            model,
            threadId: finalThreadId,
            stopReason: finalResult?.stopReason,
            tokenUsage: finalResult?.tokenUsage,
          };
          const resultPayload: ILLMResult = finalResult
            ? {
                text: finalResult.text,
                json: finalResult.json,
                toolCalls: [],
                provider: providerMeta,
              }
            : { provider: providerMeta };
          const out: IOrchestratorMsg = { ...msg, exit: finalExit, result: resultPayload };

          send(out);
        };

        run()
          .then(() => done())
          .catch(() => done());
      },
    );
  }

  RED.nodes.registerType<ILLMCallConfig>('llm-call', LlmCall);
}

export = register;
