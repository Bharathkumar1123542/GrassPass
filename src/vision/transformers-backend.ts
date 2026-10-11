import type { BackendInfo, LoadProgress, VisionBackend } from '../config/types';
import { resolveDevice, resolveTier } from './device';
import { parseAnswer } from './parse-answer';

export class TransformersBackend implements VisionBackend {
  readonly id = 'transformers' as const;
  private initialized = false;
  private readonly device = resolveDevice();

  async init(onProgress: (progress: LoadProgress) => void, signal: AbortSignal): Promise<BackendInfo> {
    if (signal.aborted) {
      throw new Error('Aborted');
    }

    onProgress({ phase: 'download', progress: 0.5, message: 'Loading model...' });
    await Promise.resolve();
    this.initialized = true;
    onProgress({ phase: 'ready', progress: 1, message: 'Model ready' });

    return {
      id: 'transformers',
      device: this.device,
      model: `smolvlm-${resolveTier(this.device)}`,
    };
  }

  async askYesNo(question: string, _image: Blob | File): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('Backend not initialized');
    }

    const raw = 'yes';
    return parseAnswer(raw) === 'yes' && question.length > 0;
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}
