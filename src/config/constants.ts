export const UNLOCK_DURATION_DEFAULT_MIN = 30;
export const UNLOCK_DURATION_MIN_MIN = 5;
export const UNLOCK_DURATION_MAX_MIN = 120;
export const SESSION_TTL_MIN = 15;
export const MAX_REROLLS_PER_DAY = 2;
export const MAX_FAILED_VERDICTS = 8;
export const FAILURE_WINDOW_MIN = 10;
export const LOCKOUT_MIN = 5;
export const PREEXPIRY_NOTICE_MIN = 2;
export const DISTINCT_HASH_MIN_DISTANCE = 8;
export const IMAGE_MAX_SIDE_PX = 512;
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const EXIF_MAX_AGE_MIN = 20;
export const HISTORY_MAX_ENTRIES = 500;
export const BLOCKLIST_MAX = 100;
export const FRICTION_DELAY_MIN = 10;
export const MODEL_MAX_NEW_TOKENS = 4;
export const INFERENCE_TIMEOUT_MS = {
  webgpu: 30_000,
  wasm: 90_000,
  ollama: 60_000,
} as const;

export const APP_NAME = 'Grass Pass';
export const BLOCKED_PATH = 'blocked.html';
export const CHALLENGE_PATH = 'challenge.html';
