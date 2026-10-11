import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateSettings } from '../../src/storage/settings';
import { CURRENT_SCHEMA_VERSION, migrate } from '../../src/storage/migrations';
import { DEFAULT_BLOCKLIST } from '../../src/storage/schema';

describe('storage schema', () => {
  it('accepts the default settings object', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects invalid blocklist entries', () => {
    expect(() =>
      validateSettings({
        ...DEFAULT_SETTINGS,
        blocklist: ['not a domain'],
      }),
    ).toThrow();
  });

  it('keeps the current schema version stable', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(migrate({ ok: true }, 1, 1)).toEqual({ ok: true });
  });

  it('contains the required default blocklist entries', () => {
    expect(DEFAULT_BLOCKLIST).toContain('reddit.com');
    expect(DEFAULT_BLOCKLIST).toHaveLength(7);
  });
});
