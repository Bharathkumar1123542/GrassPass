import type { BackendInfo, LoadProgress, VisionBackend } from '../config/types';

export class FakeVisionBackend implements VisionBackend {
  readonly id = 'fake' as const;

  async init(onProgress: (progress: LoadProgress) => void, _signal: AbortSignal): Promise<BackendInfo> {
    onProgress({ phase: 'init', progress: 0.1, message: 'Initializing fake vision backend' });
    onProgress({ phase: 'ready', progress: 1, message: 'Fake backend ready' });

    return {
      id: 'fake',
      device: 'wasm',
      model: 'fake-vision',
    };
  }

  async askYesNo(_question: string, _image: Blob | File): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    return;
  }
}
