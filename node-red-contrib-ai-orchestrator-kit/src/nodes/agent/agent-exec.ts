import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

type TExit = 'success' | 'failure' | 'clarification' | 'blocked' | 'retry' | 'review';

enum EXIT_SCHEMA {
  FULL = 'full',
  SUCCESS_FAILURE = 'success-failure',
  SUCCESS_FAILURE_CLARIFICATION = 'success-failure-clarification',
  SUCCESS_FAILURE_RETRY = 'success-failure-retry',
  SUCCESS_FAILURE_REVIEW = 'success-failure-review',
}

enum ON_EXHAUSTED {
  RETRY = 'retry',
  FAILURE = 'failure',
  REVIEW = 'review',
  CLARIFICATION = 'clarification',
}

enum PREFER_BLOCKED_AS {
  FAILURE = 'failure',
  REVIEW = 'review',
  CLARIFICATION = 'clarification',
}

interface ICursor {
  index: number;
  attempt: number;
}

interface IPolicy {
  retries?: { maxAttempts?: number };
}

interface IAgentExecConfig {
  name?: string;
  exitSchema?: EXIT_SCHEMA;
  maxAttempts?: number;
  onExhausted?: ON_EXHAUSTED;
  preferBlockedAs?: PREFER_BLOCKED_AS;
}

function portIndex(exit: TExit): number {
  if (exit === 'success') return 0;
  if (exit === 'failure') return 1;
  if (exit === 'clarification') return 2;
  if (exit === 'blocked') return 3;
  if (exit === 'retry') return 4;

  return 5;
}

function allowedExits(schema: EXIT_SCHEMA): ReadonlyArray<TExit> {
  if (schema === EXIT_SCHEMA.SUCCESS_FAILURE) return ['success', 'failure'];
  if (schema === EXIT_SCHEMA.SUCCESS_FAILURE_CLARIFICATION)
    return ['success', 'failure', 'clarification'];
  if (schema === EXIT_SCHEMA.SUCCESS_FAILURE_RETRY) return ['success', 'failure', 'retry'];
  if (schema === EXIT_SCHEMA.SUCCESS_FAILURE_REVIEW) return ['success', 'failure', 'review'];

  return ['success', 'failure', 'clarification', 'blocked', 'retry', 'review'];
}

function mapToAllowed(exit: TExit, schema: EXIT_SCHEMA, preferBlockedAs: PREFER_BLOCKED_AS): TExit {
  const allowed = allowedExits(schema);

  if (allowed.indexOf(exit) >= 0) return exit;
  if (exit === 'blocked') {
    if (allowed.indexOf(preferBlockedAs) >= 0) return preferBlockedAs;
    if (allowed.indexOf('failure') >= 0) return 'failure';
    if (allowed.indexOf('review') >= 0) return 'review';

    return 'clarification';
  }
  if (exit === 'review') {
    if (allowed.indexOf('review') >= 0) return 'review';
    if (allowed.indexOf('clarification') >= 0) return 'clarification';

    return 'failure';
  }
  if (exit === 'retry') {
    if (allowed.indexOf('retry') >= 0) return 'retry';
    if (allowed.indexOf('failure') >= 0) return 'failure';

    return 'clarification';
  }
  if (exit === 'clarification') {
    if (allowed.indexOf('clarification') >= 0) return 'clarification';
    if (allowed.indexOf('review') >= 0) return 'review';

    return 'failure';
  }

  return allowed.indexOf('success') >= 0 ? 'success' : 'failure';
}

function decideDefaultExit(msg: IOrchestratorMsg): TExit {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  if (typeof (msg as { result?: unknown }).result !== 'undefined') return 'success';

  return 'failure';
}

function isExhausted(
  maxAttempts: unknown,
  cursor: ICursor | undefined,
  policy: IPolicy | undefined,
): boolean {
  const cfgLimit = typeof maxAttempts === 'number' && maxAttempts > 0 ? maxAttempts : 0;
  const policyLimit = typeof policy?.retries?.maxAttempts === 'number' && policy.retries.maxAttempts > 0
      ? policy.retries.maxAttempts
      : 0;
  const limit = Math.max(cfgLimit, policyLimit);

  if (limit <= 0) return false;
  if (!cursor) return false;

  return cursor.attempt >= limit;
}

function buildOut(msg: IOrchestratorMsg, exit: TExit): (IOrchestratorMsg | null)[] {
  const out: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

  out[portIndex(exit)] = { ...msg, exit };

  return out;
}

function register(RED: IRED): void {
  function AgentExec(this: INode, configRaw: IAgentExecConfig): void {
    RED.nodes.createNode(this, configRaw);

    this.on(
      'input',
      (msg: IOrchestratorMsg, send: (m: unknown) => void, done: () => void): void => {
        const exitSchema = configRaw.exitSchema && Object.values(EXIT_SCHEMA).includes(configRaw.exitSchema)
            ? configRaw.exitSchema
            : EXIT_SCHEMA.FULL;
        const preferBlockedAs = configRaw.preferBlockedAs
          && Object.values(PREFER_BLOCKED_AS).includes(configRaw.preferBlockedAs)
            ? configRaw.preferBlockedAs
            : PREFER_BLOCKED_AS.FAILURE;
        const onExhausted = configRaw.onExhausted && Object.values(ON_EXHAUSTED).includes(configRaw.onExhausted)
            ? configRaw.onExhausted
            : ON_EXHAUSTED.RETRY;
        const maxAttempts = typeof configRaw.maxAttempts === 'number' ? configRaw.maxAttempts : 0;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const cursor = (msg as { cursor?: ICursor }).cursor;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const policy = (msg as { policy?: IPolicy }).policy;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const initialExit = (msg as { exit?: TExit }).exit ?? decideDefaultExit(msg);
        const exhausted = isExhausted(maxAttempts, cursor, policy);
        const rawExit: TExit = exhausted ? onExhausted : initialExit;
        const normalizedExit = mapToAllowed(rawExit, exitSchema, preferBlockedAs);
        const outs = buildOut(msg, normalizedExit);

        send(outs);

        return done();
      },
    );
  }

  RED.nodes.registerType<IAgentExecConfig>('agent-exec', AgentExec);
}

export = register;
