import { ALLOWED_EXITS_BY_SCHEMA, EXIT, EXIT_SCHEMA, EXIT_TO_PORT } from '../../constants';
import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

interface ICursor {
  index: number;
  attempt: number;
}

interface IPolicy {
  retries?: { maxAttempts?: number };
}

interface IStagePlanRunnerConfig {
  name?: string;
  exitSchema?: string;
  maxAttempts?: number;
  onExhausted?: EXIT;
  advanceOnSuccess?: boolean;
  resetAttemptOnAdvance?: boolean;
  preferBlockedAs?: EXIT;
}

function isExit(value: unknown): value is EXIT {
  if (typeof value !== 'string') return false;

  return (
    value === EXIT.SUCCESS
    || value === EXIT.FAILURE
    || value === EXIT.CLARIFICATION
    || value === EXIT.BLOCKED
    || value === EXIT.RETRY
    || value === EXIT.REVIEW
  );
}

function isExitSchema(value: unknown): value is EXIT_SCHEMA {
  if (typeof value !== 'string') return false;
  const values = Object.values(EXIT_SCHEMA);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return values.indexOf(value as EXIT_SCHEMA) >= 0;
}

function normalizeSchema(schema?: string): EXIT_SCHEMA {
  return isExitSchema(schema) ? schema : EXIT_SCHEMA.FULL;
}

function allowedExits(schema: EXIT_SCHEMA): EXIT[] {
  return ALLOWED_EXITS_BY_SCHEMA[schema] ?? [EXIT.SUCCESS, EXIT.FAILURE, EXIT.CLARIFICATION, EXIT.BLOCKED, EXIT.RETRY, EXIT.REVIEW];
}

function mapToAllowed(exit: EXIT, schema: EXIT_SCHEMA, preferBlockedAs: EXIT): EXIT {
  const allowed = allowedExits(schema);

  if (allowed.indexOf(exit) >= 0) return exit;
  if (exit === EXIT.BLOCKED) {
    if (allowed.indexOf(preferBlockedAs) >= 0) return preferBlockedAs;
    if (allowed.indexOf(EXIT.FAILURE) >= 0) return EXIT.FAILURE;
    if (allowed.indexOf(EXIT.REVIEW) >= 0) return EXIT.REVIEW;

    return EXIT.CLARIFICATION;
  }
  if (exit === EXIT.REVIEW) {
    if (allowed.indexOf(EXIT.REVIEW) >= 0) return EXIT.REVIEW;
    if (allowed.indexOf(EXIT.CLARIFICATION) >= 0) return EXIT.CLARIFICATION;

    return EXIT.FAILURE;
  }
  if (exit === EXIT.RETRY) {
    if (allowed.indexOf(EXIT.RETRY) >= 0) return EXIT.RETRY;
    if (allowed.indexOf(EXIT.FAILURE) >= 0) return EXIT.FAILURE;

    return EXIT.CLARIFICATION;
  }
  if (exit === EXIT.CLARIFICATION) {
    if (allowed.indexOf(EXIT.CLARIFICATION) >= 0) return EXIT.CLARIFICATION;
    if (allowed.indexOf(EXIT.REVIEW) >= 0) return EXIT.REVIEW;

    return EXIT.FAILURE;
  }

  return allowed.indexOf(EXIT.SUCCESS) >= 0 ? EXIT.SUCCESS : EXIT.FAILURE;
}

function portIndex(exit: EXIT): number {
  return EXIT_TO_PORT[exit];
}

function limitFrom(configLimit: number | undefined, policy: IPolicy | undefined): number {
  const cfg = typeof configLimit === 'number' && configLimit > 0 ? configLimit : 0;
  const pol = typeof policy?.retries?.maxAttempts === 'number' && policy.retries.maxAttempts > 0 ? policy.retries.maxAttempts : 0;

  return Math.max(cfg, pol);
}

function register(RED: IRED): void {
  function StagePlanRunner(this: INode, config: IStagePlanRunnerConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const schema = normalizeSchema(config.exitSchema);
      const preferBlockedAs = config.preferBlockedAs ?? EXIT.FAILURE;
      const onExhausted = config.onExhausted ?? EXIT.RETRY;
      const advanceOnSuccess = config.advanceOnSuccess ?? true;
      const resetAttemptOnAdvance = config.resetAttemptOnAdvance ?? true;
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const cursor: ICursor = (msg as { cursor?: ICursor }).cursor ?? { index: 0, attempt: 0 };
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const policy: IPolicy | undefined = (msg as { policy?: IPolicy }).policy;
      const maxAttempts = limitFrom(config.maxAttempts, policy);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const requested = isExit((msg as { exit?: unknown }).exit)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { exit: EXIT }).exit : EXIT.SUCCESS;
      const exhausted = maxAttempts > 0 && cursor.attempt >= maxAttempts;
      const rawExit = exhausted ? onExhausted : requested;
      const effectiveExit = mapToAllowed(rawExit, schema, preferBlockedAs);
      const indexBefore = cursor.index;
      const attemptBefore = cursor.attempt;
      let indexAfter = indexBefore;
      let attemptAfter = attemptBefore;

      if (effectiveExit === EXIT.SUCCESS && advanceOnSuccess) {
        indexAfter = indexBefore + 1;
        attemptAfter = resetAttemptOnAdvance ? 0 : attemptBefore;
      } else if (effectiveExit === EXIT.RETRY) {
        attemptAfter = attemptBefore + 1;
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prevTrace = Array.isArray((msg as { _trace?: unknown })._trace)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { _trace: unknown[] })._trace : [];
      const traceEntry = {
        node: 'stage-plan-runner',
        at: now,
        exitSchema: schema,
        requestedExit: requested,
        effectiveExit,
        indexBefore,
        indexAfter,
        attemptBefore,
        attemptAfter,
      };
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prevDiag = Array.isArray((msg as { _diag?: unknown })._diag)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { _diag: unknown[] })._diag
        : [];
      const diag = requested !== effectiveExit
        ? prevDiag.concat([
          {
            code: 'EXIT_NOT_ALLOWED',
            wanted: requested,
            used: effectiveExit,
            schema,
            at: now,
          },
        ])
        : prevDiag;
      const nextMsg: IOrchestratorMsg = {
        ...msg,
        exit: effectiveExit,
        cursor: { index: indexAfter, attempt: attemptAfter },
        _trace: prevTrace.concat([traceEntry]),
        _diag: diag,
      };
      const outs: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

      outs[portIndex(effectiveExit)] = nextMsg;
      send(outs);

      return done();
    });
  }

  RED.nodes.registerType<IStagePlanRunnerConfig>('stage-plan-runner', StagePlanRunner);
}

export default register;
