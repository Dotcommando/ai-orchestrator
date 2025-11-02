import { IRED } from '../../nodes/_common';

interface IProjectPolicy {
  retries?: { maxAttempts?: number; backoff?: 'none' | 'fixed' | 'exp'; delayMs?: number };
  timeouts?: { humanGateMs?: number; stageMs?: number };
  [k: string]: unknown;
}

interface IProjectConfigNodeConfig {
  name?: string;
  key: string;
  defaultExitSchema?: string;
  policy?: IProjectPolicy;
}

function register(RED: IRED): void {
  function ProjectConfig(this: unknown, config: IProjectConfigNodeConfig): void {
    RED.nodes.createNode(this, config);
  }

  RED.nodes.registerType<IProjectConfigNodeConfig>('project-config', ProjectConfig);
}

export = register;
