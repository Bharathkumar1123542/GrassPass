import { z } from 'zod';
import type { ErrorCode, Request, Result, SettingsPatch, VerdictReason, Device } from '../config/types';
import { settingsPatchSchema } from '../storage/schema';

const verdictReasonSchema = z.enum(['ok', 'duplicate', 'screen_detected', 'subject_not_found', 'unparseable']);
const deviceSchema = z.enum(['webgpu', 'wasm', 'ollama']);

export const requestSchema: z.ZodType<Request> = z.union([
  z.object({ type: z.literal('state.get') }),
  z.object({ type: z.literal('session.start') }),
  z.object({ type: z.literal('session.reroll'), sessionId: z.string().min(1) }),
  z.object({
    type: z.literal('session.slotVerdict'),
    sessionId: z.string().min(1),
    slotId: z.string().min(1),
    passed: z.boolean(),
    hash: z.string().min(1),
    reason: verdictReasonSchema,
    modelId: z.string().min(1),
    device: deviceSchema,
    inferenceMs: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('session.complete'), sessionId: z.string().min(1) }),
  z.object({ type: z.literal('session.abandon'), sessionId: z.string().min(1) }),
  z.object({ type: z.literal('settings.get') }),
  z.object({ type: z.literal('settings.update'), patch: settingsPatchSchema }),
  z.object({ type: z.literal('settings.cancelPending'), id: z.string().min(1) }),
  z.object({ type: z.literal('blocklist.add'), domain: z.string().trim().min(1) }),
  z.object({ type: z.literal('blocklist.remove'), domain: z.string().trim().min(1) }),
  z.object({ type: z.literal('stats.get') }),
  z.object({ type: z.literal('debug.forceExpire') }),
]);

export function ok<T>(value: T): Result<T> {
  return { ok: true, data: value };
}

export function fail<T>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } } as Result<T>;
}

export function buildSettingsPatch(blocklist: string[], durationMinutes: number): SettingsPatch {
  return {
    blocklist,
    unlockDurationMinutes: durationMinutes,
  };
}

export function parseRequest(payload: unknown): Request | null {
  const result = requestSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export function dispatchRequest(payload: unknown): Result<unknown> {
  const request = parseRequest(payload);
  if (!request) {
    return fail('INVALID_INPUT', 'Unknown request');
  }

  return ok({ request });
}
