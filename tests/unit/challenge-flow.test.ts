import { describe, expect, it } from 'vitest';
import { challengeCatalog } from '../../src/challenges/catalog';
import { completeSession, recordVerdict, startSession } from '../../src/core/session';
import { clearExpiredLockout, isRateLimited, recordFailure, type RateLimitState } from '../../src/core/rate-limiter';

describe('challenge flow', () => {
  it('creates a valid session with the catalog challenge layout', () => {
    const session = startSession(challengeCatalog[0].id, 1_700_000_000_000);
    expect(session.status).toBe('active');
    expect(session.slots.length).toBe(challengeCatalog[0].slots.length);
    expect(session.slots.every((slot) => slot.status === 'pending')).toBe(true);
  });

  it('marks a session complete only when every slot passes with a unique hash', () => {
    const session = startSession(challengeCatalog[0].id, 1_700_000_000_000);
    const first = recordVerdict(session, session.slots[0].slotId, true, '0123456789abcdef', 1_700_000_000_100);
    const second = recordVerdict(first, session.slots[1].slotId, true, 'fedcba9876543210', 1_700_000_000_200);
    const completed = completeSession(second, 1_700_000_000_300);

    expect(completed.status).toBe('passed');
  });
});

describe('rate limiter', () => {
  it('locks out after eight failed verdicts in the window and clears once expired', () => {
    let state: RateLimitState = { failures: [], lockoutUntil: null };
    const now = 1_700_000_000_000;

    for (let index = 0; index < 8; index += 1) {
      state = recordFailure(state, now + index * 60_000);
    }

    expect(isRateLimited(state, now + 4 * 60_000)).toBe(true);
    state = clearExpiredLockout(state, state.lockoutUntil ?? now + 5 * 60_000 + 1);
    expect(state.lockoutUntil).toBeNull();
  });
});
