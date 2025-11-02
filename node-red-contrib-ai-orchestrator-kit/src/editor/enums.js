;(function () {
  const root = typeof globalThis === 'object' && globalThis ? globalThis : {};
  if (!root.AIO_ENUMS) root.AIO_ENUMS = {};
  const enums = root.AIO_ENUMS;

  enums.EXIT_SCHEMAS = [
    'success-failure',
    'success-failure-clarification',
    'success-failure-retry',
    'success-failure-review',
    'full',
  ];

  enums.INTENTS = ['first-pass', 'rework', 'wrapup', 'human-override', 'escalation'];
})();
