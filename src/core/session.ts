import { SESSION_TTL_MIN } from '../config/constants';
import type { ChallengeDefinition, ChallengeSession, SlotState } from '../config/types';
import { challengeCatalog } from '../challenges/catalog';

export function buildSlotStates(challenge: ChallengeDefinition): SlotState[] {
  return challenge.slots.map((slot) => ({
    slotId: slot.id,
    status: 'pending',
    attempts: 0,
  }));
}

export function createSession(challengeId: string, issuedAt: number, ttlMinutes: number): ChallengeSession {
  const challenge = challengeCatalog.find((candidate) => candidate.id === challengeId);

  return {
    sessionId: `session-${issuedAt}-${Math.random().toString(16).slice(2, 8)}`,
    challengeId: challenge ? challenge.id : challengeId,
    issuedAt,
    expiresAt: issuedAt + ttlMinutes * 60_000,
    status: 'active',
    slots: challenge ? buildSlotStates(challenge) : [{ slotId: 'slot-1', status: 'pending', attempts: 0 }],
    rerollsUsed: 0,
  };
}

export function startSession(challengeId: string = challengeCatalog[0].id, now: number = Date.now()): ChallengeSession {
  return createSession(challengeId, now, SESSION_TTL_MIN);
}

export function rerollSession(session: ChallengeSession, now: number = Date.now()): ChallengeSession {
  const nextChallenge = challengeCatalog.find((challenge) => challenge.id !== session.challengeId) ?? challengeCatalog[0];

  return {
    ...createSession(nextChallenge.id, now, SESSION_TTL_MIN),
    rerollsUsed: session.rerollsUsed + 1,
  };
}

export function recordVerdict(
  session: ChallengeSession,
  slotId: string,
  passed: boolean,
  hash: string,
  now: number = Date.now(),
): ChallengeSession {
  const nextSlots: SlotState[] = session.slots.map((slot): SlotState => {
    if (slot.slotId !== slotId) {
      return slot;
    }

    const nextSlot: SlotState = {
      slotId: slot.slotId,
      status: passed ? 'passed' : 'failed',
      attempts: slot.attempts + 1,
      hash: passed ? hash : slot.hash,
      verifiedAt: now,
    };

    return nextSlot;
  });

  return {
    ...session,
    slots: nextSlots,
  };
}

export function completeSession(session: ChallengeSession, now: number = Date.now()): ChallengeSession {
  const hashes = session.slots.filter((slot) => slot.hash).map((slot) => slot.hash as string);
  const uniqueHashes = new Set(hashes);

  if (session.slots.length === 0 || hashes.length !== session.slots.length || uniqueHashes.size !== hashes.length) {
    return { ...session, status: 'abandoned' };
  }

  return {
    ...session,
    status: 'passed',
    expiresAt: now,
  };
}

export function abandonSession(session: ChallengeSession): ChallengeSession {
  return {
    ...session,
    status: 'abandoned',
  };
}

export function isSessionExpired(now: number, session: ChallengeSession): boolean {
  return session.expiresAt <= now;
}
