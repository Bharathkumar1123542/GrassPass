import { defineBackground } from 'wxt/utils/define-background';
import { BLOCKED_PATH, CHALLENGE_PATH } from '../src/config/constants';
import { matchesBlocklist } from '../src/core/blocking';
import { logger } from '../src/lib/logger';
import { dispatchRouter } from '../src/messaging/router';

const BLOCKLIST = ['reddit.com', 'youtube.com', 'twitter.com'];

const maybeUnlock = async (): Promise<number | null> => {
  const result = await chrome.storage.local.get('grasspass:unlockUntil');
  const raw = result['grasspass:unlockUntil'];
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return null;
  }

  return raw;
};

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    logger.info('Grass Pass installed');
  });

  chrome.runtime.onStartup.addListener(() => {
    logger.info('Grass Pass startup');
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void (async () => {
      const result = await dispatchRouter(message);
      sendResponse(result);
    })();

    return true;
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    logger.info('Alarm fired', alarm.name);
  });

  chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    const { frameId, url } = details;

    if (frameId !== 0) {
      return;
    }

    try {
      const parsed = new URL(url);
      const proto = parsed.protocol.toLowerCase();
      if (proto !== 'http:' && proto !== 'https:') {
        return;
      }

      const unlockUntil = await maybeUnlock();
      const isUnlocked = unlockUntil !== null && Date.now() < unlockUntil;
      if (isUnlocked) {
        return;
      }

      if (matchesBlocklist(parsed.hostname, BLOCKLIST)) {
        chrome.tabs.update(details.tabId, { url: `${chrome.runtime.getURL(BLOCKED_PATH)}#${encodeURIComponent(url)}` });
      }
    } catch (error) {
      logger.warn('Ignored invalid navigation', String(error));
    }
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) {
      return;
    }

    const challengeUrl = chrome.runtime.getURL(CHALLENGE_PATH);
    await chrome.tabs.update(tab.id, { url: challengeUrl });
  });
});
