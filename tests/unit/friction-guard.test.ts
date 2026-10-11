import { describe, expect, it } from 'vitest';
import { applyDuePendingChanges, classifyChange } from '../../src/core/friction-guard';
import { DEFAULT_SETTINGS } from '../../src/storage/settings';

describe('friction guard', () => {
  it('delays weakening changes but applies strengthening changes immediately', () => {
    const result = classifyChange(DEFAULT_SETTINGS, { enabled: false }, 1_700_000_000_000);
    expect(result.delayed).toHaveLength(1);
    expect(result.immediate.enabled).toBeUndefined();

    const immediate = classifyChange(DEFAULT_SETTINGS, { unlockDurationMinutes: 15 }, 1_700_000_000_000);
    expect(immediate.immediate.unlockDurationMinutes).toBe(15);
    expect(immediate.delayed).toHaveLength(0);
  });

  it('applies due pending changes when the timestamp is reached', () => {
    const settings: typeof DEFAULT_SETTINGS = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      pendingChanges: [
        {
          id: 'pending-1',
          kind: 'disable',
          value: null,
          createdAt: 1_700_000_000_000,
          applyAt: 1_700_000_000_000,
        },
      ],
    };

    const applied = applyDuePendingChanges(settings, 1_700_000_000_000);
    expect(applied.enabled).toBe(false);
    expect(applied.pendingChanges).toHaveLength(0);
  });
});
