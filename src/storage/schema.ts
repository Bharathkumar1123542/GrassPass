import { z } from 'zod';
import type {
  ChallengeSession,
  DailyCounters,
  HistoryEntry,
  PendingChange,
  RateLimitState,
  Settings,
  SettingsPatch,
  UnlockState,
} from '../config/types';

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_BLOCKLIST = ['x.com', 'twitter.com', 'reddit.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'youtube.com'];

const domainRegex = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z0-9-]{2,}$/i;
const blocklistSchema = z
  .array(z.string().trim().min(3).max(253).refine((value) => domainRegex.test(value), 'Invalid domain'))
  .max(100)
  .refine((entries) => new Set(entries).size === entries.length, 'Duplicate blocklist entries are not allowed')
  .refine((entries) => entries.every((entry) => !['chrome.com', 'chromewebstore.google.com', 'google.com'].includes(entry)), 'Reserved domains are not allowed');

export const pendingChangeSchema: z.ZodType<PendingChange> = z.object({
  id: z.string().min(1),
  kind: z.enum(['disable', 'removeDomain', 'increaseDuration']),
  value: z.union([z.string(), z.number(), z.null()]),
  createdAt: z.number().finite(),
  applyAt: z.number().finite(),
});

export const unlockStateSchema: z.ZodType<UnlockState> = z.object({
  grantedAt: z.number().int().positive(),
  unlockedUntil: z.number().int().positive(),
  challengeId: z.string().min(1),
});

export const challengeSessionSchema: z.ZodType<ChallengeSession> = z.object({
  sessionId: z.string().min(1),
  challengeId: z.string().min(1),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  status: z.enum(['active', 'passed', 'abandoned', 'expired']),
  slots: z.array(
    z.object({
      slotId: z.string().min(1),
      status: z.enum(['pending', 'passed', 'failed']),
      attempts: z.number().int().nonnegative(),
      hash: z.string().regex(/^[0-9a-f]{16}$/).optional(),
      verifiedAt: z.number().int().positive().optional(),
    }),
  ),
  rerollsUsed: z.number().int().nonnegative(),
});

export const historyEntrySchema: z.ZodType<HistoryEntry> = z.object({
  id: z.string().min(1),
  completedAt: z.number().int().positive(),
  challengeId: z.string().min(1),
  durationSec: z.number().int().nonnegative(),
  unlockMinutes: z.number().int().positive(),
  modelId: z.string().min(1),
  device: z.enum(['webgpu', 'wasm', 'ollama']),
  inferenceMsTotal: z.number().int().nonnegative(),
});

export const rateLimitStateSchema: z.ZodType<RateLimitState> = z.object({
  failures: z.array(z.number().int().nonnegative()),
  lockoutUntil: z.number().int().positive().nullable(),
});

export const dailyCountersSchema: z.ZodType<DailyCounters> = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rerolls: z.number().int().nonnegative(),
});

export const ollamaConfigSchema = z
  .object({
    baseUrl: z
      .string()
      .trim()
      .refine((value) => {
        try {
          const parsed = new URL(value);
          const host = parsed.hostname;
          const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
          return parsed.protocol === 'http:' && allowedHosts.has(host) && parsed.username === '' && parsed.password === '' && parsed.pathname === '/';
        } catch {
          return false;
        }
      }, 'Ollama baseUrl must point to localhost over HTTP without a path'),
    model: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._:/-]+$/),
  })
  .strict();

export const settingsPatchSchema: z.ZodType<SettingsPatch> = z
  .object({
    blocklist: z.array(z.string().trim().min(1)).optional(),
    unlockDurationMinutes: z.number().int().min(5).max(120).optional(),
    enabled: z.boolean().optional(),
    tier: z.enum(['fast', 'balanced', 'accurate']).optional(),
    modelTier: z.enum(['fast', 'balanced', 'accurate']).optional(),
    backend: z.enum(['transformers', 'ollama']).optional(),
    captureMode: z.enum(['webcam', 'upload', 'both']).optional(),
    notifyBeforeExpiry: z.boolean().optional(),
    frictionGuardEnabled: z.boolean().optional(),
  })
  .strict();

export const settingsSchema: z.ZodType<Settings> = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  enabled: z.boolean(),
  blocklist: blocklistSchema,
  unlockDurationMinutes: z.number().int().min(5).max(120),
  modelTier: z.enum(['fast', 'balanced', 'accurate']),
  backend: z.enum(['transformers', 'ollama']),
  ollama: ollamaConfigSchema,
  captureMode: z.enum(['webcam', 'upload', 'both']),
  notifyBeforeExpiry: z.boolean(),
  frictionGuardEnabled: z.boolean(),
  pendingChanges: z.array(pendingChangeSchema),
});

export function validateSettings(raw: unknown): Settings {
  return settingsSchema.parse(raw);
}

export function validateUnlockState(raw: unknown): UnlockState | null {
  if (raw == null) {
    return null;
  }
  return unlockStateSchema.parse(raw);
}

export function validateHistoryEntry(raw: unknown): HistoryEntry {
  return historyEntrySchema.parse(raw);
}

export function validateSession(raw: unknown): ChallengeSession | null {
  if (raw == null) {
    return null;
  }
  return challengeSessionSchema.parse(raw);
}

export function validateRateLimitState(raw: unknown): RateLimitState {
  return rateLimitStateSchema.parse(raw);
}

export function validateDailyCounters(raw: unknown): DailyCounters {
  return dailyCountersSchema.parse(raw);
}
