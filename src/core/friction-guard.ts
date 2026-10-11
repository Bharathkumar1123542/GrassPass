import { FRICTION_DELAY_MIN } from '../config/constants';
import type { PendingChange, Settings, SettingsPatch } from '../config/types';

export function classifyChange(
  previous: Settings,
  patch: SettingsPatch,
  now: number = Date.now(),
): { immediate: SettingsPatch; delayed: PendingChange[] } {
  if (!previous.frictionGuardEnabled) {
    return { immediate: patch, delayed: [] };
  }

  const immediate: SettingsPatch = {};
  const delayed: PendingChange[] = [];

  if (patch.enabled !== undefined) {
    if (patch.enabled === false) {
      delayed.push({
        id: `pending-disable-${now}`,
        kind: 'disable',
        value: null,
        createdAt: now,
        applyAt: now + FRICTION_DELAY_MIN * 60_000,
      });
    } else {
      immediate.enabled = true;
    }
  }

  if (patch.blocklist !== undefined) {
    const nextBlocklist = patch.blocklist;
    const removed = previous.blocklist.filter((domain) => !nextBlocklist.includes(domain));
    for (const domain of removed) {
      delayed.push({
        id: `pending-remove-${domain}-${now}`,
        kind: 'removeDomain',
        value: domain,
        createdAt: now,
        applyAt: now + FRICTION_DELAY_MIN * 60_000,
      });
    }

    if (nextBlocklist.length > 0) {
      immediate.blocklist = nextBlocklist;
    }
  }

  if (patch.unlockDurationMinutes !== undefined) {
    if (patch.unlockDurationMinutes > previous.unlockDurationMinutes) {
      delayed.push({
        id: `pending-duration-${now}`,
        kind: 'increaseDuration',
        value: patch.unlockDurationMinutes,
        createdAt: now,
        applyAt: now + FRICTION_DELAY_MIN * 60_000,
      });
    } else {
      immediate.unlockDurationMinutes = patch.unlockDurationMinutes;
    }
  }

  if (patch.tier !== undefined) {
    immediate.tier = patch.tier;
  }

  return { immediate, delayed };
}

export function applyDuePendingChanges(settings: Settings, now: number = Date.now()): Settings {
  const pendingChanges = settings.pendingChanges.filter((change) => change.applyAt <= now);
  if (pendingChanges.length === 0) {
    return settings;
  }

  const next = { ...settings, pendingChanges: settings.pendingChanges.filter((change) => change.applyAt > now) };

  for (const change of pendingChanges) {
    switch (change.kind) {
      case 'disable':
        next.enabled = false;
        break;
      case 'removeDomain':
        if (typeof change.value === 'string') {
          next.blocklist = next.blocklist.filter((domain) => domain !== change.value);
        }
        break;
      case 'increaseDuration':
        if (typeof change.value === 'number') {
          next.unlockDurationMinutes = Math.max(next.unlockDurationMinutes, change.value);
        }
        break;
      default:
        break;
    }
  }

  return next;
}

export function cancelPendingChange(settings: Settings, id: string): Settings {
  return {
    ...settings,
    pendingChanges: settings.pendingChanges.filter((change) => change.id !== id),
  };
}
