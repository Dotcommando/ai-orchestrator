export type TExit = 'success' | 'failure' | 'clarification' | 'blocked' | 'retry' | 'review';

export enum ExitPort {
  Success = 0,
  Failure = 1,
  Clarification = 2,
  Blocked = 3,
  Retry = 4,
  Review = 5,
}

export const EXIT_TO_PORT: Record<TExit, ExitPort> = {
  success: ExitPort.Success,
  failure: ExitPort.Failure,
  clarification: ExitPort.Clarification,
  blocked: ExitPort.Blocked,
  retry: ExitPort.Retry,
  review: ExitPort.Review,
};

export const EXIT_SCHEMAS: readonly string[] = [
  'success-failure',
  'success-failure-clarification',
  'success-failure-retry',
  'success-failure-review',
  'full',
];

export const ALLOWED_EXITS_BY_SCHEMA: Record<string, TExit[]> = {
  'success-failure': ['success', 'failure'],
  'success-failure-clarification': ['success', 'failure', 'clarification'],
  'success-failure-retry': ['success', 'failure', 'retry'],
  'success-failure-review': ['success', 'failure', 'review'],
  full: ['success', 'failure', 'clarification', 'blocked', 'retry', 'review'],
};
