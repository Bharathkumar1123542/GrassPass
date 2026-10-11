# Model benchmarks

This project intentionally keeps model benchmarking conservative and local-first. The current scaffold is designed for a deterministic test and demo workflow, with the real viewport-vision stack remaining behind the local backend interfaces.

## Target expectations

- Default tier: `fast` on WebGPU when available; fallback to `wasm`
- Accuracy target: review against the 60-image fixture set before release
- P95 inference target: <= 6s on WebGPU; <= 25s on WASM with the `fast` tier
- Full verification target: keep model output local and avoid remote image uploads

## Revision policy

- All production model revisions should be pinned to commit SHAs in the registry and never left at `main`.
- Offline bundles should keep model assets under the extension package and should not require a live Hugging Face fetch during normal use.

## Current status

- Model benchmark capture is pending the full local model integration and validation pass.
- The extension supports a fake backend for CI and demo work, which is the recommended path for package validation until the on-device model is benchmarked on the target laptop.
