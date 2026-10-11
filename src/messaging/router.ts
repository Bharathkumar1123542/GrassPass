import { getChallengeById } from '../challenges/catalog';
import { challengeCatalog } from '../challenges/catalog';
import { completeSession, recordVerdict, rerollSession, startSession, abandonSession } from '../core/session';
import { isUnlockActive, createUnlockState } from '../core/unlock';
import { readStats } from '../core/stats';
import { classifyChange, cancelPendingChange } from '../core/friction-guard';
import { DEFAULT_SETTINGS, readSettings, writeSettings, validateSettings } from '../storage/settings';
import { settingsPatchSchema } from '../storage/schema';
import type { ChallengeSession, HistoryEntry, Request, Result, Settings, StateSnapshot, UnlockState } from '../config/types';
import { ok, fail, parseRequest } from './index';

const readChromeValue = async <T>(area: 'local' | 'session', key: string, fallback: T): Promise<T> => {
  if (typeof chrome === 'undefined') {
    return fallback;
  }

  const storageArea = area === 'session' ? chrome.storage.session : chrome.storage.local;
  const value = await storageArea.get(key);
  return (value[key] as T | undefined) ?? fallback;
};

const writeChromeValue = async (area: 'local' | 'session', key: string, value: unknown): Promise<void> => {
  if (typeof chrome === 'undefined') {
    return;
  }

  const storageArea = area === 'session' ? chrome.storage.session : chrome.storage.local;
  await storageArea.set({ [key]: value });
};

export async function buildStateSnapshot(): Promise<StateSnapshot> {
  const settings = await readSettings();
  const unlock = await readChromeValue<UnlockState | null>('local', 'unlock', null);
  const session = await readChromeValue<ChallengeSession | null>('session', 'session', null);
  const history = await readChromeValue<HistoryEntry[]>('local', 'history', []);
  const lockout = await readChromeValue<{ lockoutUntil: number | null }>('local', 'rateLimit', { lockoutUntil: null });
  const now = Date.now();

  const challenge = session ? getChallengeById(session.challengeId) ?? null : null;
  const unlocked = isUnlockActive(now, unlock);
  const remainingMs = unlock && unlocked ? Math.max(0, unlock.unlockedUntil - now) : 0;

  return {
    enabled: settings.enabled,
    unlocked,
    unlockedUntil: unlock?.unlockedUntil ?? null,
    remainingMs,
    activeSession: session,
    challenge,
    lockoutUntil: lockout?.lockoutUntil ?? null,
    rerollsRemaining: Math.max(0, 2 - (session?.rerollsUsed ?? 0)),
    streakDays: readStats(history).streakDays,
  };
}

export async function handleSettingsUpdate(patch: Partial<Settings> | Record<string, unknown>): Promise<Settings> {
  const current = await readSettings();
  const normalized = settingsPatchSchema.safeParse(patch);
  const nextPatch = normalized.success ? { ...normalized.data } : {};
  if (nextPatch.modelTier !== undefined && nextPatch.tier === undefined) {
    nextPatch.tier = nextPatch.modelTier;
  }
  if (nextPatch.tier !== undefined && nextPatch.modelTier === undefined) {
    nextPatch.modelTier = nextPatch.tier;
  }

  const classified = classifyChange(current, nextPatch, Date.now());
  const merged = {
    ...current,
    ...nextPatch,
    ...classified.immediate,
  };

  const nextSettings: Settings = {
    ...current,
    ...merged,
    blocklist: merged.blocklist ?? current.blocklist,
    pendingChanges: [...current.pendingChanges, ...classified.delayed],
  };

  await writeSettings(validateSettings(nextSettings));
  return nextSettings;
}

export async function dispatchRouter(message: unknown): Promise<Result<unknown>> {
  const request = parseRequest(message);
  if (!request) {
    return fail('INVALID_INPUT', 'Unknown request');
  }

  try {
    switch (request.type) {
      case 'state.get': {
        return ok(await buildStateSnapshot());
      }
      case 'settings.get': {
        return ok(await readSettings());
      }
      case 'settings.update': {
        return ok(await handleSettingsUpdate(request.patch ?? {}));
      }
      case 'settings.cancelPending': {
        const current = await readSettings();
        const next = cancelPendingChange(current, request.id);
        await writeSettings(validateSettings(next));
        return ok(next);
      }
      case 'blocklist.add': {
        const current = await readSettings();
        const domain = request.domain.trim().toLowerCase();
        if (!domain) {
          return fail('INVALID_INPUT', 'Domain is required');
        }
        const next = { ...current, blocklist: Array.from(new Set([...current.blocklist, domain])) };
        await writeSettings(validateSettings(next));
        return ok(next);
      }
      case 'blocklist.remove': {
        const current = await readSettings();
        const next = { ...current, blocklist: current.blocklist.filter((domain) => domain !== request.domain.trim().toLowerCase()) };
        await writeSettings(validateSettings(next));
        return ok(next);
      }
      case 'stats.get': {
        const history = await readChromeValue<HistoryEntry[]>('local', 'history', []);
        return ok(readStats(history));
      }
      case 'session.start': {
        const session = startSession(challengeCatalog[0].id, Date.now());
        await writeChromeValue('session', 'session', session);
        return ok({ session, challenge: challengeCatalog[0] });
      }
      case 'session.reroll': {
        const active = await readChromeValue<ChallengeSession | null>('session', 'session', null);
        if (!active) {
          return fail('SESSION_NOT_FOUND', 'No active session found');
        }
        const next = rerollSession(active, Date.now());
        await writeChromeValue('session', 'session', next);
        return ok({ session: next, challenge: getChallengeById(next.challengeId) ?? challengeCatalog[0] });
      }
      case 'session.slotVerdict': {
        const active = await readChromeValue<ChallengeSession | null>('session', 'session', null);
        if (!active) {
          return fail('SESSION_NOT_FOUND', 'No active session found');
        }
        const next = recordVerdict(active, request.slotId, request.passed, request.hash, Date.now());
        await writeChromeValue('session', 'session', next);
        return ok(next);
      }
      case 'session.complete': {
        const active = await readChromeValue<ChallengeSession | null>('session', 'session', null);
        if (!active) {
          return fail('SESSION_NOT_FOUND', 'No active session found');
        }
        const complete = completeSession(active, Date.now());
        await writeChromeValue('session', 'session', complete);
        const unlock = createUnlockState(complete.challengeId, Date.now(), (await readSettings()).unlockDurationMinutes);
        await writeChromeValue('local', 'unlock', unlock);
        return ok(unlock);
      }
      case 'session.abandon': {
        const active = await readChromeValue<ChallengeSession | null>('session', 'session', null);
        if (!active) {
          return fail('SESSION_NOT_FOUND', 'No active session found');
        }
        const abandoned = abandonSession(active);
        await writeChromeValue('session', 'session', abandoned);
        return ok(null);
      }
      case 'debug.forceExpire': {
        await writeChromeValue('local', 'unlock', null);
        return ok(null);
      }
      default: {
        const requestType = 'type' in request ? String((request as { type?: string }).type ?? 'unknown') : 'unknown';
        return fail('INVALID_INPUT', `Unsupported request: ${requestType}`);
      }
    }
  } catch (error) {
    return fail('RUNTIME_ERROR', error instanceof Error ? error.message : 'Unknown runtime error');
  }
}

export { ok, fail };
