import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readSettings } from '../../src/storage/settings';

const Popup = (): JSX.Element => {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const sync = async (): Promise<void> => {
      const settings = await readSettings();
      const unlockValue = typeof chrome !== 'undefined' ? await chrome.storage.local.get('unlock') : {};
      const unlock = unlockValue.unlock as { unlockedUntil?: number } | undefined;
      const now = Date.now();
      const windowEnds = unlock?.unlockedUntil ?? null;
      const nextUnlocked = !!windowEnds && now < windowEnds;
      const diff = windowEnds ? Math.max(0, Math.ceil((windowEnds - now) / 60_000)) : null;
      setIsUnlocked(nextUnlocked);
      setMinutesLeft(diff);
      if (!nextUnlocked && settings.enabled) {
        setMinutesLeft(0);
      }
    };

    void sync();
  }, []);

  return (
    <main style={{ minWidth: 220, padding: 16 }}>
      <h2>Grass Pass</h2>
      <p>{isUnlocked ? 'Unlocked' : 'Locked'}</p>
      <p>{minutesLeft !== null ? `Time remaining: ${minutesLeft} min` : 'No active unlock'}</p>
      <button type="button" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('challenge.html') })}>
        Go outside
      </button>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Popup />);
