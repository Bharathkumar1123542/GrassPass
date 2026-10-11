import { FAILURE_WINDOW_MIN, LOCKOUT_MIN, MAX_FAILED_VERDICTS } from '../config/constants';

export interface RateLimitState {
  failures: number[];
  lockoutUntil: number | null;
}

export function pruneFailures(failures: number[], now: number, windowMinutes: number = FAILURE_WINDOW_MIN): number[] {
  const windowMs = windowMinutes * 60_000;
  return failures.filter((timestamp) => now - timestamp <= windowMs);
}

export function isRateLimited(state: RateLimitState, now: number): boolean {
  return state.lockoutUntil !== null && now < state.lockoutUntil;
}

export function recordFailure(
  state: RateLimitState,
  now: number,
  maxFailures: number = MAX_FAILED_VERDICTS,
  lockoutMinutes: number = LOCKOUT_MIN,
): RateLimitState {
  const failures = pruneFailures([...state.failures, now], now);
  const nextState: RateLimitState = {
    failures,
    lockoutUntil: state.lockoutUntil,
  };

  if (failures.length >= maxFailures) {
    nextState.lockoutUntil = now + lockoutMinutes * 60_000;
  }

  return nextState;
}

export function clearExpiredLockout(state: RateLimitState, now: number): RateLimitState {
  if (state.lockoutUntil === null || now < state.lockoutUntil) {
    return state;
  }

  return {
    failures: pruneFailures(state.failures, now),
    lockoutUntil: null,
  };
}
