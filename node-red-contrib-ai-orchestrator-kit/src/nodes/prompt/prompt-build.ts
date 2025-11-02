import { INode, IRED } from '../_common';

interface IActorInfo {
  from?: string;
  to?: string;
  role?: string;
}

interface IOrchestratorMsg {
  projectId?: string;
  workId?: string;
  actor?: IActorInfo;
  stagePlan?: string[];
  cursor?: { index: number; attempt: number };
  payload?: Record<string, unknown>;
  result?: unknown;
  [k: string]: unknown;
}

interface IPromptObject {
  system: string;
  user: string;
  variables: Record<string, string>;
}

interface IOrchestratorMsgExtended extends IOrchestratorMsg {
  prompt?: IPromptObject;
}

interface IPromptBuildConfig {
  name?: string;
  systemTemplate: string;
  userTemplate: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function register(RED: IRED): void {
  function getByPath(root: unknown, path: string): unknown {
    if (!path) return undefined;

    const parts = path.split('.');
    let current: unknown = root;

    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];

      if (!isRecord(current)) return undefined;

      const record: Record<string, unknown> = current;

      if (!Object.prototype.hasOwnProperty.call(record, key)) return undefined;

      current = record[key];
    }

    return current;
  }

  function render(template: string, context: unknown, captured: Record<string, string>): string {
    let output = template;
    const regex = /\$\{([^}]+)\}/g;
    let match = regex.exec(template);

    while (match) {
      const rawPath = match[1].trim();
      const value = getByPath(context, rawPath);
      const text = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : '';

      captured[rawPath] = text;
      output = output.replace(match[0], text);
      match = regex.exec(template);
    }

    return output;
  }

  function PromptBuild(this: INode, config: IPromptBuildConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const variables: Record<string, string> = {};
      const systemText = render(config.systemTemplate ?? '', msg, variables);
      const userText = render(config.userTemplate ?? '', msg, variables);
      const out: IOrchestratorMsgExtended = {
        ...msg,
        prompt: {
          system: systemText,
          user: userText,
          variables,
        },
      };

      send(out);

      return done();
    });
  }

  RED.nodes.registerType<IPromptBuildConfig>('prompt-build', PromptBuild);
}

export = register;
