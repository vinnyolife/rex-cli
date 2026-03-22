function countFailures(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  return Number(value || 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function teacherCallCompleted(callStatus) {
  return callStatus === 'complete' || callStatus === 'fallback_complete' || callStatus === 'ok' || callStatus === 'fallback_ok';
}

export function computeTerminalReward({ baselineFailures, finalFailures, newFailures, verificationStatus }) {
  const baselineCount = countFailures(baselineFailures);
  const finalCount = countFailures(finalFailures);
  const newFailureCount = countFailures(newFailures);

  if (verificationStatus && verificationStatus !== 'ok') {
    return -1;
  }
  if (newFailureCount > 0) {
    return -1;
  }
  if (finalCount === 0 && newFailureCount === 0) {
    return 1;
  }
  if (finalCount < baselineCount && newFailureCount === 0) {
    return 0.25;
  }
  if (finalCount === baselineCount && newFailureCount === 0) {
    return 0;
  }
  return -1;
}

export function fuseReward({ terminalReward, shapingScore, callStatus }) {
  const teacherTerm = teacherCallCompleted(callStatus)
    ? clamp(Number(shapingScore || 0) * 0.2, -0.2, 0.2)
    : 0;
  const rawFused = Number(terminalReward) + teacherTerm;

  if (terminalReward > 0) {
    return {
      teacherTerm,
      fusedReward: Math.max(0.05, rawFused),
    };
  }

  if (terminalReward === 0) {
    return {
      teacherTerm,
      fusedReward: clamp(rawFused, -0.2, 0.2),
    };
  }

  return {
    teacherTerm,
    fusedReward: Math.min(-0.05, rawFused),
  };
}

export function summarizeReward({ terminalReward, teacherTerm, fusedReward }) {
  return {
    terminalReward,
    teacherTerm,
    fusedReward,
  };
}
