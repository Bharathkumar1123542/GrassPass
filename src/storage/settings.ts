import type { Settings, Tier } from '../config/types';
import { CURRENT_SCHEMA_VERSION, DEFAULT_BLOCKLIST, settingsSchema, validateSettings as parseSettings } from './schema';

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  enabled: true,
  blocklist: DEFAULT_BLOCKLIST,
  unlockDurationMinutes: 30,
  modelTier: 'balanced',
  backend: 'transformers',
  ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'moondream' },
  captureMode: 'both',
  notifyBeforeExpiry: true,
  frictionGuardEnabled: true,
  pendingChanges: [],
};

export function validateSettings(raw: unknown): Settings {
  return parseSettings(raw ?? DEFAULT_SETTINGS);
}

export async function readSettings(): Promise<Settings> {
  const result = typeof chrome !== 'undefined' ? await chrome.storage.local.get('settings') : {};
  const value = result.settings ?? DEFAULT_SETTINGS;
  return validateSettings(value);
}

export async function writeSettings(settings: Settings): Promise<void> {
  if (typeof chrome !== 'undefined') {
    await chrome.storage.local.set({ settings: validateSettings(settings) });
  }
}

export function getTierLabel(tier: Tier): string {
  return tier === 'fast' ? 'Fast' : tier === 'balanced' ? 'Balanced' : 'Accurate';
}
