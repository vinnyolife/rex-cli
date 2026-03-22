const SUPPORTED_ACTIONS = new Set(['read', 'run', 'patch', 'stop']);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function normalizePatchDiff(text) {
  assertNonEmptyString(text, 'patch diff');
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export function validateStudentAction(action) {
  assertObject(action, 'student action');
  assertNonEmptyString(action.action, 'student action.action');
  if (!SUPPORTED_ACTIONS.has(action.action)) {
    throw new Error(`unsupported action: ${action.action}`);
  }

  if (action.action === 'read') {
    assertNonEmptyString(action.path, 'student action.path');
    return {
      action: 'read',
      path: action.path,
    };
  }

  if (action.action === 'run') {
    assertNonEmptyString(action.command, 'student action.command');
    return {
      action: 'run',
      command: action.command,
    };
  }

  if (action.action === 'patch') {
    return {
      action: 'patch',
      diff: normalizePatchDiff(action.diff),
    };
  }

  assertNonEmptyString(action.message, 'student action.message');
  return {
    action: 'stop',
    message: action.message,
  };
}

export function parseStudentAction(rawText) {
  assertNonEmptyString(rawText, 'student action payload');
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`invalid student action JSON: ${error.message}`);
  }
  return validateStudentAction(parsed);
}
