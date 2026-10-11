import { describe, expect, it } from 'vitest';
import { readStats } from '../../src/core/stats';

describe('stats', () => {
  it('counts total unlocks and streak days across history entries', () => {
    const now = new Date('2026-10-11T12:00:00Z').getTime();
    const stats = readStats([
      { id: '1', completedAt: now, challengeId: 'leaf-trail', durationSec: 60, unlockMinutes: 30, modelId: 'fake', device: 'webgpu', inferenceMsTotal: 1200 },
      { id: '2', completedAt: now - 86_400_000, challengeId: 'open-sky', durationSec: 45, unlockMinutes: 30, modelId: 'fake', device: 'wasm', inferenceMsTotal: 1500 },
      { id: '3', completedAt: now - 2 * 86_400_000, challengeId: 'tree-bark', durationSec: 50, unlockMinutes: 30, modelId: 'fake', device: 'webgpu', inferenceMsTotal: 1800 },
    ]);

    expect(stats.totalUnlocks).toBe(3);
    expect(stats.streakDays).toBe(3);
  });
});
