export type Device = 'webgpu' | 'wasm' | 'ollama';
export type Tier = 'fast' | 'balanced' | 'accurate';
export type VerdictReason = 'ok' | 'duplicate' | 'screen_detected' | 'subject_not_found' | 'unparseable';

export interface UnlockState {
  grantedAt: number;
  unlockedUntil: number;
  challengeId: string;
}

export interface SlotDefinition {
  id: string;
  label: string;
  subjectQuestion: string;
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  instructions: string;
  difficulty: 1 | 2 | 3;
  slots: SlotDefinition[];
}

export interface SlotState {
  slotId: string;
  status: 'pending' | 'passed' | 'failed';
  attempts: number;
  hash?: string;
  verifiedAt?: number;
}

export interface ChallengeSession {
  sessionId: string;
  challengeId: string;
  issuedAt: number;
  expiresAt: number;
  status: 'active' | 'passed' | 'abandoned' | 'expired';
  slots: SlotState[];
  rerollsUsed: number;
}

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'SESSION_NOT_FOUND'
  | 'MODEL_SELF_TEST_FAILED'
  | 'EXIF_MISSING'
  | 'EXIF_STALE'
  | 'RUNTIME_ERROR'
  | 'UNKNOWN';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export type Request =
  | { type: 'state.get' }
  | { type: 'session.start' }
  | { type: 'session.reroll'; sessionId: string }
  | { type: 'session.slotVerdict'; sessionId: string; slotId: string; passed: boolean; hash: string; reason: VerdictReason; modelId: string; device: Device; inferenceMs: number }
  | { type: 'session.complete'; sessionId: string }
  | { type: 'session.abandon'; sessionId: string }
  | { type: 'settings.get' }
  | { type: 'settings.update'; patch: SettingsPatch }
  | { type: 'settings.cancelPending'; id: string }
  | { type: 'blocklist.add'; domain: string }
  | { type: 'blocklist.remove'; domain: string }
  | { type: 'stats.get' }
  | { type: 'debug.forceExpire' };

export interface PendingChange {
  id: string;
  kind: 'disable' | 'removeDomain' | 'increaseDuration';
  value: string | number | null;
  createdAt: number;
  applyAt: number;
}

export interface Settings {
  schemaVersion: 1;
  enabled: boolean;
  blocklist: string[];
  unlockDurationMinutes: number;
  modelTier: Tier;
  backend: 'transformers' | 'ollama';
  ollama: { baseUrl: string; model: string };
  captureMode: 'webcam' | 'upload' | 'both';
  notifyBeforeExpiry: boolean;
  frictionGuardEnabled: boolean;
  pendingChanges: PendingChange[];
}

export interface SettingsPatch {
  blocklist?: string[];
  unlockDurationMinutes?: number;
  enabled?: boolean;
  tier?: Tier;
  modelTier?: Tier;
  backend?: 'transformers' | 'ollama';
  captureMode?: 'webcam' | 'upload' | 'both';
  notifyBeforeExpiry?: boolean;
  frictionGuardEnabled?: boolean;
}

export interface StateSnapshot {
  enabled: boolean;
  unlocked: boolean;
  unlockedUntil: number | null;
  remainingMs: number;
  activeSession: ChallengeSession | null;
  challenge: ChallengeDefinition | null;
  lockoutUntil: number | null;
  rerollsRemaining: number;
  streakDays: number;
}

export interface HistoryEntry {
  id: string;
  completedAt: number;
  challengeId: string;
  durationSec: number;
  unlockMinutes: number;
  modelId: string;
  device: Device;
  inferenceMsTotal: number;
}

export interface RateLimitState {
  failures: number[];
  lockoutUntil: number | null;
}

export interface DailyCounters {
  dateKey: string;
  rerolls: number;
}

export interface LoadProgress {
  phase: 'init' | 'download' | 'ready';
  progress: number;
  message: string;
}

export interface BackendInfo {
  id: 'transformers' | 'ollama' | 'fake';
  device: Device;
  model?: string;
}

export interface VisionBackend {
  readonly id: 'transformers' | 'ollama' | 'fake';
  init(onProgress: (p: LoadProgress) => void, signal: AbortSignal): Promise<BackendInfo>;
  askYesNo(question: string, image: Blob | File): Promise<boolean>;
  close(): Promise<void>;
}
