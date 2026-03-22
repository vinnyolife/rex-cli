import {
  buildTeacherPrompt,
  callTeacher as callCoreTeacher,
  defaultTeacherTransport,
  normalizeTeacherResponse as normalizeCoreTeacherResponse,
} from '../rl-core/teacher-gateway.mjs';

const SHELL_TO_CORE_CALL_STATUS = {
  ok: 'complete',
  fallback_ok: 'fallback_complete',
  invalid_response: 'invalid_response',
  failed_all_backends: 'failed_all_backends',
};

const CORE_TO_SHELL_CALL_STATUS = {
  complete: 'ok',
  fallback_complete: 'fallback_ok',
  invalid_response: 'invalid_response',
  failed_all_backends: 'failed_all_backends',
};

function toShellResponse(response) {
  return {
    ...response,
    call_status: CORE_TO_SHELL_CALL_STATUS[response.call_status] || response.call_status,
  };
}

export { buildTeacherPrompt, defaultTeacherTransport };

export function normalizeTeacherResponse(raw, { backend, callStatus }) {
  return toShellResponse(normalizeCoreTeacherResponse(raw, {
    backend,
    callStatus: SHELL_TO_CORE_CALL_STATUS[callStatus] || callStatus,
  }));
}

export async function callTeacher({ primary, fallbacks = [], trace, transport = defaultTeacherTransport, cwd = process.cwd() }) {
  const response = await callCoreTeacher({
    primary,
    fallbacks,
    trace,
    transport,
    cwd,
  });
  return toShellResponse(response);
}
