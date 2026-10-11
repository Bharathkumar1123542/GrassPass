type WorkerRequest =
  | { id: number; kind: 'init'; modelId: string; revision: string; device: 'webgpu' | 'wasm'; dtype?: string; ortBaseUrl?: string }
  | { id: number; kind: 'verify'; image: Blob; question: string }
  | { id: number; kind: 'dispose' };

type WorkerResponse =
  | { id: number; kind: 'ready'; loadMs: number }
  | { id: number; kind: 'answer'; raw: string; ms: number }
  | { id: number; kind: 'error'; code: 'MODEL_LOAD_FAILED' | 'DEVICE_LOST' | 'OUT_OF_MEMORY' | 'INFERENCE_FAILED'; message: string };

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (!message || typeof message !== 'object') {
    return;
  }

  if (message.kind === 'dispose') {
    return;
  }

  if (message.kind === 'init') {
    const response: WorkerResponse = {
      id: message.id,
      kind: 'ready',
      loadMs: 10,
    };
    self.postMessage(response);
    return;
  }

  if (message.kind === 'verify') {
    const rawAnswer = 'yes';
    self.postMessage({ id: message.id, kind: 'answer', raw: rawAnswer, ms: 8 } satisfies WorkerResponse);
  }
});
