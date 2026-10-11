export type ParsedAnswer = 'yes' | 'no' | 'unparseable';

export function parseAnswer(raw: string): ParsedAnswer {
  const normalized = raw.trim();
  if (normalized.length === 0) {
    return 'unparseable';
  }

  const lowered = normalized.toLowerCase();
  if (lowered.startsWith('yes')) {
    return 'yes';
  }

  if (lowered.startsWith('no')) {
    return 'no';
  }

  return 'unparseable';
}

export function isSelfTestPass(raw: string, expected: 'yes' | 'no'): boolean {
  return parseAnswer(raw) === expected;
}
