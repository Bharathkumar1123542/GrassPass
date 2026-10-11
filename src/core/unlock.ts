import type { UnlockState } from '../config/types';

export function isUnlockActive(now: number, unlock: UnlockState | null): boolean {
  if (!unlock) {
    return false;
  }

  return unlock.grantedAt <= now && now < unlock.unlockedUntil;
}

export function createUnlockState(challengeId: string, now: number, durationMinutes: number): UnlockState {
  const grantedAt = now;
  const unlockedUntil = grantedAt + durationMinutes * 60_000;

  return {
    grantedAt,
    unlockedUntil,
    challengeId,
  };
}
