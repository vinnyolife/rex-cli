import {
  computeTerminalReward,
  fuseReward as fuseCoreReward,
  summarizeReward,
} from '../rl-core/reward-engine.mjs';

const SHELL_TO_CORE_CALL_STATUS = {
  ok: 'complete',
  fallback_ok: 'fallback_complete',
  invalid_response: 'invalid_response',
  failed_all_backends: 'failed_all_backends',
};

export { computeTerminalReward, summarizeReward };

export function fuseReward({ terminalReward, shapingScore, callStatus }) {
  return fuseCoreReward({
    terminalReward,
    shapingScore,
    callStatus: SHELL_TO_CORE_CALL_STATUS[callStatus] || callStatus,
  });
}
