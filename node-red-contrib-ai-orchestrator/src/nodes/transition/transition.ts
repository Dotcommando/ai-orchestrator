import { EXIT } from '../../constants';
import { IOrchestratorMsg, IOrchestratorMsgExtended } from '../../types';
import { INode, IRED } from '../_common';

type TransitionMode = 'passthrough' | 'by-exit';

interface ITransitionConfig {
  name?: string;
  project?: string;
  role?: string;
  mode: TransitionMode;
  emitTopic?: boolean;

  successTeammate?: string;
  successIntent?: string;

  failureTeammate?: string;
  failureIntent?: string;

  clarificationTeammate?: string;
  clarificationIntent?: string;

  blockedTeammate?: string;
  blockedIntent?: string;

  retryTeammate?: string;
  retryIntent?: string;

  reviewTeammate?: string;
  reviewIntent?: string;
}

function register(RED: IRED): void {
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

  function selectTeammate(config: ITransitionConfig, exit: EXIT): string | undefined {
    if (exit === EXIT.SUCCESS) return config.successTeammate?.trim() || undefined;
    if (exit === EXIT.FAILURE) return config.failureTeammate?.trim() || undefined;
    if (exit === EXIT.CLARIFICATION) return config.clarificationTeammate?.trim() || undefined;
    if (exit === EXIT.BLOCKED) return config.blockedTeammate?.trim() || undefined;
    if (exit === EXIT.RETRY) return config.retryTeammate?.trim() || undefined;

    return config.reviewTeammate?.trim() || undefined;
  }

  function selectIntent(config: ITransitionConfig, exit: EXIT): string | undefined {
    if (exit === EXIT.SUCCESS) return config.successIntent ?? 'first-pass';
    if (exit === EXIT.FAILURE) return config.failureIntent ?? 'rework';
    if (exit === EXIT.CLARIFICATION) return config.clarificationIntent ?? 'human-override';
    if (exit === EXIT.BLOCKED) return config.blockedIntent ?? 'human-override';
    if (exit === EXIT.RETRY) return config.retryIntent ?? 'rework';

    return config.reviewIntent ?? 'human-override';
  }

  function buildTopic(projectId: string, teammate: string, intent: string): string {
    const project = encodeURIComponent(projectId);
    const team = encodeURIComponent(teammate);

    return 'project/' + project + '/team/' + team + '/' + intent;
  }

  function Transition(this: INode, config: ITransitionConfig): void {
    RED.nodes.createNode(this, config);

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const now = Date.now();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const exitValue = isExit((msg as { exit?: unknown }).exit)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { exit: EXIT }).exit : EXIT.SUCCESS;
      const useTable = (config.mode ?? 'passthrough') === 'by-exit';
      const decidedTeammate = useTable ? selectTeammate(config, exitValue) : undefined;
      const decidedIntent = useTable ? selectIntent(config, exitValue) : undefined;
      const toTeammate = decidedTeammate ?? msg.actor?.to;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const intent = decidedIntent ?? (msg as { nextIntent?: string }).nextIntent;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const tracePrev = Array.isArray((msg as { _trace?: unknown })._trace)
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ? (msg as { _trace: unknown[] })._trace : [];
      const traceEntry = {
        node: 'transition',
        at: now,
        mode: config.mode ?? 'passthrough',
        exit: exitValue,
        teammate: toTeammate,
        intent,
        decided: Boolean(decidedTeammate || decidedIntent),
      };
      const out: IOrchestratorMsgExtended = {
        ...msg,
        actor: {
          from: msg.actor?.from ?? msg.actor?.to,
          to: toTeammate,
          role: msg.actor?.role,
        },
        nextIntent: intent,
        transition: {
          decided: Boolean(decidedTeammate || decidedIntent),
          at: now,
        },
        _trace: tracePrev.concat([traceEntry]),
      };

      if (config.emitTopic && out.projectId && out.actor?.to && out.nextIntent) {
        const topic = buildTopic(
          String(out.projectId),
          String(out.actor.to),
          String(out.nextIntent),
        );
        const withTopic: IOrchestratorMsgExtended = { ...out, topic };

        send(withTopic);

        return done();
      }

      send(out);

      return done();
    });
  }

  RED.nodes.registerType<ITransitionConfig>('transition', Transition);
}

export default register;
