import { resolveDevice, resolveTier } from '../src/vision/device';

const device = resolveDevice();
const tier = resolveTier(device);

console.log(JSON.stringify({ device, tier, note: 'bench stub for Phase 2' }, null, 2));
