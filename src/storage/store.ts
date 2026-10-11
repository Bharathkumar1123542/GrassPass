import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  challengeSessionSchema,
  dailyCountersSchema,
  historyEntrySchema,
  rateLimitStateSchema,
  settingsSchema,
  unlockStateSchema,
} from './schema';
import type { ChallengeSession, DailyCounters, HistoryEntry, RateLimitState, Settings, UnlockState } from '../config/types';

export type StorageArea = 'local' | 'session';

export type FlatStorageKey =
  | 'settings'
  | 'unlock'
  | 'history'
  | 'rateLimit'
  | 'daily'
  | 'recentChallenges'
  | 'session'
  | 'schemaVersion';

const schemaByKey: Record<FlatStorageKey, z.ZodType<unknown>> = {
  settings: settingsSchema,
  unlock: unlockStateSchema.nullable(),
  history: z.array(historyEntrySchema),
  rateLimit: rateLimitStateSchema,
  daily: dailyCountersSchema,
  recentChallenges: z.array(z.string()),
  session: challengeSessionSchema.nullable(),
  schemaVersion: z.number().int().nonnegative(),
};

const getChromeStore = (area: StorageArea) => {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: { storage?: { local?: { get: (k?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>; set: (items: Record<string, unknown>) => Promise<void>; remove: (keys: string | string[]) => Promise<void> }; session?: { get: (k?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>; set: (items: Record<string, unknown>) => Promise<void>; remove: (keys: string | string[]) => Promise<void> } } } }).chrome;
  if (!chromeApi?.storage) {
    return undefined;
  }
  return area === 'session' ? chromeApi.storage.session : chromeApi.storage.local;
};

export function getDefaultValue<K extends FlatStorageKey>(key: K): Record<FlatStorageKey, unknown>[K] {
  switch (key) {
    case 'settings':
      return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        enabled: true,
        blocklist: ['x.com', 'twitter.com', 'reddit.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'youtube.com'],
        unlockDurationMinutes: 30,
        modelTier: 'balanced',
        backend: 'transformers',
        ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'moondream' },
        captureMode: 'both',
        notifyBeforeExpiry: true,
        frictionGuardEnabled: true,
        pendingChanges: [],
      } as Settings;
    case 'unlock':
      return null as UnlockState | null;
    case 'history':
      return [] as HistoryEntry[];
    case 'rateLimit':
      return { failures: [], lockoutUntil: null } as RateLimitState;
    case 'daily':
      return { dateKey: new Date().toISOString().slice(0, 10), rerolls: 0 } as DailyCounters;
    case 'recentChallenges':
      return [] as string[];
    case 'session':
      return null as ChallengeSession | null;
    case 'schemaVersion':
      return CURRENT_SCHEMA_VERSION;
    default:
      return undefined as never;
  }
}

export async function readStorageValue<K extends FlatStorageKey>(key: K, fallback?: Record<FlatStorageKey, unknown>[K], area: StorageArea = 'local'): Promise<Record<FlatStorageKey, unknown>[K]> {
  const defaultValue = fallback ?? getDefaultValue(key);
  const target = getChromeStore(area);
  if (!target) {
    return defaultValue;
  }

  const result = await target.get(key);
  const raw = result[key];

  if (raw === undefined) {
    return defaultValue;
  }

  try {
    return schemaByKey[key].parse(raw) as Record<FlatStorageKey, unknown>[K];
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn(`Invalid storage value for ${key}; resetting to default.`, error);
    }
    await target.set({ [key]: defaultValue });
    return defaultValue;
  }
}

export async function writeStorageValue<K extends FlatStorageKey>(key: K, value: Record<FlatStorageKey, unknown>[K], area: StorageArea = 'local'): Promise<void> {
  const target = getChromeStore(area);
  if (!target) {
    return;
  }

  try {
    schemaByKey[key].parse(value);
    await target.set({ [key]: value });
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn(`Rejected invalid storage value for ${key}.`, error);
    }
    throw error;
  }
}

export async function removeStorageValue(key: FlatStorageKey, area: StorageArea = 'local'): Promise<void> {
  const target = getChromeStore(area);
  if (!target) {
    return;
  }

  await target.remove(key);
}

export const readSettingsFromStore = async (): Promise<Settings> => {
  const value = await readStorageValue('settings', getDefaultValue('settings'), 'local');
  return settingsSchema.parse(value);
};

export const writeSettingsToStore = async (value: Settings): Promise<void> => {
  await writeStorageValue('settings', settingsSchema.parse(value), 'local');
};

export const readUnlockFromStore = async (): Promise<UnlockState | null> => {
  const value = await readStorageValue('unlock', getDefaultValue('unlock'), 'local');
  return value == null ? null : unlockStateSchema.parse(value);
};

export const readSessionFromStore = async (): Promise<ChallengeSession | null> => {
  const value = await readStorageValue('session', getDefaultValue('session'), 'session');
  return value == null ? null : challengeSessionSchema.parse(value);
};

export const readRateLimitFromStore = async (): Promise<RateLimitState> => {
  const value = await readStorageValue('rateLimit', getDefaultValue('rateLimit'), 'local');
  return rateLimitStateSchema.parse(value);
};

export const readDailyCountersFromStore = async (): Promise<DailyCounters> => {
  const value = await readStorageValue('daily', getDefaultValue('daily'), 'local');
  return dailyCountersSchema.parse(value);
};

export const readHistoryFromStore = async (): Promise<HistoryEntry[]> => {
  const value = await readStorageValue('history', getDefaultValue('history'), 'local');
  return z.array(historyEntrySchema).parse(value);
};

export const readSchemaVersionFromStore = async (): Promise<number> => {
  return (await readStorageValue('schemaVersion', CURRENT_SCHEMA_VERSION, 'local')) as number;
};
