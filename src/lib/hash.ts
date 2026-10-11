export function dHashDistance(left: string, right: string): number {
  if (left.length !== right.length) {
    return Number.MAX_SAFE_INTEGER;
  }

  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }
  return distance;
}

export function computeDHashFromPixels(pixels: Uint8ClampedArray): string {
  const tiny = new Uint8Array(9);
  for (let index = 0; index < 9; index += 1) {
    tiny[index] = pixels[index] % 2;
  }

  let hash = '';
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const left = tiny[row * 3 + column];
      const right = tiny[row * 3 + column + 1];
      hash += left === right ? '0' : '1';
    }
  }

  return hash.padEnd(16, '0');
}
