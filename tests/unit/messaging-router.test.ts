import { describe, expect, it } from 'vitest';
import { buildSettingsPatch, parseRequest } from '../../src/messaging';
import { dispatchRouter } from '../../src/messaging/router';

describe('message routing', () => {
  it('accepts the core request shapes', () => {
    expect(parseRequest({ type: 'state.get' })).toEqual({ type: 'state.get' });
    expect(parseRequest({ type: 'settings.update', patch: { unlockDurationMinutes: 45 } })).toEqual({
      type: 'settings.update',
      patch: { unlockDurationMinutes: 45 },
    });
    expect(parseRequest({ type: 'blocklist.add', domain: 'example.com' })).toEqual({
      type: 'blocklist.add',
      domain: 'example.com',
    });
  });

  it('builds patch payloads for settings updates', () => {
    expect(buildSettingsPatch(['reddit.com'], 60)).toEqual({
      blocklist: ['reddit.com'],
      unlockDurationMinutes: 60,
    });
  });

  it('returns a state snapshot without crashing when chrome is unavailable', async () => {
    const result = await dispatchRouter({ type: 'state.get' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected a successful result');
    }

    expect(result.data).toMatchObject({
      enabled: true,
      unlocked: false,
      remainingMs: 0,
      activeSession: null,
    });
  });
});
