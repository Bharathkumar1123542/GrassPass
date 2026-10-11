import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { readStats } from '../../src/core/stats';
import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../../src/storage/settings';

const Options = (): JSX.Element => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<ReturnType<typeof readStats>>(() => readStats([]));

  useEffect(() => {
    const sync = async (): Promise<void> => {
      const nextSettings = await readSettings();
      setSettings(nextSettings);
      const historyValue = typeof chrome !== 'undefined' ? (await chrome.storage.local.get('history')).history : undefined;
      const history = Array.isArray(historyValue) ? historyValue : [];
      setStats(readStats(history as Parameters<typeof readStats>[0]));
    };

    void sync();
  }, []);

  const onSave = async (): Promise<void> => {
    await writeSettings(settings);
  };

  return (
    <main style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Grass Pass Options</h1>
      <div style={{ display: 'grid', gap: 16 }}>
        <label>
          Blocklist (one domain per line)
          <textarea
            value={settings.blocklist.join('\n')}
            onChange={(event) => setSettings({ ...settings, blocklist: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) })}
            rows={8}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Unlock duration (minutes)
          <input
            type="number"
            min={5}
            max={120}
            value={settings.unlockDurationMinutes}
            onChange={(event) => setSettings({ ...settings, unlockDurationMinutes: Number(event.target.value) })}
          />
        </label>
        <label>
          Model tier
          <select value={settings.modelTier} onChange={(event) => setSettings({ ...settings, modelTier: event.target.value as typeof settings.modelTier })}>
            <option value="fast">Fast</option>
            <option value="balanced">Balanced</option>
            <option value="accurate">Accurate</option>
          </select>
        </label>
        <label>
          Capture mode
          <select value={settings.captureMode} onChange={(event) => setSettings({ ...settings, captureMode: event.target.value as typeof settings.captureMode })}>
            <option value="webcam">Webcam</option>
            <option value="upload">Upload</option>
            <option value="both">Both</option>
          </select>
        </label>
        <button type="button" onClick={onSave}>Save</button>
      </div>

      <section style={{ marginTop: 24 }}>
        <h2>Stats</h2>
        <p>Total unlocks: {stats.totalUnlocks}</p>
        <p>Streak days: {stats.streakDays}</p>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<Options />);
