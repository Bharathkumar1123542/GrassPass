import type { Device, Tier } from '../config/types';

type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter?: () => Promise<unknown>;
  };
};

export function resolveDevice(): Device {
  const gpu = typeof navigator !== 'undefined' ? (navigator as NavigatorWithGpu).gpu : undefined;
  if (gpu && typeof gpu.requestAdapter === 'function') {
    return 'webgpu';
  }

  return 'wasm';
}

export function resolveTier(device: Device): Tier {
  if (device === 'wasm') {
    return 'fast';
  }

  if (device === 'ollama') {
    return 'balanced';
  }

  return 'balanced';
}
