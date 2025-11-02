import { ALLOWED_EXITS_BY_SCHEMA, EXIT_SCHEMAS, EXIT_TO_PORT, TExit } from '../../constants';
import { IOrchestratorMsg, IOrchestratorMsgExtended } from '../../types';
import { INode, IRED } from '../_common';

interface IProjectConfigRuntime {
  key?: string;
  defaultExitSchema?: string;
  policy?: Record<string, unknown>;
  [k: string]: unknown;
}

interface IRoleProfileRuntime {
  key?: string;
  params?: Record<string, unknown>;
  memoryAccess?: Record<string, unknown>;
  tools?: string[];
  mcpEndpoints?: string[];
  [k: string]: unknown;
}

interface IRoleStageConfig {
  name?: string;
  project?: string;
  role?: string;
  exitSchema?: string;
  requireHumanGate?: boolean;
}

function register(RED: IRED): void {
  function isProjectConfig(node: unknown): node is IProjectConfigRuntime {
    return typeof node === 'object' && node !== null;
  }

  function isRoleProfile(node: unknown): node is IRoleProfileRuntime {
    return typeof node === 'object' && node !== null;
  }

  function normalizeSchema(schema?: string): string {
    const allowed = new Set(EXIT_SCHEMAS);

    return allowed.has(schema ?? '') ? String(schema) : 'success-failure';
  }

  function allowedExits(schema: string): TExit[] {
    return ALLOWED_EXITS_BY_SCHEMA[schema] ?? ['success', 'failure'];
  }

  function isExit(value: unknown): value is TExit {
    if (typeof value !== 'string') return false;

    return (
      value === 'success'
      || value === 'failure'
      || value === 'clarification'
      || value === 'blocked'
      || value === 'retry'
      || value === 'review'
    );
  }

  function portIndex(exit: TExit): number {
    return EXIT_TO_PORT[exit];
  }

  function RoleStage(this: INode, config: IRoleStageConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const projectNode = config.project ? RED.nodes.getNode(config.project) : undefined;
      const roleNode = config.role ? RED.nodes.getNode(config.role) : undefined;
      const projectCfg = isProjectConfig(projectNode) ? projectNode : undefined;
      const roleCfg = isRoleProfile(roleNode) ? roleNode : undefined;
      const chosenSchema = normalizeSchema(config.exitSchema);

      normalizeSchema(
        typeof projectCfg?.defaultExitSchema === 'string' ? projectCfg.defaultExitSchema : undefined,
      );
      const permitted = allowedExits(chosenSchema);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const requestedExit = isExit((msg as { exit?: unknown }).exit) // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { exit: TExit }).exit : 'success';
      const effectiveExit = permitted.indexOf(requestedExit) >= 0 ? requestedExit : permitted[0];
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prevTrace = Array.isArray((msg as { _trace?: unknown })._trace) // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { _trace: unknown[] })._trace : [];
      const traceEntry = {
        node: 'role-stage',
        at: now,
        exitSchema: chosenSchema,
        requestedExit,
        effectiveExit,
      };
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const diagList = Array.isArray((msg as { _diag?: unknown })._diag)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { _diag: unknown[] })._diag
        : [];
      const diagUsed = requestedExit !== effectiveExit;
      const out: IOrchestratorMsgExtended = {
        ...msg,
        exit: effectiveExit,
        _trace: prevTrace.concat([traceEntry]),
        _diag: diagUsed ? diagList.concat([
              {
                code: 'EXIT_NOT_ALLOWED',
                wanted: requestedExit,
                used: effectiveExit,
                schema: chosenSchema,
                at: now,
              },
            ]) : diagList,
        roleStage: {
          requireHumanGate: config.requireHumanGate ?? false,
        },
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        policy: projectCfg?.policy ?? (msg as { policy?: unknown }).policy,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        roleProfile: roleCfg ?? (msg as { roleProfile?: unknown }).roleProfile,
      };
      const outputs: (IOrchestratorMsgExtended | null)[] = [null, null, null, null, null, null];

      outputs[portIndex(effectiveExit)] = out;
      send(outputs);

      return done();
    });
  }

  RED.nodes.registerType<IRoleStageConfig>('role-stage', RoleStage);
}

export default register;
