import { describe, expect, it } from 'vitest';
import { resolveDevice, resolveTier } from '../../src/vision/device';
import { parseAnswer } from '../../src/vision/parse-answer';
import { verifySlot } from '../../src/vision/verify-slot';

describe('vision parsing', () => {
  it('accepts yes/no prefixes and rejects ambiguous text', () => {
    expect(parseAnswer('YES, definitely')).toBe('yes');
    expect(parseAnswer(' no  ')).toBe('no');
    expect(parseAnswer('maybe')).toBe('unparseable');
  });
});

describe('vision device selection', () => {
  it('falls back to wasm when a WebGPU adapter is unavailable', () => {
    expect(['webgpu', 'wasm']).toContain(resolveDevice());
    expect(['fast', 'balanced', 'accurate']).toContain(resolveTier(resolveDevice()));
  });
});

describe('verification flow', () => {
  it('rejects duplicates before it runs the image question', async () => {
    let called = false;

    const result = await verifySlot({
      previousHashes: ['0000000000000000'],
      imageHash: '0000000000000001',
      screenQuestion: 'Is this a photo of a screen?',
      subjectQuestion: 'Is this photo of a leaf?',
      askYesNo: async () => {
        called = true;
        return 'no';
      },
    });

    expect(result.reason).toBe('duplicate');
    expect(called).toBe(false);
  });

  it('passes when subject and screen checks are valid', async () => {
    const result = await verifySlot({
      previousHashes: ['1111111111111111'],
      imageHash: '0000000000000000',
      screenQuestion: 'Is this a photo of a screen?',
      subjectQuestion: 'Is this photo of a leaf?',
      askYesNo: async (question) => (question.includes('screen') ? 'no' : 'yes'),
    });

    expect(result.passed).toBe(true);
    expect(result.reason).toBe('ok');
  });
});
