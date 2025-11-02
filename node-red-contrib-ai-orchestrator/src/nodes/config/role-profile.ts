import { IRED } from '../../nodes/_common';

interface IMemoryAccess {
  read?: ('self' | 'team' | 'teammates')[];
  write?: ('self' | 'team')[];
  allowedRoles?: string[];
  allowedMembers?: string[];
  [k: string]: unknown;
}

interface IRoleProfileConfig {
  name?: string;
  key: string;
  tools?: string[];
  mcpEndpoints?: string[];
  params?: Record<string, unknown>;
  memoryAccess?: IMemoryAccess;
}

function register(RED: IRED): void {
  function RoleProfile(this: unknown, config: IRoleProfileConfig): void {
    RED.nodes.createNode(this, config);
  }

  RED.nodes.registerType<IRoleProfileConfig>('role-profile', RoleProfile);
}

export = register;
