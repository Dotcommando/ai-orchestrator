import { EXIT, EXIT_TO_PORT } from '../../constants';
import { IOrchestratorMsg } from '../../types';
import { INode, IRED } from '../_common';

type TTimerHandle = ReturnType<typeof globalThis.setTimeout>;
type TIntervalHandle = ReturnType<typeof globalThis.setInterval>;

enum HUMAN_GATE_EVENT {
  HUMAN_GATE_OPEN = 'HUMAN_GATE_OPEN',
  HUMAN_GATE_REMINDER = 'HUMAN_GATE_REMINDER',
  HUMAN_GATE_TIMEOUT = 'HUMAN_GATE_TIMEOUT',
  HUMAN_OVERRIDE_IGNORED = 'HUMAN_OVERRIDE_IGNORED',
  HUMAN_OVERRIDE_APPLIED = 'HUMAN_OVERRIDE_APPLIED',
  HUMAN_OVERRIDE_REJECTED = 'HUMAN_OVERRIDE_REJECTED',
  HUMAN_OVERRIDE_LATE = 'HUMAN_OVERRIDE_LATE',
  HUMAN_GATE_CLOSE = 'HUMAN_GATE_CLOSE',
  HUMAN_GATE_SUPERSEDED = 'HUMAN_GATE_SUPERSEDED',
}

enum GATE_MODE {
  GATE = 'gate',
  DELAY_ONLY = 'delay-only',
}

enum BIND_BY {
  PROJECT = 'project',
  WORK = 'work',
  ISSUE = 'issue',
  TOPIC = 'topic',
}

enum PATCH_KIND {
  NONE = 'none',
  TEXT = 'text',
  JSON = 'json',
  YAML = 'yaml',
  CODE_DIFF = 'code-diff',
}

enum PATCH_TARGET {
  PAYLOAD = 'payload',
  RESULT = 'result',
}

interface IAuthorInfo {
  id?: string;
  name?: string;
}

interface IAppliesTo {
  projectId?: string;
  workId?: string;
  issueId?: string;
  gateKey?: string;
}

interface IPatch {
  kind: 'text' | 'json' | 'yaml' | 'code-diff';
  value: string;
}

interface IHumanOverride {
  intent: 'clarify' | 'edit' | 'reject' | 'approve' | 'assign' | 'scope-change';
  appliesTo?: IAppliesTo;
  patch?: IPatch;
  notes?: string;
  requireAck?: boolean;
  requireTests?: boolean;
  author?: IAuthorInfo;
  source?: string;
  ts?: number;
}

interface IUserMessage {
  source: string;
  channelId?: string;
  author?: IAuthorInfo;
  correlation?: { projectId?: string; workId?: string; issueId?: string };
  text?: string;
  attachments?: unknown[];
  ts?: number;
}

interface IHumanGateConfig {
  name?: string;
  mode: GATE_MODE;
  requireAck: boolean;
  allowEdits: boolean;
  slaMs: number;
  remindEveryMs?: number;
  onTimeoutAs: EXIT;
  onRejectAs: EXIT;
  onScopeChangeAs: EXIT;
  allowedAuthorsCsv?: string;
  allowedSourcesCsv?: string;
  allowTeammates: boolean;
  bindBy: BIND_BY;
  acceptOutOfOrder: boolean;
  applyPatch: PATCH_KIND;
  patchTarget: PATCH_TARGET;
  requireTests: boolean;
  emitLog: boolean;
  topicNotifyMode: 'none' | 'auto' | 'manual';
  notifyTopic?: string;
}

interface ITraceEvent {
  code: HUMAN_GATE_EVENT;
  at: number;
  gateKey: string;
  details?: Record<string, unknown>;
}

interface IState {
  open: boolean;
  gateKey: string;
  openedAt: number;
  deadline: number;
  timeoutId?: TTimerHandle;
  reminderId?: TIntervalHandle;
  authors: string[];
  sources: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuthorInfo(value: unknown): value is IAuthorInfo {
  if (!isRecord(value)) return false;

  const idOk = !Object.prototype.hasOwnProperty.call(value, 'id') || typeof value.id === 'string';
  const nameOk = !Object.prototype.hasOwnProperty.call(value, 'name') || typeof value.name === 'string';

  return idOk && nameOk;
}

function isAppliesTo(value: unknown): value is IAppliesTo {
  if (!isRecord(value)) return false;

  const pOk = !Object.prototype.hasOwnProperty.call(value, 'projectId') || typeof value.projectId === 'string';
  const wOk = !Object.prototype.hasOwnProperty.call(value, 'workId') || typeof value.workId === 'string';
  const iOk = !Object.prototype.hasOwnProperty.call(value, 'issueId') || typeof value.issueId === 'string';
  const gOk = !Object.prototype.hasOwnProperty.call(value, 'gateKey') || typeof value.gateKey === 'string';

  return pOk && wOk && iOk && gOk;
}

function isPatch(value: unknown): value is IPatch {
  if (!isRecord(value)) return false;

  const kind = value.kind;

  if (kind !== 'text' && kind !== 'json' && kind !== 'yaml' && kind !== 'code-diff') return false;
  if (typeof value.value !== 'string') return false;

  return true;
}

function isHumanOverride(value: unknown): value is IHumanOverride {
  if (!isRecord(value)) return false;

  const intent = value.intent;

  if (
    intent !== 'clarify'
    && intent !== 'edit'
    && intent !== 'reject'
    && intent !== 'approve'
    && intent !== 'assign'
    && intent !== 'scope-change'
  )
    return false;
  if (Object.prototype.hasOwnProperty.call(value, 'appliesTo') && !isAppliesTo(value.appliesTo)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'patch') && !isPatch(value.patch)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'notes') && typeof value.notes !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'requireAck') && typeof value.requireAck !== 'boolean') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'requireTests') && typeof value.requireTests !== 'boolean') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'author') && !isAuthorInfo(value.author)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'source') && typeof value.source !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'ts') && typeof value.ts !== 'number') return false;

  return true;
}

function isUserMessage(value: unknown): value is IUserMessage {
  if (!isRecord(value)) return false;
  if (typeof value.source !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'channelId') && typeof value.channelId !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'author') && !isAuthorInfo(value.author)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'correlation') && !isRecord(value.correlation)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'text') && typeof value.text !== 'string') return false;
  if (Object.prototype.hasOwnProperty.call(value, 'attachments') && !Array.isArray(value.attachments)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'ts') && typeof value.ts !== 'number') return false;

  return true;
}

function isTraceEvent(value: unknown): value is ITraceEvent {
  if (!isRecord(value)) return false;
  if (typeof value.code !== 'string') return false;
  if (typeof value.at !== 'number') return false;

  return typeof value.gateKey === 'string';
}

function ensureTraceEvents(root: unknown): ITraceEvent[] {
  if (!Array.isArray(root)) return [];

  const events: ITraceEvent[] = [];

  for (let i = 0; i < root.length; i++) {
    const item = root[i];

    if (isTraceEvent(item)) events.push(item);
  }

  return events;
}

function ensureUnknownArray(root: unknown): unknown[] {
  if (!Array.isArray(root)) return [];

  return root.slice();
}

function splitCsv(csv?: string): string[] {
  if (!csv) return [];

  const parts = csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  return parts;
}

function addEvent(list: ITraceEvent[], code: HUMAN_GATE_EVENT, gateKey: string, details?: Record<string, unknown>): ITraceEvent[] {
  const entry: ITraceEvent = { code, at: Date.now(), gateKey, details };

  return list.concat([entry]);
}

function gateKeyFrom(bindBy: BIND_BY, msg: IOrchestratorMsg): string {
  const proj = typeof msg.projectId === 'string' ? msg.projectId : '';

  if (bindBy === BIND_BY.TOPIC) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const tRaw = (msg as { topic?: unknown }).topic;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const topic = typeof tRaw === 'string' ? (tRaw as string) : '';

    return 'topic:' + topic;
  }
  if (bindBy === BIND_BY.PROJECT) return 'project:' + proj;
  if (bindBy === BIND_BY.WORK) {
    const work = typeof msg.workId === 'string' ? msg.workId : '';

    return 'project:' + proj + ':work:' + work;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const corr = (msg as { correlation?: unknown }).correlation;
  const issue = isRecord(corr) && typeof corr.issueId === 'string' ? corr.issueId : '';

  return 'project:' + proj + ':issue:' + issue;
}

function isAllowedAuthor(override: IHumanOverride, authors: string[], allowTeammates: boolean, teammate?: string): boolean {
  const id = override.author?.id ?? '';

  if (authors.length === 0 && !allowTeammates) return true;
  if (authors.indexOf(id) >= 0) return true;

  return allowTeammates && typeof teammate === 'string' && teammate.length > 0 && id === teammate;
}

function isAllowedSource(override: IHumanOverride, sources: string[]): boolean {
  if (sources.length === 0) return true;

  const src = override.source ?? '';

  return sources.indexOf(src) >= 0;
}

function appliesToGate(override: IHumanOverride, gateKey: string): boolean {
  if (override.appliesTo && typeof override.appliesTo.gateKey === 'string') return override.appliesTo.gateKey === gateKey;

  return true;
}

function readSection(msg: IOrchestratorMsg, key: 'payload' | 'result'): Record<string, unknown> {
  if (key === 'payload') {
    return isRecord(msg.payload) ? { ...msg.payload } : {};
  }

  return isRecord(msg.result) ? { ...msg.result } : {};
}

function writeSection(msg: IOrchestratorMsg, key: 'payload' | 'result', section: Record<string, unknown>): IOrchestratorMsg {
  if (key === 'payload') {
    return { ...msg, payload: section };
  }

  return { ...msg, result: section };
}

function applyPatchText(targetMsg: IOrchestratorMsg, key: 'payload' | 'result', text: string): IOrchestratorMsg {
  const current = readSection(targetMsg, key);
  const next = { ...current, text };

  return writeSection(targetMsg, key, next);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function deepMergeJson(targetMsg: IOrchestratorMsg, key: 'payload' | 'result', jsonText: string): { ok: boolean; value?: IOrchestratorMsg } {
  try {
    const parsed = JSON.parse(jsonText);
    const rec = toRecord(parsed);

    if (rec === null) return { ok: false };

    const base = readSection(targetMsg, key);
    const merged: Record<string, unknown> = { ...base };
    const entries = Object.entries(rec);

    for (let i = 0; i < entries.length; i++) {
      const [propName, propValue] = entries[i];

      merged[propName] = propValue;
    }

    return { ok: true, value: writeSection(targetMsg, key, merged) };
  } catch {
    return { ok: false };
  }
}

function mapIntentToExit(intent: IHumanOverride['intent'], cfg: IHumanGateConfig, ackRequired: boolean, testsRequired: boolean): EXIT {
  if (intent === 'approve') {
    if (testsRequired || cfg.requireTests) return EXIT.REVIEW;

    return EXIT.SUCCESS;
  }
  if (intent === 'reject') return cfg.onRejectAs;
  if (intent === 'clarify') return EXIT.CLARIFICATION;
  if (intent === 'assign') return EXIT.REVIEW;
  if (intent === 'scope-change') return cfg.onScopeChangeAs;

  return ackRequired ? EXIT.CLARIFICATION : EXIT.SUCCESS;
}

function portIndex(exit: EXIT): number {
  return EXIT_TO_PORT[exit];
}

function isExitString(value: unknown): value is EXIT {
  return (
    value === EXIT.SUCCESS
    || value === EXIT.FAILURE
    || value === EXIT.CLARIFICATION
    || value === EXIT.BLOCKED
    || value === EXIT.RETRY
    || value === EXIT.REVIEW
  );
}

function hasExit(value: unknown): value is { exit: EXIT } {
  if (!isRecord(value)) return false;

  const raw = value['exit'];

  return isExitString(raw);
}

function register(RED: IRED): void {
  function HumanGate(this: INode, config: IHumanGateConfig): void {
    RED.nodes.createNode(this, config);

    let state: IState | undefined;
    const closeTimers = (): void => {
      if (state?.timeoutId) globalThis.clearTimeout(state.timeoutId);
      if (state?.reminderId) globalThis.clearInterval(state.reminderId);
    };
    const resetOpenGate = (gateKey: string, slaMs: number, authors: string[], sources: string[]): void => {
      const now = Date.now();
      const deadline = now + Math.max(0, slaMs);

      closeTimers();
      state = { open: true, gateKey, openedAt: now, deadline, authors, sources };

      if (config.remindEveryMs && config.remindEveryMs > 0) {
        state.reminderId = globalThis.setInterval(() => {
          const prev = ensureTraceEvents(undefined);
          const next = addEvent(prev, HUMAN_GATE_EVENT.HUMAN_GATE_REMINDER, gateKey);

          void next;
        }, config.remindEveryMs);
      }
      state.timeoutId = globalThis.setTimeout(() => {
        state = state ? { ...state, open: false } : undefined;
      }, Math.max(0, slaMs));
    };
    const withEvents = (msgIn: IOrchestratorMsg, add: (list: ITraceEvent[]) => ITraceEvent[]): IOrchestratorMsg => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prev = ensureTraceEvents((msgIn as { _events?: unknown })._events);
      const next = add(prev);

      return { ...msgIn, _events: next };
    };
    const withTrace = (msgIn: IOrchestratorMsg, entry: Record<string, unknown>): IOrchestratorMsg => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const prev = ensureUnknownArray((msgIn as { _trace?: unknown })._trace);
      const next = prev.concat([entry]);

      return { ...msgIn, _trace: next };
    };
    const finalize = (msgIn: IOrchestratorMsg, exit: EXIT, gateKey: string, extraDiag?: Record<string, unknown>): IOrchestratorMsg => {
      closeTimers();
      state = state ? { ...state, open: false } : undefined;
      const withClose = withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_GATE_CLOSE, gateKey, extraDiag));
      const traced = withTrace(withClose, { node: 'human-gate', at: Date.now(), gateKey, exit });

      return { ...traced, exit };
    };
    const handleTimeoutIfDue = (msgIn: IOrchestratorMsg, gateKey: string): IOrchestratorMsg | undefined => {
      if (!state?.open) return undefined;

      const now = Date.now();

      if (now < state.deadline) return undefined;

      const withTimeout = withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_GATE_TIMEOUT, gateKey));

      return finalize(withTimeout, config.onTimeoutAs, gateKey);
    };
    const openGate = (msgIn: IOrchestratorMsg): IOrchestratorMsg => {
      const gateKey = gateKeyFrom(config.bindBy, msgIn);
      const authors = splitCsv(config.allowedAuthorsCsv);
      const sources = splitCsv(config.allowedSourcesCsv);
      const superseded = state && state.open && state.gateKey !== gateKey;
      const withSupersede = superseded
        ? withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_GATE_SUPERSEDED, state ? state.gateKey : ''))
        : msgIn;
      const withOpen = withEvents(withSupersede, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_GATE_OPEN, gateKey));

      resetOpenGate(gateKey, config.slaMs, authors, sources);

      return withOpen;
    };
    const applyOverrideAndDecide = (msgIn: IOrchestratorMsg, override: IHumanOverride, gateKey: string): IOrchestratorMsg => {
      const teammate = msgIn.actor?.to;

      if (!isAllowedAuthor(override, state ? state.authors : [], config.allowTeammates, teammate)) {
        const outIgnored = withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_OVERRIDE_IGNORED, gateKey, { reason: 'author' }));

        return outIgnored;
      }
      if (!isAllowedSource(override, state ? state.sources : [])) {
        const outIgnored = withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_OVERRIDE_IGNORED, gateKey, { reason: 'source' }));

        return outIgnored;
      }
      if (!appliesToGate(override, gateKey)) {
        const outIgnored = withEvents(msgIn, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_OVERRIDE_IGNORED, gateKey, { reason: 'gateKey' }));

        return outIgnored;
      }

      const ackRequired = config.requireAck || Boolean(override.requireAck);
      const testsRequired = config.requireTests || Boolean(override.requireTests);
      let nextMsg = { ...msgIn };
      let patchApplied = false;
      let patchFailed = false;

      if (override.intent === 'edit' && config.allowEdits && config.applyPatch !== PATCH_KIND.NONE && override.patch) {
        if (override.patch.kind === 'text' && config.applyPatch === PATCH_KIND.TEXT) {
          const sectionKey = config.patchTarget === PATCH_TARGET.PAYLOAD ? 'payload' : 'result';

          nextMsg = applyPatchText(nextMsg, sectionKey, override.patch.value);
          patchApplied = true;
        } else if (override.patch.kind === 'json' && (config.applyPatch === PATCH_KIND.JSON || config.applyPatch === PATCH_KIND.TEXT)) {
          const sectionKey = config.patchTarget === PATCH_TARGET.PAYLOAD ? 'payload' : 'result';
          const merged = deepMergeJson(nextMsg, sectionKey, override.patch.value);

          if (merged.ok && merged.value) {
            nextMsg = merged.value;
            patchApplied = true;
          } else {
            patchFailed = true;
          }
        } else {
          patchFailed = true;
        }
      }
      if (patchFailed) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const prevDiag = ensureUnknownArray((nextMsg as { _diag?: unknown })._diag);
        const diag = prevDiag.concat([{ code: 'PATCH_APPLY_FAILED', at: Date.now() }]);

        return finalize({ ...nextMsg, _diag: diag }, EXIT.FAILURE, gateKey);
      }

      const exit = mapIntentToExit(override.intent, config, ackRequired, testsRequired);
      const detail: Record<string, unknown> = { intent: override.intent, patchApplied };
      const withApplied = withEvents(nextMsg, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_OVERRIDE_APPLIED, gateKey, detail));
      const withHuman = { ...withApplied, humanOverride: override };

      return finalize(withHuman, exit, gateKey, detail);
    };

    this.on('input', (msg: IOrchestratorMsg, send, done) => {
      const gateKey = gateKeyFrom(config.bindBy, msg);

      if (config.mode === GATE_MODE.DELAY_ONLY) {
        const opened = openGate(msg);
        const timed = handleTimeoutIfDue(opened, gateKey);

        if (timed) {
          const outsDelay: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

          outsDelay[portIndex(config.onTimeoutAs)] = timed;
          send(outsDelay);

          return done();
        }
        send(opened);

        return done();
      }
      if (!state || !state.open || state.gateKey !== gateKey) {
        const opened = openGate(msg);
        const outsOpen: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

        outsOpen[portIndex(EXIT.CLARIFICATION)] = opened;
        send(outsOpen);

        return done();
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const overrideMaybe = (msg as { humanOverride?: unknown }).humanOverride;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const userMsgMaybe = (msg as { userMessage?: unknown }).userMessage;

      if (isHumanOverride(overrideMaybe)) {
        const decided = applyOverrideAndDecide(msg, overrideMaybe, gateKey);
        const outs: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];
        const exit = hasExit(decided) ? decided.exit : EXIT.CLARIFICATION;

        outs[portIndex(exit)] = decided;
        send(outs);

        return done();
      }
      if (isUserMessage(userMsgMaybe)) {
        const out = withEvents(msg, (list) => addEvent(list, HUMAN_GATE_EVENT.HUMAN_OVERRIDE_IGNORED, gateKey, { reason: 'not-mapped' }));
        const outs: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

        outs[portIndex(EXIT.CLARIFICATION)] = out;
        send(outs);

        return done();
      }

      const timed = handleTimeoutIfDue(msg, gateKey);

      if (timed) {
        const outs: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

        outs[portIndex(config.onTimeoutAs)] = timed;
        send(outs);

        return done();
      }

      const outsPass: (IOrchestratorMsg | null)[] = [null, null, null, null, null, null];

      outsPass[portIndex(EXIT.CLARIFICATION)] = msg;
      send(outsPass);

      return done();
    });
  }

  RED.nodes.registerType<IHumanGateConfig>('human-gate', HumanGate);
}

export default register;
