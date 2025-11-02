import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

interface IToolExecConfig {
  name?: string;
  allowedTools?: string;
  continueOnError?: boolean;
  assignToPayload?: boolean;
  assignToResult?: boolean;
}

interface IToolCall {
  name: string;
  args?: Record<string, unknown>;
}

interface IToolCallResult {
  name: string;
  output?: unknown;
  error?: string;
}

interface IToolFn {
  (args: Record<string, unknown>, msg: IOrchestratorMsg): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAllowedTools(jsonText: string | undefined): string[] | undefined {
  if (!jsonText) return [];

  try {
    const parsed = JSON.parse(jsonText);

    if (Array.isArray(parsed)) {
      const list: string[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const value = parsed[i];

        if (typeof value === 'string' && value.trim().length > 0) list.push(value.trim());
      }

      return list;
    }

    return [];
  } catch {
    return undefined;
  }
}

function isToolCallArray(value: unknown): value is ReadonlyArray<IToolCall> {
  if (!Array.isArray(value)) return false;

  for (let i = 0; i < value.length; i++) {
    const item = value[i];

    if (typeof item !== 'object' || item === null) return false;

    const nameValue = isRecord(item) ? item['name'] : undefined;

    if (typeof nameValue !== 'string' || nameValue.trim().length === 0) return false;

    const argsValue = isRecord(item) ? item['args'] : undefined;

    if (typeof argsValue !== 'undefined' && (typeof argsValue !== 'object' || argsValue === null)) {
      return false;
    }
  }

  return true;
}

const registry: Record<string, IToolFn> = {
  'math.add': async (args): Promise<unknown> => {
    const aRaw = args.a;
    const bRaw = args.b;
    const a = typeof aRaw === 'number' ? aRaw : Number(aRaw);
    const b = typeof bRaw === 'number' ? bRaw : Number(bRaw);
    const safeA = Number.isFinite(a) ? a : 0;
    const safeB = Number.isFinite(b) ? b : 0;

    return safeA + safeB;
  },
  'string.concat': async (args): Promise<unknown> => {
    const left = typeof args.a === 'string' ? args.a : String(typeof args.a === 'undefined' ? '' : args.a);
    const right = typeof args.b === 'string' ? args.b : String(typeof args.b === 'undefined' ? '' : args.b);

    return left + right;
  },
};

function execTool(
  name: string,
  args: Record<string, unknown>,
  msg: IOrchestratorMsg,
): Promise<unknown> {
  const fn = Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : undefined;

  if (!fn) return Promise.reject(new Error('Unknown tool: ' + name));

  return fn(args, msg);
}

function assignResults(
  msg: IOrchestratorMsg,
  results: ReadonlyArray<IToolCallResult>,
  toPayload: boolean,
  toResult: boolean,
): IOrchestratorMsg {
  const next: IOrchestratorMsg = { ...msg };

  if (toPayload) {
    const values: unknown[] = [];

    for (let i = 0; i < results.length; i++)
      values.push(typeof results[i].error === 'string' ? null : results[i].output);

    next.payload = { ...(msg.payload || {}), toolResults: values };
  }
  if (toResult) {
    const base: Record<string, unknown> = isRecord(next['result']) ? next['result'] : {};

    next['result'] = { ...base, toolResult: results };
  }

  return next;
}

function register(RED: IRED): void {
  function ToolExec(this: INode, configRaw: IToolExecConfig): void {
    RED.nodes.createNode(this, configRaw);

    this.on(
      'input',
      async (
        msg: IOrchestratorMsg,
        send: (m: unknown) => void,
        done: () => void,
      ): Promise<void> => {
        const allowed = parseAllowedTools(configRaw.allowedTools);
        const continueOnError = configRaw.continueOnError ?? false;
        const assignToPayload = configRaw.assignToPayload ?? false;
        const assignToResult = configRaw.assignToResult ?? true;

        if (allowed === undefined) {
          const outFail: IOrchestratorMsg = { ...msg, exit: 'failure' };

          send(outFail);

          return done();
        }

        const resultBlock = isRecord(msg['result']) ? msg['result'] : undefined;
        const toolCallsUnknown = isRecord(resultBlock) ? resultBlock['toolCalls'] : undefined;
        const toolCalls: ReadonlyArray<IToolCall> = isToolCallArray(toolCallsUnknown)
          ? toolCallsUnknown
          : [];

        if (toolCalls.length === 0) {
          const noCallsOut: IOrchestratorMsg = assignResults(
            { ...msg, exit: 'success' },
            [],
            assignToPayload,
            assignToResult,
          );

          send(noCallsOut);

          return done();
        }

        const results: IToolCallResult[] = [];
        let failed = false;

        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          const name = call.name;

          if (allowed.length > 0 && allowed.indexOf(name) === -1) {
            const denied: IToolCallResult = { name, error: 'Tool not allowed' };

            results.push(denied);
            failed = failed || !continueOnError;

            if (!continueOnError) break;
            continue;
          }

          const args = typeof call.args === 'object' && call.args !== null ? call.args : {};

          try {
            const output = await execTool(name, args, msg);

            results.push({ name, output });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Tool execution error';

            results.push({ name, error: message });
            failed = failed || !continueOnError;

            if (!continueOnError) break;
          }
        }

        const finalMsg = assignResults(msg, results, assignToPayload, assignToResult);
        const out: IOrchestratorMsg = { ...finalMsg, exit: failed ? 'failure' : 'success' };

        send(out);

        return done();
      },
    );
  }

  RED.nodes.registerType<IToolExecConfig>('tool-exec', ToolExec);
}

export = register;
