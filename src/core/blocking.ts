export function normalizeHostname(value: string): string {
  const normalized = value.trim().toLowerCase();
  const withoutScheme = normalized.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const cleanHost = withoutScheme.replace(/:\d+$/, '').replace(/^\.+/, '').replace(/\.+$/, '');

  if (!cleanHost) {
    return '';
  }

  const segments = cleanHost.split('.').filter(Boolean);
  if (segments.length <= 1) {
    return cleanHost;
  }

  return segments.join('.');
}

export function matchesBlocklist(hostname: string, blocklist: string[]): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return false;
  }

  return blocklist.some((entry) => {
    const normalizedEntry = normalizeHostname(entry);
    if (!normalizedEntry) {
      return false;
    }

    if (normalizedHostname === normalizedEntry) {
      return true;
    }

    return normalizedHostname.endsWith(`.${normalizedEntry}`) && !normalizedEntry.startsWith('.');
  });
}

export function isBlockedUrl(url: string, blocklist: string[], now: number, unlockedUntil: number | null): boolean {
  try {
    const parsed = new URL(url);
    const proto = parsed.protocol.toLowerCase();
    if (proto !== 'http:' && proto !== 'https:') {
      return false;
    }

    if (unlockedUntil !== null && now < unlockedUntil) {
      return false;
    }

    return matchesBlocklist(parsed.hostname, blocklist);
  } catch {
    return false;
  }
}
