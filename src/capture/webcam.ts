export async function openWebcam(constraints?: MediaStreamConstraints): Promise<MediaStream> {
  const baseVideoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  const nextVideoConstraints: MediaTrackConstraints =
    constraints && typeof constraints.video === 'object' && constraints.video !== null
      ? { ...baseVideoConstraints, ...(constraints.video as MediaTrackConstraints) }
      : baseVideoConstraints;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: nextVideoConstraints,
    audio: false,
  });

  return stream;
}

export async function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('2D canvas unavailable');
  }

  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Unable to capture frame'));
        return;
      }

      resolve(result);
    }, 'image/jpeg', 0.9);
  });

  return blob;
}

export function stopWebcam(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
