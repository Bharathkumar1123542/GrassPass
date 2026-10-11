import type { HistoryEntry } from '../config/types';

export interface StatsSnapshot {
  totalUnlocks: number;
  streakDays: number;
  history: HistoryEntry[];
}

export function computeStreakDays(history: HistoryEntry[], now: number = Date.now()): number {
  const uniqueDates = new Set(
    history
      .map((entry) => new Date(entry.completedAt).toISOString().slice(0, 10))
      .filter((date) => date.length > 0),
  );

  const dates = Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) {
    return 0;
  }

  const today = new Date(now).toISOString().slice(0, 10);
  let streak = 0;
  const cursor = new Date(today);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (dates.includes(key)) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    }

    if (streak === 0) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (dates.includes(cursor.toISOString().slice(0, 10))) {
        streak = 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        continue;
      }
    }

    break;
  }

  return streak;
}

export function readStats(history: HistoryEntry[]): StatsSnapshot {
  return {
    totalUnlocks: history.length,
    streakDays: computeStreakDays(history),
    history: history.slice(0, 50),
  };
}
