import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

interface IMcpCallConfig {
  name?: string;
  allowedEndpoints?: string;
  continueOnError?: boolean;
  assignToPayload?: boolean;
  assignToResult?: boolean;
}

interface IMcpCallSpec {
  endpoint: string;
  tool: string;
  args?: Record<string, unknown>;
}

interface IMcpCallOutcome {
  endpoint: string;
  tool: string;
  output?: unknown;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAllowedEndpoints(jsonText: string | undefined): string[] | undefined {
  if (!jsonText) return [];

  try {
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) return [];

    const list: string[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const value = parsed[i];

      if (typeof value === 'string' && value.trim().length > 0) {
        list.push(value.trim());
      }
    }

    return list;
  } catch {
    return undefined;
  }
}

function isMcpCallArray(value: unknown): value is ReadonlyArray<IMcpCallSpec> {
  if (!Array.isArray(value)) return false;

  for (let i = 0; i < value.length; i++) {
    const item = value[i];

    if (!isRecord(item)) return false;

    const endpoint = item['endpoint'];
    const tool = item['tool'];
    const args = item['args'];

    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) return false;
    if (typeof tool !== 'string' || tool.trim().length === 0) return false;
    if (typeof args !== 'undefined' && !isRecord(args)) return false;
  }

  return true;
}

function assignResults(
  msg: IOrchestratorMsg,
  outcomes: ReadonlyArray<IMcpCallOutcome>,
  toPayload: boolean,
  toResult: boolean,
): IOrchestratorMsg {
  let next: IOrchestratorMsg = { ...msg };

  if (toPayload) {
    const outputs: unknown[] = [];

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];

      outputs.push(
        typeof outcome.error === 'string' && outcome.error.length > 0 ? null : outcome.output,
      );
    }

    const basePayload = isRecord(next['payload']) ? next['payload'] : {};

    next = {
      ...next,
      payload: {
        ...basePayload,
        mcpResults: outputs,
      },
    };
  }
  if (toResult) {
    const baseResult = isRecord(next['result']) ? next['result'] : {};

    next = {
      ...next,
      result: {
        ...baseResult,
        mcpResults: outcomes,
      },
    };
  }

  return next;
}

function register(RED: IRED): void {
  function McpCall(this: INode, config: IMcpCallConfig): void {
    RED.nodes.createNode(this, config);

    this.on(
      'input',
      (msg: IOrchestratorMsg, send: (m: unknown) => void, done: () => void): void => {
        const allowed = parseAllowedEndpoints(config.allowedEndpoints);
        const continueOnError = config.continueOnError ?? false;
        const assignToPayload = config.assignToPayload ?? false;
        const assignToResult = config.assignToResult ?? true;

        if (allowed === undefined) {
          const outInvalid: IOrchestratorMsg = { ...msg, exit: 'failure' };

          send(outInvalid);

          return done();
        }

        const baseResult = isRecord(msg['result']) ? msg['result'] : undefined;
        const mcpCallsUnknown = baseResult ? baseResult['mcpCalls'] : undefined;
        const mcpCalls: ReadonlyArray<IMcpCallSpec> = isMcpCallArray(mcpCallsUnknown)
          ? mcpCallsUnknown
          : [];

        if (mcpCalls.length === 0) {
          const outNoCalls: IOrchestratorMsg = assignResults(
            { ...msg, exit: 'success' },
            [],
            assignToPayload,
            assignToResult,
          );

          send(outNoCalls);

          return done();
        }

        const outcomes: IMcpCallOutcome[] = [];
        let failed = false;

        for (let i = 0; i < mcpCalls.length; i++) {
          const call = mcpCalls[i];
          const endpoint = call.endpoint;
          const tool = call.tool;

          if (allowed.length > 0 && allowed.indexOf(endpoint) === -1) {
            const denied: IMcpCallOutcome = {
              endpoint,
              tool,
              error: 'Endpoint not allowed',
            };

            outcomes.push(denied);
            failed = true;

            if (!continueOnError) break;

            continue;
          }

          const outcome: IMcpCallOutcome = {
            endpoint,
            tool,
            error: 'MCP client not implemented',
          };

          outcomes.push(outcome);
          failed = true;

          if (!continueOnError) break;
        }

        const finalMsg = assignResults(msg, outcomes, assignToPayload, assignToResult);
        const out: IOrchestratorMsg = { ...finalMsg, exit: failed ? 'failure' : 'success' };

        send(out);

        return done();
      },
    );
  }

  RED.nodes.registerType<IMcpCallConfig>('mcp-call', McpCall);
}

export = register;
