import { describe, expect, it } from 'vitest';
import { matchesBlocklist } from '../../src/core/blocking';
import { createSession, isSessionExpired } from '../../src/core/session';
import { createUnlockState, isUnlockActive } from '../../src/core/unlock';
import { dHashDistance } from '../../src/lib/hash';

describe('blocking rules', () => {
  it('blocks matching hostnames while excluding lookalike domains', () => {
    expect(matchesBlocklist('https://reddit.com/', ['reddit.com'])).toBe(true);
    expect(matchesBlocklist('https://www.reddit.com/', ['reddit.com'])).toBe(true);
    expect(matchesBlocklist('https://x.com/', ['box.com'])).toBe(false);
    expect(matchesBlocklist('https://foo.box.com/', ['box.com'])).toBe(true);
  });
});

describe('unlock state', () => {
  it('tracks valid unlock windows and rejects expired windows', () => {
    const now = 1_700_000_000_000;
    const unlock = createUnlockState('challenge-1', now, 30);

    expect(isUnlockActive(now, unlock)).toBe(true);
    expect(isUnlockActive(now + 31 * 60_000, unlock)).toBe(false);
    expect(isUnlockActive(now - 1_000, null)).toBe(false);
  });
});

describe('session lifecycle', () => {
  it('creates an active session that expires at the configured time', () => {
    const now = 1_700_000_000_000;
    const session = createSession('challenge-1', now, 15);

    expect(session.status).toBe('active');
    expect(session.slots).toHaveLength(1);
    expect(isSessionExpired(now + 15 * 60_000 + 1, session)).toBe(true);
  });
});

describe('dHash', () => {
  it('computes a simple edit distance for distinctness checks', () => {
    expect(dHashDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(dHashDistance('0000000000000000', '0000000000000001')).toBe(1);
    expect(dHashDistance('0000000000000000', '1111111111111111')).toBe(16);
  });
});
