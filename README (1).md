# Grass Pass: Implementation Plan

| Field | Value |
|---|---|
| Document version | 1.0.0 |
| Date | 2026-10-11 |
| Status | Ready for implementation |
| Deliverable | Chromium Manifest V3 browser extension, release `0.1.0` |
| Source brief | "Grass Pass", Uniqueness_Score 9.1 (local vision model as gatekeeper) |

---

## 1. Project Overview

### 1.1 Purpose

Grass Pass blocks a user-defined list of doomscroll sites. To unlock them, the user completes a **Challenge** (for example, "photograph three different leaves"). A vision-language model running on the user's device (in-browser via WebGPU/WASM, or via a local Ollama server) checks each photo. If every photo passes, all blocked sites unlock for 30 minutes (configurable), then re-lock automatically.

### 1.2 Terminology

These terms are used with exactly these meanings throughout the document and the codebase.

| Term | Definition |
|---|---|
| Blocklist | Normalized registrable or host domains that Grass Pass blocks. Subdomains are included. |
| Challenge | A catalog entry describing what to photograph. It consists of 1–5 Slots. |
| Slot | One required photo within a Challenge, with its own yes/no verification question. |
| Session | One user attempt at one Challenge. It is created by the service worker and expires after 15 minutes. |
| Verdict | The pass/fail result for one photo submitted to one Slot. |
| Unlock | A time window (`unlockedUntil`) during which blocking is suspended for all Blocklist domains. |
| Backend | A `VisionBackend` implementation: `transformers` (in-browser), `ollama` (loopback HTTP), or `fake` (tests). |
| Tier | A model-size preset: `fast`, `balanced`, or `accurate`. |
| Device | The compute target actually used: `webgpu`, `wasm`, or `ollama`. |

### 1.3 Scope

**In scope (v0.1.0)**
- Main-frame blocking of Blocklist domains on Chromium desktop (Chrome and Edge, MV3).
- A catalog of 8 challenges with per-photo verification.
- Photo input via webcam capture and via file upload with EXIF freshness checking.
- On-device inference using SmolVLM (default) through Transformers.js. The optional `accurate` tier uses Qwen2-VL-2B (experimental). An optional Ollama backend covers Moondream and other locally pulled vision models.
- A timed unlock with automatic re-lock, an action badge countdown, and a pre-expiry notification.
- A popup, an options page, and local stats (streak, total unlocks).
- A friction guard: changes that weaken blocking are delayed by 10 minutes.

**Out of scope (non-goals)**
- Tamper resistance. A determined user can disable the extension, use another browser or incognito, or edit storage in DevTools. The threat model is self-control, not an adversary (see §12.1).
- Firefox, Safari, and mobile browsers.
- Accounts, sync, cloud inference, or any Grass Pass-operated server.
- Schedules (time-of-day blocking), per-site timers, and sub-page blocking.
- Verifying that three leaves have different botanical shapes. v0.1.0 verifies that each photo shows a leaf and that the photos are visually distinct (§5.8).
- GPS or geolocation proof of being outside.

### 1.4 Success Criteria

"Reference laptop" means 16 GB RAM, an integrated GPU with WebGPU support, and Chrome stable.

| ID | Criterion | Measurement | Target |
|---|---|---|---|
| SC-1 | Blocking correctness | E2E matrix of 12 URLs (apex, subdomain, deep path, query string, `www`, lookalike negatives such as `box.com` vs `x.com`) | 100% correct |
| SC-2 | Re-lock accuracy | E2E with `unlockDurationSeconds` test override | Open tabs on blocked domains redirected ≤ 5 s after `unlockedUntil` |
| SC-3 | Verification quality (default tier) | 60-image labeled fixture set (30 positive, 30 negative) | Recall ≥ 85%, false-positive rate ≤ 10% |
| SC-4 | Latency | Time from photo capture to verdict, p95 | ≤ 6 s on WebGPU (reference laptop); ≤ 25 s on WASM with `fast` tier |
| SC-5 | Privacy | Playwright network log during a full pass | Zero requests carrying image data; only model-weight requests to `huggingface.co` on first run |
| SC-6 | Demo loop | Stopwatch, model cached, 1-slot challenge | Blocked page to unlocked site ≤ 90 s |
| SC-7 | Onboarding | Fresh install to first unlock | ≤ 5 min excluding model download |

### 1.5 Primary User Flow

1. The user navigates to a Blocklist domain while locked. The service worker redirects the tab to `blocked.html`.
2. The user clicks **Go touch grass**. The same tab navigates to `challenge.html`, which starts a Session and shows the Challenge.
3. The user captures or uploads one photo per Slot. Each photo is verified immediately and shown as ✅ or ❌.
4. When all Slots pass, the service worker grants the Unlock. The challenge page redirects to the original URL.
5. 2 minutes before expiry, a notification appears. At expiry, open tabs on Blocklist domains return to `blocked.html`.

---

## 2. System Architecture

### 2.1 Components

| Component | Runtime | Responsibility |
|---|---|---|
| Service Worker (`entrypoints/background.ts`) | MV3 service worker | Authoritative state: navigation guard, unlock, sessions, alarms, rate limiting, settings, history. |
| Blocked Page (`entrypoints/blocked/`) | Extension tab | Interstitial shown instead of the blocked site. Starts the challenge flow. |
| Challenge Page (`entrypoints/challenge/`) | Extension tab | Capture/upload UI, per-photo verification orchestration, and the `VisionBackend` host. |
| Vision Worker (`src/vision/vision.worker.ts`) | Dedicated Web Worker (owned by the Challenge Page) | Loads the model and runs yes/no inference. It keeps heavy inference off the UI thread. |
| Popup (`entrypoints/popup/`) | Extension popup | Lock status, countdown, and a "Go outside" shortcut. |
| Options Page (`entrypoints/options/`) | Extension tab | Blocklist, duration, model tier, backend, capture mode, stats, and pending changes. |
| Storage | `chrome.storage.local` and `chrome.storage.session` | Settings, unlock, history, rate limit, and the active session. |

### 2.2 Component Diagram

```mermaid
flowchart LR
  subgraph Browser["Chromium (user device)"]
    WN["chrome.webNavigation<br/>onBeforeNavigate"]
    SW["Service Worker<br/>background.ts"]
    ST[("chrome.storage<br/>local + session")]
    AL["chrome.alarms"]
    BP["Blocked Page"]
    CP["Challenge Page"]
    VW["Vision Worker<br/>(Transformers.js)"]
    PU["Popup"]
    OP["Options Page"]
  end
  HF[("huggingface.co<br/>model weights, first run only")]
  OL[("Ollama<br/>127.0.0.1:11434, optional")]

  WN -->|"main-frame URL"| SW
  SW -->|"tabs.update to blocked.html"| BP
  BP -->|"navigate"| CP
  CP -->|"runtime messages"| SW
  CP -->|"postMessage: Blob + question"| VW
  VW -->|"yes/no answer"| CP
  VW -.->|"download once, then Cache API"| HF
  CP -.->|"HTTP, when backend = ollama"| OL
  SW <--> ST
  SW <--> AL
  PU --> SW
  OP --> SW
  AL -->|"relock / preexpiry / tick"| SW
```

### 2.3 Unlock Sequence

```mermaid
sequenceDiagram
  actor U as User
  participant T as Tab
  participant SW as Service Worker
  participant B as Blocked Page
  participant C as Challenge Page
  participant W as Vision Worker

  U->>T: navigate to reddit.com
  T->>SW: webNavigation.onBeforeNavigate
  SW->>SW: blocklist match and not unlocked
  SW->>T: tabs.update(blocked.html#originalUrl)
  U->>B: click "Go touch grass"
  B->>C: location = challenge.html#return=originalUrl
  C->>SW: session.start
  SW-->>C: Session {challenge, slots}
  C->>W: init (model load, concurrent with capture)
  U->>C: capture photo for slot N
  C->>C: normalize image, dHash
  C->>W: verify(screen question)
  W-->>C: "no"
  C->>W: verify(subject question)
  W-->>C: "yes"
  C->>SW: session.slotVerdict(passed, hash)
  Note over C,SW: repeat for every slot
  C->>SW: session.complete
  SW->>SW: check all slots passed and hashes distinct
  SW->>SW: write unlock, create alarms, update badge
  SW-->>C: UnlockState
  C->>T: location.replace(originalUrl)
```

### 2.4 Session State Machine

| State | Entered when | Allowed transitions |
|---|---|---|
| `active` | `session.start` succeeds | `passed`, `abandoned`, `expired`, `active` (reroll) |
| `passed` | `session.complete` succeeds | none (terminal) |
| `abandoned` | `session.abandon` received | none (terminal) |
| `expired` | `grasspass:session-expire` alarm fires, or a message arrives after `expiresAt` | none (terminal) |

Unlock is not a Session state. It is derived: `isUnlocked(unlock, now) = unlock != null && unlock.grantedAt <= now && now < unlock.unlockedUntil`.

### 2.5 Architectural Decisions

| ID | Decision | Rationale |
|---|---|---|
| AD-1 | Block via `webNavigation.onBeforeNavigate` plus `tabs.update`, not `declarativeNetRequest` redirects. | DNR redirects require host permissions on the request URL and the initiator, which means `<all_urls>`. The chosen approach needs zero host permissions. The cost is a brief flash of navigation start before the redirect. |
| AD-2 | Run inference in a Web Worker owned by the Challenge Page, not in the service worker. | Service workers are terminated after idle periods and would drop the model mid-use. The Challenge Page is alive for exactly as long as inference is needed. |
| AD-3 | Unlock is time-based state (`unlockedUntil`), not added or removed rules. | Nothing can desynchronize after a service-worker restart or a missed alarm. Alarms only drive side effects (sweep, notification, badge). |
| AD-4 | Verify each photo independently with yes/no questions. | Small VLMs are unreliable at counting and multi-image reasoning. Yes/no on a single image is their most reliable mode. |
| AD-5 | Fail closed. | If the model cannot load or run, the sites stay blocked. The blocklist holds distraction sites, so staying blocked never causes a critical outage. |
| AD-6 | Images are never persisted. | Only a 64-bit perceptual hash and the verdict are stored. This supports the on-device privacy promise. |

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.x, `strict: true` | Shared types across SW, pages, and worker prevent protocol drift. |
| Extension framework | WXT (`wxt`), MV3 target `chrome` | Maintained, file-based entrypoints, HMR, and built-in `fakeBrowser` test utilities. |
| UI | React 18 and plain CSS modules | Familiar and well supported by Copilot. The UI is five small pages, so no state library is needed. |
| Inference runtime | `@huggingface/transformers` v3 line (pinned with `--save-exact`) | Runs SmolVLM and Qwen2-VL ONNX models on WebGPU or WASM inside the browser. SmolVLM-256M and -500M have official WebGPU demos. |
| Default model | `HuggingFaceTB/SmolVLM-500M-Instruct` (`balanced`) | Best accuracy-to-size trade-off for yes/no photo questions. The repo ships ONNX checkpoints. |
| Fast model | `HuggingFaceTB/SmolVLM-256M-Instruct` (`fast`) | Used on WASM-only devices and low-memory machines. |
| Accurate model | `onnx-community/Qwen2-VL-2B-Instruct` (`accurate`, experimental, WebGPU only) | Satisfies the "Qwen2-VL" requirement. It is behind an experimental flag until Phase 0 validates it. |
| Optional backend | Ollama (`/api/chat`) | The only validated path for Moondream and other models that have no browser ONNX build. |
| Validation | `zod` | Runtime validation at every trust boundary (storage reads, messages, catalog). |
| EXIF | `exifr` | Small, browser-native EXIF parsing for upload freshness. |
| Tests | Vitest, WXT `fakeBrowser`, Playwright (Chromium with `--load-extension`) | Unit and integration speed; real-browser E2E. |
| Package manager | `pnpm` | Lockfile determinism. |
| Lint and format | ESLint and Prettier | Enforces naming and bans `revision: 'main'` in release builds (§9.4). |

---

## 4. Directory & File Structure

```
grass-pass/
├─ wxt.config.ts                  # manifest, CSP, build hooks (copies ONNX runtime wasm)
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ playwright.config.ts
├─ .env.example                   # build flags only; no secrets
├─ README.md                      # install, demo script, privacy statement
├─ implementation.md              # this document
├─ docs/
│  └─ model-benchmarks.md         # Phase 0 output: sizes, latency, thresholds, pinned SHAs
├─ public/
│  ├─ icon/                       # 16/32/48/128 px
│  ├─ ort/                        # onnxruntime-web .wasm/.mjs files (copied by script)
│  └─ selftest/                   # 2 tiny bundled images: leaf-positive.jpg, blank-negative.jpg
├─ entrypoints/
│  ├─ background.ts               # registers listeners at top level (synchronously)
│  ├─ popup/        index.html, main.tsx, App.tsx
│  ├─ options/      index.html, main.tsx, App.tsx
│  ├─ blocked/      index.html, main.tsx, App.tsx
│  └─ challenge/    index.html, main.tsx, App.tsx
├─ src/
│  ├─ config/
│  │  └─ constants.ts             # every numeric constant in §9.2
│  ├─ core/
│  │  ├─ domain.ts                # normalizeDomain, matchesBlocklist
│  │  ├─ navigation-guard.ts      # onBeforeNavigate handler
│  │  ├─ unlock-manager.ts        # isUnlocked, grantUnlock, expireUnlock, alarms, badge
│  │  ├─ relock-sweeper.ts        # redirect open tabs at expiry
│  │  ├─ session-manager.ts       # start, reroll, recordVerdict, complete, abandon
│  │  ├─ rate-limiter.ts          # failure window and lockout
│  │  ├─ friction-guard.ts        # pending weakening changes
│  │  └─ stats.ts                 # history append, streak calculation
│  ├─ vision/
│  │  ├─ backend.ts               # VisionBackend interface and shared types
│  │  ├─ transformers-backend.ts  # main-thread proxy to the worker
│  │  ├─ vision.worker.ts         # Transformers.js model host
│  │  ├─ ollama-backend.ts        # HTTP backend
│  │  ├─ fake-backend.ts          # deterministic backend for tests
│  │  ├─ model-registry.ts        # tier to modelId, revision SHA, dtype, device rules
│  │  ├─ device.ts                # WebGPU detection and tier downgrade
│  │  ├─ prompt.ts                # prompt templates
│  │  ├─ parse-answer.ts          # raw text to yes | no | unparseable
│  │  └─ self-test.ts             # bundled-image smoke test
│  ├─ challenges/
│  │  ├─ catalog.ts               # the 8 challenges (§6.6)
│  │  ├─ selector.ts              # random pick excluding recent
│  │  ├─ verify-slot.ts           # per-photo pipeline
│  │  └─ dhash.ts                 # 64-bit difference hash and Hamming distance
│  ├─ capture/
│  │  ├─ webcam.ts                # getUserMedia and frame grab
│  │  ├─ upload.ts                # file validation
│  │  ├─ exif.ts                  # freshness check
│  │  └─ image-utils.ts           # normalizeImage, toJpegBlob
│  ├─ storage/
│  │  ├─ schema.ts                # zod schemas and TS types (§6)
│  │  ├─ store.ts                 # typed get/set with validation and in-memory cache
│  │  └─ migrations.ts
│  ├─ messaging/
│  │  ├─ protocol.ts              # Request, Response, ErrorCode types
│  │  ├─ client.ts                # send<T>() used by pages
│  │  └─ router.ts                # SW-side dispatcher with sender validation
│  ├─ ui/                         # shared components: PhotoSlot, CountdownRing, Badge
│  └─ lib/                        # time.ts, logger.ts, result.ts
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/                        # Playwright specs and local fixture server
│  └─ fixtures/                   # images/ (60 labeled), y4m/ (fake webcam), exif/
└─ scripts/
   ├─ copy-ort.ts                 # copies onnxruntime-web wasm into public/ort
   └─ bench-model.ts              # runs the fixture eval and writes docs/model-benchmarks.md
```

---

## 5. Core Modules

### 5.1 `core/domain.ts`

- **Responsibility:** Normalize user input to a hostname and match navigation hostnames against the Blocklist.
- **Inputs:** Raw user string, or a hostname plus the Blocklist.
- **Outputs:** A normalized domain or a validation error; a boolean match.
- **Interface:**
```ts
export function normalizeDomain(input: string): Result<string, 'INVALID_DOMAIN'>;
export function matchesBlocklist(hostname: string, blocklist: readonly string[]): boolean;
```
- **Rules:** `normalizeDomain` trims and lowercases the input, strips a scheme, path, port, and leading `www.`, and converts IDN to punycode via `new URL('http://' + input).hostname`. The result must contain at least one dot. `matchesBlocklist` walks the hostname's suffixes without the bare TLD: for `a.b.reddit.com` it checks `a.b.reddit.com`, `b.reddit.com`, and `reddit.com`, using a `Set` lookup. Therefore `box.com` never matches `x.com`.

### 5.2 `core/navigation-guard.ts`

- **Responsibility:** Decide whether a main-frame navigation is blocked and redirect it.
- **Inputs:** `chrome.webNavigation.onBeforeNavigate` details, settings, and unlock state.
- **Outputs:** A `chrome.tabs.update` to `blocked.html#<encodeURIComponent(originalUrl)>`, or no action.
- **Interface:**
```ts
export function registerNavigationGuard(): void; // called synchronously at SW top level
export function decide(url: string, settings: Settings, unlock: UnlockState | null, now: number): 'allow' | 'block';
```
- **Algorithm:** Ignore `frameId !== 0` and non-`http(s)` URLs. Allow if `settings.enabled === false`. Allow if the hostname does not match. Allow if `isUnlocked`. Otherwise redirect. The handler registers with no URL filter and filters in code, because MV3 requires synchronous top-level listener registration and the Blocklist is stored asynchronously. `tabs.update` errors (closed tab) are caught and logged at `debug` level.

### 5.3 `core/unlock-manager.ts`

- **Responsibility:** Own the Unlock state and its side effects.
- **Inputs:** A completed Session, settings, and the clock.
- **Outputs:** `UnlockState` in storage, alarms, badge text, and notifications.
- **Interface:**
```ts
export function isUnlocked(unlock: UnlockState | null, now: number): boolean;
export async function grantUnlock(challengeId: string): Promise<UnlockState>;
export async function expireUnlock(): Promise<void>;     // clears state, alarms, badge; runs sweeper
export async function reconcile(): Promise<void>;        // runs on onStartup, onInstalled, SW wake
```
- **Alarms:** `grasspass:relock` at `unlockedUntil`; `grasspass:preexpiry` at `unlockedUntil − 2 min` (only when `settings.notifyBeforeExpiry`); `grasspass:tick` every 1 minute while unlocked, to refresh the badge (`"28m"`, green `#2E7D32`; empty text when locked).
- **Validity guard:** An unlock is invalid, and treated as expired, if `grantedAt > now` (clock moved backwards) or `unlockedUntil − grantedAt > UNLOCK_DURATION_MAX_MIN × 60_000`.

### 5.4 `core/relock-sweeper.ts`

- **Responsibility:** At expiry, or when a domain is added to the Blocklist, move already-open tabs on Blocklist domains back to the Blocked Page.
- **Inputs:** `chrome.tabs.query({})` results and the Blocklist.
- **Outputs:** `tabs.update` calls (scroll state in those tabs is intentionally lost).
- **Interface:** `export async function sweepOpenTabs(): Promise<number>; // returns tabs redirected`

### 5.5 `core/session-manager.ts`

- **Responsibility:** Authoritative Challenge Session lifecycle.
- **Inputs:** Messages from the Challenge Page, the catalog, the rate limiter, and daily counters.
- **Outputs:** `ChallengeSession` records in `chrome.storage.session`, and history entries on completion.
- **Interface:**
```ts
export async function start(now: number): Promise<Result<ChallengeSession, 'RATE_LIMITED'>>;
export async function reroll(sessionId: string, now: number): Promise<Result<ChallengeSession, 'REROLL_NOT_ALLOWED' | 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED'>>;
export async function recordVerdict(v: SlotVerdictInput, now: number): Promise<Result<ChallengeSession, 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SLOT_NOT_FOUND' | 'SLOT_ALREADY_PASSED' | 'RATE_LIMITED'>>;
export async function complete(sessionId: string, now: number): Promise<Result<UnlockState, 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SLOTS_INCOMPLETE' | 'PHOTOS_NOT_DISTINCT'>>;
export async function abandon(sessionId: string): Promise<void>;
```
- **Rules:**
  - `start` returns the existing `active` Session if one exists and is unexpired, so concurrent tabs share one Session.
  - `start` fails with `RATE_LIMITED` during a lockout.
  - `reroll` is allowed only when no Slot has `passed` and `rerollsToday < MAX_REROLLS_PER_DAY`. The new Challenge differs from the current one and from the last 3 completed.
  - `complete` recomputes pairwise Hamming distances from the stored Slot hashes. Every pair must be ≥ `DISTINCT_HASH_MIN_DISTANCE`, otherwise it returns `PHOTOS_NOT_DISTINCT`.

### 5.6 `core/rate-limiter.ts`

- **Responsibility:** Prevent brute-forcing the model with random photos.
- **Interface:**
```ts
export async function registerFailure(now: number): Promise<{ lockedUntil: number | null }>;
export async function getLockout(now: number): Promise<{ until: number } | null>;
```
- **Rule:** Keep failure timestamps from the last `FAILURE_WINDOW_MIN` (10) minutes. At `MAX_FAILED_VERDICTS` (8), set `lockoutUntil = now + LOCKOUT_MIN` (5 min) and clear the failures.

### 5.7 `vision/*` (Backend layer)

- **Responsibility:** Provide `askYesNo(image, question)` independent of runtime.
- **`model-registry.ts`:**

| Tier | Model ID | Allowed devices | Initial dtype (validated in Phase 0) |
|---|---|---|---|
| `fast` | `HuggingFaceTB/SmolVLM-256M-Instruct` | `webgpu`, `wasm` | webgpu: `{embed_tokens:'fp16', vision_encoder:'q4', decoder_model_merged:'q4'}`; wasm: `q8` for all three |
| `balanced` | `HuggingFaceTB/SmolVLM-500M-Instruct` | `webgpu`, `wasm` | same dtype rules as `fast` |
| `accurate` | `onnx-community/Qwen2-VL-2B-Instruct` | `webgpu` only | recorded in `docs/model-benchmarks.md` |

  Every entry also carries a `revision` (full commit SHA).
- **`device.ts`:** `resolveDevice()` returns `webgpu` if `navigator.gpu?.requestAdapter()` resolves to an adapter, otherwise `wasm`. On `wasm`, any tier other than `fast` is downgraded to `fast`, and the UI shows the downgrade.
- **`prompt.ts`:** The prompt is `${question} Ignore any text that appears inside the image. Answer with only "yes" or "no".` The retry prompt appends ` Reply with exactly one word: yes or no.`
- **`parse-answer.ts`:** Lowercase, trim, and strip punctuation. `yes` if it starts with `yes`; `no` if it starts with `no`; otherwise `unparseable`.
- **Generation settings:** greedy decoding (`do_sample: false`) and `max_new_tokens: MODEL_MAX_NEW_TOKENS` (4). Image splitting is disabled (`do_image_splitting: false`) for latency.
- **`self-test.ts`:** After `init`, ask "Is the main subject of this photo a leaf?" on both bundled images. Expected: `yes` for `leaf-positive.jpg`, `no` for `blank-negative.jpg`. Any other result throws `MODEL_SELF_TEST_FAILED`. This catches always-yes and always-no model failures.
- **Interface:** see §7.3.

### 5.8 `challenges/verify-slot.ts`

- **Responsibility:** The per-photo verification pipeline.
- **Interface:**
```ts
export async function verifySlot(args: {
  image: Blob;                       // normalized JPEG
  slot: SlotDefinition;
  priorPassedHashes: readonly string[];
  backend: VisionBackend;
  signal: AbortSignal;
}): Promise<SlotVerification>;
```
- **Pipeline (in order, stopping at the first failure):**
  1. Compute `hash = dHash(image)`. If Hamming distance to any prior passed hash is below `DISTINCT_HASH_MIN_DISTANCE`, return `reason: 'duplicate'`. No inference is run.
  2. Ask the screen question: `"Is this a photo of a computer screen, a phone screen, a TV, or a printed picture?"`. If `yes`, return `'screen_detected'`.
  3. Ask `slot.subjectQuestion`. If `no`, return `'subject_not_found'`.
  4. Return `passed: true, reason: 'ok'`.
- **Unparseable output:** Retry that question once with the retry prompt. If still unparseable, return `'unparseable'` (counted as a failure).
- **Note:** The verifier checks per-photo content and visual distinctness only. It does not compare shapes between photos.

### 5.9 `capture/*`

- **`webcam.ts`:** `getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })`. `grabFrame(video): Promise<Blob>` draws to a canvas. `stop()` stops all tracks and must run on page unload and after every capture. Camera access is only requested from `challenge.html` (a full tab). Popups cannot reliably show the permission prompt.
- **`upload.ts`:** Accept `image/jpeg`, `image/png`, and `image/webp` up to `UPLOAD_MAX_BYTES` (15 MiB). HEIC/HEIF is rejected with a message to use webcam mode or export as JPEG.
- **`exif.ts`:** `checkFreshness(file, now)` requires `DateTimeOriginal` to be present and no older than `EXIF_MAX_AGE_MIN` (20) minutes and not in the future by more than 5 minutes. `OffsetTimeOriginal` is used when present; otherwise the browser's local timezone is assumed. Failure codes: `EXIF_MISSING`, `EXIF_STALE`. Webcam captures skip this check.
- **`image-utils.ts`:** `normalizeImage(src): Promise<Blob>` resizes to `IMAGE_MAX_SIDE_PX` (512) on the longest side and encodes JPEG at quality 0.9.

### 5.10 `core/stats.ts`

- **Interface:**
```ts
export async function appendHistory(entry: HistoryEntry): Promise<void>; // FIFO cap HISTORY_MAX_ENTRIES
export function computeStreakDays(history: readonly HistoryEntry[], now: number): number;
```
- **Streak rule:** Group entries by local calendar date. If today has an entry, count consecutive days backward from today. Else if yesterday has one, count backward from yesterday. Otherwise the streak is 0.

### 5.11 `core/friction-guard.ts`

- **Responsibility:** Delay changes that weaken blocking.
- **Weakening changes:** `enabled: true → false`, removing a Blocklist domain, and increasing `unlockDurationMinutes`. Strengthening changes apply immediately.
- **Interface:**
```ts
export function classifyChange(prev: Settings, patch: SettingsPatch): { immediate: SettingsPatch; delayed: PendingChange[] };
export async function applyDuePendingChanges(now: number): Promise<void>;
export async function cancelPendingChange(id: string): Promise<void>;
```
- **Rules:** A delayed change gets `applyAt = now + FRICTION_DELAY_MIN` (10 min) and an alarm `grasspass:pending-apply`. `applyDuePendingChanges` also runs on SW startup and on every `settings.get`. When `frictionGuardEnabled` is `false`, every change is immediate.

### 5.12 `messaging/router.ts`

- **Responsibility:** Dispatch runtime messages to modules after validating the sender and payload.
- **Rule:** Reject any message where `sender.id !== chrome.runtime.id` or `sender.url` does not start with `chrome.runtime.getURL('')`. Validate every payload with zod. Return `Result` envelopes only. Unknown `type` returns `INVALID_REQUEST`.

---

## 6. Data Models

### 6.1 Schemas

```ts
// src/storage/schema.ts
export type Device = 'webgpu' | 'wasm' | 'ollama';
export type Tier = 'fast' | 'balanced' | 'accurate';

export interface Settings {
  schemaVersion: 1;
  enabled: boolean;                 // default true
  blocklist: string[];              // normalized domains; default list in 6.3
  unlockDurationMinutes: number;    // integer 5..120; default 30
  modelTier: Tier;                  // default 'balanced'
  backend: 'transformers' | 'ollama'; // default 'transformers'
  ollama: { baseUrl: string; model: string }; // defaults: 'http://127.0.0.1:11434', 'moondream'
  captureMode: 'webcam' | 'upload' | 'both';  // default 'both'
  notifyBeforeExpiry: boolean;      // default true
  frictionGuardEnabled: boolean;    // default true
  pendingChanges: PendingChange[];
}

export interface PendingChange {
  id: string;                       // uuid v4
  kind: 'disable' | 'removeDomain' | 'increaseDuration';
  value: string | number | null;    // domain for removeDomain; minutes for increaseDuration; null for disable
  createdAt: number;                // epoch ms
  applyAt: number;                  // epoch ms
}

export interface UnlockState {
  grantedAt: number;                // epoch ms
  unlockedUntil: number;            // epoch ms
  challengeId: string;
}

export interface SlotDefinition {
  id: string;                       // kebab-case, unique within the challenge
  label: string;                    // shown to the user, 3..60 chars
  subjectQuestion: string;          // must end with '?'
}

export interface ChallengeDefinition {
  id: string;                       // kebab-case, unique in catalog
  title: string;                    // 3..60 chars
  instructions: string;             // 10..200 chars
  difficulty: 1 | 2 | 3;
  slots: SlotDefinition[];          // length 1..5
}

export interface SlotState {
  slotId: string;
  status: 'pending' | 'passed' | 'failed';
  attempts: number;                 // integer >= 0
  hash?: string;                    // 16 lowercase hex chars; present when status = 'passed'
  verifiedAt?: number;
}

export interface ChallengeSession {
  sessionId: string;                // uuid v4
  challengeId: string;
  issuedAt: number;
  expiresAt: number;                // issuedAt + SESSION_TTL_MIN
  status: 'active' | 'passed' | 'abandoned' | 'expired';
  slots: SlotState[];               // same order as the challenge
  rerollsUsed: number;              // within this session
}

export interface HistoryEntry {
  id: string;                       // uuid v4
  completedAt: number;
  challengeId: string;
  durationSec: number;              // issuedAt to completedAt
  unlockMinutes: number;
  modelId: string;                  // 'fake' for the fake backend
  device: Device;
  inferenceMsTotal: number;
}

export interface RateLimitState { failures: number[]; lockoutUntil: number | null; }
export interface DailyCounters { dateKey: string; rerolls: number; } // dateKey = local 'YYYY-MM-DD'
```

### 6.2 Storage Layout

| Key | Area | Type | Notes |
|---|---|---|---|
| `settings` | `local` | `Settings` | Created on `onInstalled` with defaults. |
| `unlock` | `local` | `UnlockState \| null` | |
| `history` | `local` | `HistoryEntry[]` | FIFO cap 500. |
| `rateLimit` | `local` | `RateLimitState` | |
| `daily` | `local` | `DailyCounters` | Reset when `dateKey` differs from today. |
| `recentChallenges` | `local` | `string[]` (max 3) | Challenge ids, newest first. |
| `session` | `session` | `ChallengeSession \| null` | Cleared on browser restart by design. |
| `schemaVersion` | `local` | `number` | Current value `1`. |

All reads pass through zod. If validation fails, the store logs at `warn`, resets that key to its default, and continues. Settings are never discarded wholesale because one key is invalid.

### 6.3 Defaults

Default `blocklist`: `x.com`, `twitter.com`, `reddit.com`, `instagram.com`, `tiktok.com`, `facebook.com`, `youtube.com`.

### 6.4 Relationships

- `ChallengeSession.challengeId` references `ChallengeDefinition.id` (catalog is code, not storage).
- `ChallengeSession.slots[i].slotId` references `ChallengeDefinition.slots[i].id`.
- `UnlockState.challengeId` and `HistoryEntry.challengeId` reference `ChallengeDefinition.id`. A challenge removed from a later catalog stays valid in history; the UI renders the raw id.
- `PendingChange` entries are embedded in `Settings.pendingChanges`.

### 6.5 Validation Rules

| Field | Rule |
|---|---|
| `blocklist[]` | Each entry matches `/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z0-9-]{2,}$/`, is unique, and the list has ≤ `BLOCKLIST_MAX` (100) entries. Entries equal to the extension's own id, `chrome.com`, or `chromewebstore.google.com` are rejected. |
| `unlockDurationMinutes` | Integer, 5 ≤ n ≤ 120. |
| `ollama.baseUrl` | Parses as `http:` URL whose hostname is exactly `127.0.0.1`, `localhost`, or `[::1]`; no credentials; no path other than `/`. |
| `ollama.model` | 1..100 chars, `/^[A-Za-z0-9._:/-]+$/`. |
| `SlotState.hash` | `/^[0-9a-f]{16}$/`. |
| `ChallengeSession.slots` | Length equals the challenge's slot count. |
| Timestamps | Finite integers > 0. |
| `blocked.html` fragment | After `decodeURIComponent`, must parse as an `http:` or `https:` URL whose hostname matches the Blocklist. Otherwise ignore it and show no return link. |

### 6.6 Challenge Catalog (`src/challenges/catalog.ts`)

| `id` | Title | Difficulty | Slots (`id`: subject question) |
|---|---|---|---|
| `three-leaves` | Three different leaves | 2 | `leaf-1`, `leaf-2`, `leaf-3`: "Is the main subject of this photo a leaf or leaves from a living plant?" Instruction: "Find three leaves that look different from each other." |
| `touch-grass` | Touch grass (literally) | 1 | `grass`: "Is the main subject of this photo grass growing in the ground?" |
| `open-sky` | Look up | 1 | `sky`: "Is the sky visible in this photo, taken outdoors?" |
| `tree-bark` | Bark up the right tree | 1 | `bark`: "Is the main subject of this photo the bark of a tree trunk?" |
| `flower` | Stop and smell something | 1 | `flower`: "Is the main subject of this photo a flower?" |
| `tree-and-sky` | Tree and sky | 2 | `tree`: "Is the main subject of this photo a tree with leaves?"; `sky`: "Is the sky visible in this photo, taken outdoors?" |
| `own-shadow` | Shadow selfie | 2 | `shadow`: "Does this photo show a person's shadow on the ground outdoors?" |
| `water` | Find water | 1 | `water`: "Does this photo show water outdoors, such as a puddle, pond, river, lake, or fountain?" |

`catalog.ts` validates itself against the `ChallengeDefinition` zod schema at module load. A violation throws at build and test time.

### 6.7 Migrations

`migrations.ts` exports `migrate(from: number, to: number)`. Current schema version is `1`, so v0.1.0 contains no migration steps. Each future bump adds one pure function `vN_to_vN+1(raw): raw` and a unit test with a stored fixture.

---

## 7. API / Interface Contracts

### 7.1 Runtime Messaging (pages → service worker)

```ts
// src/messaging/protocol.ts
export type ErrorCode =
  | 'INVALID_REQUEST' | 'UNAUTHORIZED_SENDER' | 'RATE_LIMITED'
  | 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SLOT_NOT_FOUND' | 'SLOT_ALREADY_PASSED'
  | 'SLOTS_INCOMPLETE' | 'PHOTOS_NOT_DISTINCT' | 'REROLL_NOT_ALLOWED'
  | 'INVALID_DOMAIN' | 'BLOCKLIST_FULL' | 'DEBUG_DISABLED' | 'INTERNAL';

export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

export type Request =
  | { type: 'state.get' }
  | { type: 'session.start' }
  | { type: 'session.reroll'; sessionId: string }
  | { type: 'session.slotVerdict'; sessionId: string; slotId: string; passed: boolean;
      hash: string; reason: VerdictReason; modelId: string; device: Device; inferenceMs: number }
  | { type: 'session.complete'; sessionId: string }
  | { type: 'session.abandon'; sessionId: string }
  | { type: 'settings.get' }
  | { type: 'settings.update'; patch: SettingsPatch }
  | { type: 'settings.cancelPending'; id: string }
  | { type: 'blocklist.add'; domain: string }
  | { type: 'blocklist.remove'; domain: string }
  | { type: 'stats.get' }
  | { type: 'debug.forceExpire' }; // test builds only (§9.3)

export type VerdictReason = 'ok' | 'duplicate' | 'screen_detected' | 'subject_not_found' | 'unparseable';

export interface StateSnapshot {
  enabled: boolean;
  unlocked: boolean;
  unlockedUntil: number | null;
  remainingMs: number;                 // 0 when locked
  activeSession: ChallengeSession | null;
  challenge: ChallengeDefinition | null; // definition of activeSession.challengeId
  lockoutUntil: number | null;
  rerollsRemaining: number;
  streakDays: number;
}
```

| Request type | Response `data` |
|---|---|
| `state.get` | `StateSnapshot` |
| `session.start`, `session.reroll` | `{ session: ChallengeSession; challenge: ChallengeDefinition }` |
| `session.slotVerdict` | `ChallengeSession` |
| `session.complete` | `UnlockState` |
| `session.abandon`, `settings.cancelPending`, `debug.forceExpire` | `null` |
| `settings.get`, `settings.update` | `Settings` |
| `blocklist.add`, `blocklist.remove` | `Settings` (blocklist may be unchanged for a delayed removal; `pendingChanges` shows it) |
| `stats.get` | `{ totalUnlocks: number; streakDays: number; history: HistoryEntry[] }` (latest 50) |

Pages learn about changes by listening to `chrome.storage.onChanged` for the keys `unlock`, `session`, and `settings`. There are no push messages.

### 7.2 Vision Worker Protocol (`postMessage`)

```ts
export type WorkerIn =
  | { id: number; kind: 'init'; modelId: string; revision: string; device: 'webgpu' | 'wasm'; dtype: Record<string, string> | string; ortBaseUrl: string }
  | { id: number; kind: 'verify'; image: Blob; question: string }
  | { id: number; kind: 'dispose' };

export type WorkerOut =
  | { kind: 'progress'; file: string; loaded: number; total: number }
  | { id: number; kind: 'ready'; loadMs: number }
  | { id: number; kind: 'answer'; raw: string; ms: number }
  | { id: number; kind: 'error'; code: 'MODEL_LOAD_FAILED' | 'DEVICE_LOST' | 'OUT_OF_MEMORY' | 'INFERENCE_FAILED'; message: string };
```

The worker processes `verify` requests strictly one at a time (FIFO queue). `ortBaseUrl` is `chrome.runtime.getURL('ort/')`.

### 7.3 `VisionBackend` Interface

```ts
// src/vision/backend.ts
export interface LoadProgress { phase: 'download' | 'compile' | 'selftest'; fraction: number; }
export interface BackendInfo { modelId: string; device: Device; loadMs: number; }
export type YesNo = { answer: 'yes' | 'no' | 'unparseable'; raw: string; ms: number };

export interface VisionBackend {
  readonly id: 'transformers' | 'ollama' | 'fake';
  init(onProgress: (p: LoadProgress) => void, signal: AbortSignal): Promise<BackendInfo>;
  askYesNo(image: Blob, question: string, signal: AbortSignal): Promise<YesNo>;
  dispose(): Promise<void>;
}
```

Implementations must be idempotent on `init` and must reject `askYesNo` before `init` resolves.

### 7.4 Ollama HTTP Contract

| Call | Request | Success response used |
|---|---|---|
| Health and model check | `GET {baseUrl}/api/tags` | `models[].name` must include `settings.ollama.model` (match on exact tag, or on name without tag when the setting has no tag). |
| Inference | `POST {baseUrl}/api/chat` with `{ model, stream: false, options: { temperature: 0, num_predict: 4 }, messages: [{ role: 'user', content: <prompt>, images: [<base64 JPEG, no data: prefix>] }] }` | `message.content` is parsed with `parse-answer.ts`. |

Failure mapping: network error or timeout returns `OLLAMA_UNREACHABLE`. HTTP 403 returns `OLLAMA_ORIGIN_DENIED` (the user must start Ollama with `OLLAMA_ORIGINS="chrome-extension://*"`). A missing model returns `OLLAMA_MODEL_MISSING`. The extension must hold the optional host permission for `baseUrl` before the first call and requests it from the options page on a user click.

### 7.5 Chrome Events, Alarms, Notifications

| Item | Name | Handler |
|---|---|---|
| Event | `runtime.onInstalled` | Write default settings, run `reconcile()`. |
| Event | `runtime.onStartup` | `reconcile()`, `applyDuePendingChanges()`. |
| Event | `runtime.onMessage` | `router.dispatch`. |
| Event | `webNavigation.onBeforeNavigate` | `navigation-guard`. |
| Event | `alarms.onAlarm` | Switch on alarm name below. |
| Alarm | `grasspass:relock` | `expireUnlock()` |
| Alarm | `grasspass:preexpiry` | Show notification id `grasspass-expiring`, title "Grass Pass ending soon", message "Your sites re-lock in 2 minutes." |
| Alarm | `grasspass:tick` (period 1 min) | Refresh badge. |
| Alarm | `grasspass:session-expire` | Mark the active Session `expired`. |
| Alarm | `grasspass:pending-apply` | `applyDuePendingChanges()` |

---

## 8. Implementation Phases

Each phase is sized for one focused, Copilot-assisted work session. The full plan totals about 10 hours.

| Phase | Name | Est. | Depends on | Deliverables | Exit criteria |
|---|---|---|---|---|---|
| 0 | Spike and scaffold | 1.0 h | none | WXT project; `copy-ort` script; a temporary spike page that loads SmolVLM-500M on WebGPU and answers yes/no on 6 images; `docs/model-benchmarks.md` | Model answers correctly on 6 images from an extension page with the §9.1 CSP; pinned revision SHAs and measured download sizes and latencies are recorded; tier decisions for `accurate` (Qwen2-VL) are recorded as enabled or disabled |
| 1 | Blocking core | 1.5 h | 0 | `storage/*`, `core/domain`, `navigation-guard`, `unlock-manager`, `relock-sweeper`, Blocked Page, `debug` grant hook | SC-1 matrix passes in a unit test and a manual run; unlock expires and sweeps tabs; badge counts down |
| 2 | Vision pipeline | 2.0 h | 0 | `vision/*` (transformers backend, worker, registry, device fallback, prompt, parser, self-test, fake backend), `dhash`, `verify-slot`, `bench-model` script | SC-3 thresholds met on the 60-image set for the default tier; self-test passes; WASM fallback runs `fast` tier |
| 3 | Challenge flow | 2.0 h | 1, 2 | Catalog, `selector`, `session-manager`, `rate-limiter`, messaging, Challenge Page (webcam, upload, EXIF), success and return flow | Full pass with the fake backend (E2E-2) and with the real model by hand; failures and lockout behave per §5.6 |
| 4 | Popup, options, stats | 1.0 h | 3 | Popup, Options Page (blocklist editor, duration, tier, capture mode, stats), `stats.ts` | All settings persist and validate; streak renders |
| 5 | Hardening | 1.5 h | 4 | `friction-guard`, Ollama backend and permission flow, full E2E suite (§11.3), permission and CSP audit, `build:offline` variant | E2E-1 to E2E-6 green; `pnpm audit` has no high or critical findings; no `debug.*` strings in the production bundle |
| 6 | Demo and packaging | 1.0 h | 5 | README (install, privacy statement, 90-second demo script), store screenshots, `pnpm zip` artifact | SC-6 and SC-7 verified by stopwatch on the reference laptop |

**Post-v0.1.0 backlog (not part of this release):** a phone-companion capture flow, shape-label comparison between leaf photos, schedules, and Firefox support.

---

## 9. Configuration & Environment

### 9.1 Manifest (`wxt.config.ts`)

```json
{
  "manifest_version": 3,
  "name": "Grass Pass",
  "version": "0.1.0",
  "minimum_chrome_version": "120",
  "permissions": ["storage", "unlimitedStorage", "alarms", "webNavigation", "tabs", "notifications"],
  "host_permissions": [],
  "optional_host_permissions": ["http://127.0.0.1:11434/*", "http://localhost:11434/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "action": { "default_popup": "popup.html" },
  "options_page": "options.html"
}
```

| Permission | Why it is required |
|---|---|
| `webNavigation` | Detect main-frame navigations to Blocklist domains. |
| `tabs` | Read tab URLs for the re-lock sweep. |
| `storage`, `unlimitedStorage` | Settings and history. `unlimitedStorage` keeps the model cache (hundreds of MB) from being evicted by the default quota. |
| `alarms` | Re-lock, notification, badge tick, session expiry. |
| `notifications` | The pre-expiry notice. |
| `wasm-unsafe-eval` (CSP) | Required by the ONNX Runtime WASM backend. |

Minimum Chrome 120 is required for WebGPU (stable since 113) and for 30-second alarm granularity.

### 9.2 Constants (`src/config/constants.ts`)

| Name | Value |
|---|---|
| `UNLOCK_DURATION_DEFAULT_MIN` / `_MIN` / `_MAX_MIN` | 30 / 5 / 120 |
| `SESSION_TTL_MIN` | 15 |
| `MAX_REROLLS_PER_DAY` | 2 |
| `MAX_FAILED_VERDICTS` / `FAILURE_WINDOW_MIN` / `LOCKOUT_MIN` | 8 / 10 / 5 |
| `PREEXPIRY_NOTICE_MIN` | 2 |
| `DISTINCT_HASH_MIN_DISTANCE` | 8 (of 64 bits; recalibrated in Phase 2 and recorded in `docs/model-benchmarks.md`) |
| `IMAGE_MAX_SIDE_PX` | 512 |
| `UPLOAD_MAX_BYTES` | 15 × 1024 × 1024 |
| `EXIF_MAX_AGE_MIN` | 20 |
| `HISTORY_MAX_ENTRIES` | 500 |
| `BLOCKLIST_MAX` | 100 |
| `FRICTION_DELAY_MIN` | 10 |
| `MODEL_MAX_NEW_TOKENS` | 4 |
| `INFERENCE_TIMEOUT_MS` | webgpu 30 000; wasm 90 000; ollama 60 000 |

### 9.3 Environment Variables (build-time only)

| Variable | Values | Default | Effect |
|---|---|---|---|
| `WXT_VISION_BACKEND_OVERRIDE` | `real`, `fake` | `real` | `fake` forces `FakeBackend`. |
| `WXT_FAKE_VISION_VERDICT` | `pass`, `fail`, `random` | `pass` | Answer policy of `FakeBackend`. |
| `WXT_TEST_MODE` | `true`, `false` | `false` | Enables `debug.forceExpire` and the `unlockDurationSeconds` override. Production builds must set `false`; the build fails if the string `debug.forceExpire` appears in the output when `false`. |
| `WXT_MODEL_LOCAL_PATH` | path or empty | empty | Offline build: weights are copied to `public/models/` and Transformers.js is set to `allowRemoteModels = false`, `localModelPath = chrome.runtime.getURL('models/')`. |
| `WXT_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `warn` | Logger threshold. |

### 9.4 Build Rules

- `scripts/copy-ort.ts` copies the ONNX Runtime WASM assets into `public/ort/` and runs before `wxt build`. The worker sets `env.backends.onnx.wasm.wasmPaths` to `ortBaseUrl`. No code or WASM is loaded from a CDN.
- A lint rule fails the build if `model-registry.ts` contains `revision: 'main'` in a release build. All revisions are commit SHAs.
- Scripts: `pnpm dev`, `pnpm build`, `pnpm build:offline`, `pnpm zip`, `pnpm test`, `pnpm test:e2e`, `pnpm bench:model`.

### 9.5 Secrets Management

There are no secrets. Grass Pass has no API keys, accounts, tokens, or backend. `.env.example` lists only the §9.3 flags. The repository must not contain `.env` files; `.gitignore` excludes them.

---

## 10. Error Handling & Edge Cases

| # | Failure mode | Detection | Mitigation |
|---|---|---|---|
| 1 | Model download fails or the machine is offline on first run | Worker `MODEL_LOAD_FAILED` | Challenge Page shows the error with **Retry** and **Switch to Ollama**. Sites stay blocked (AD-5). Resume works because Transformers.js caches completed files. |
| 2 | WebGPU unavailable | `resolveDevice()` returns `wasm` | Use `fast` tier on WASM; display "Running on CPU: slower"; SC-4 WASM target applies. |
| 3 | GPU device lost or out of memory during inference | Worker `DEVICE_LOST` or `OUT_OF_MEMORY` | Dispose the worker, re-init once on `wasm` with `fast` tier, re-run the pending verification. If that fails, show a retry screen. |
| 4 | Model always answers yes or always no | Self-test mismatch | Throw `MODEL_SELF_TEST_FAILED`; the page offers a tier switch. Verification is not allowed to start. |
| 5 | Unparseable model output | `parse-answer` returns `unparseable` | One retry with the stricter prompt; on repeat the Slot verdict is `unparseable` (counts as a failure). |
| 6 | Inference exceeds the timeout | `AbortSignal` after `INFERENCE_TIMEOUT_MS` | Abort, show "Verification timed out. Try again", and count no failure against the rate limit. |
| 7 | Camera permission denied or no camera | `getUserMedia` rejects (`NotAllowedError`, `NotFoundError`) | Hide webcam UI, show upload mode with an explanation. If `captureMode` is `webcam`, show an instruction to change it in options. |
| 8 | Upload is HEIC, over 15 MiB, or not an image | `upload.ts` validation | Inline error naming the exact rule violated. |
| 9 | Upload has no EXIF timestamp or an old one | `exif.ts` | `EXIF_MISSING` / `EXIF_STALE` message: "Use the webcam, or upload a photo taken in the last 20 minutes (some messaging apps strip timestamps)." |
| 10 | Same photo submitted for several Slots | dHash distance < threshold | Verdict `duplicate`, no inference run. |
| 11 | Photo of a screen or a printed picture | Screen question returns yes | Verdict `screen_detected`. |
| 12 | Service worker restarts mid-session | n/a | Session lives in `storage.session`; the Challenge Page re-fetches `state.get`. |
| 13 | Browser restarts mid-session | `session` key empty | Challenge Page starts a new Session. Unlock persists because it lives in `storage.local`. |
| 14 | Alarm missed (browser closed at expiry) | n/a | Blocking is time-based (AD-3), so correctness is unaffected. `reconcile()` on startup clears stale alarms and badge. |
| 15 | System clock moved backwards | `grantedAt > now` | Unlock treated as expired (§5.3 validity guard). |
| 16 | Two tabs start challenges concurrently | n/a | `start` returns the existing active Session. |
| 17 | Stale blocked tab opened after the user unlocked | Blocked Page reads `state.get` on load | If unlocked, immediately `location.replace` to the validated return URL. |
| 18 | Open tabs on blocked domains at expiry | `grasspass:relock` | `sweepOpenTabs()` redirects them (SC-2). |
| 19 | Redirect loop | n/a | Not possible: the Blocked Page is an extension URL and is never `http(s)`. |
| 20 | Lookalike domains (`box.com` vs `x.com`) | n/a | Suffix-walk matching (§5.1). |
| 21 | Blocklist add of an invalid or duplicate domain | `normalizeDomain`, zod | `INVALID_DOMAIN`; duplicates are silently ignored. |
| 22 | Ollama unreachable, origin denied, or model missing | §7.4 error mapping | Options page shows the specific remediation; Challenge Page falls back to the transformers backend only if the user selects it. |
| 23 | Storage read returns invalid data | zod failure | Reset that key to its default, log at `warn`, continue. |
| 24 | Extension updated while unlocked | n/a | Unlock persists in storage; `reconcile()` re-creates alarms on `onInstalled`. |
| 25 | Rate limit lockout during an active attempt | `RATE_LIMITED` | Challenge Page shows a countdown to `lockoutUntil` and disables capture. |

---

## 11. Testing Strategy

### 11.1 Unit (Vitest)

Coverage target: ≥ 85% line coverage for `src/core`, `src/challenges`, `src/storage`, and `src/vision/parse-answer.ts`.

| Area | Cases |
|---|---|
| `domain` | 20-row table: scheme and path stripping, `www.`, uppercase, IDN, ports, lookalikes, missing dot, TLD-only, subdomain depth |
| `isUnlocked` | before grant, inside window, at the boundary, past expiry, clock backwards, oversized duration |
| `parse-answer` | `Yes.`, `no`, `YES, it is`, empty string, `maybe`, long prose |
| `dhash` | identical images (distance 0), flipped image, unrelated images; Hamming distance on hex strings |
| `rate-limiter` | window pruning, exactly 8 failures, lockout expiry |
| `session-manager` | start idempotency, reroll rules, verdict transitions, `complete` rejecting incomplete or non-distinct Slots |
| `friction-guard` | weakening vs strengthening classification, due-change application |
| `stats` | streak with gaps, today empty and yesterday present, timezone date boundaries |
| `exif` | fresh, stale, missing, future timestamp, with and without offset |
| `catalog` | every challenge passes the zod schema; ids unique; every `subjectQuestion` ends with `?` |
| `migrations` | stored fixture upgrades cleanly |

### 11.2 Integration (Vitest with WXT `fakeBrowser`)

- Full message-driven Session: `session.start` → `slotVerdict` ×N → `session.complete` → `unlock` written and alarms created.
- `reconcile()` after a simulated SW restart with an expired unlock and with a valid unlock.
- `sweepOpenTabs` against fake tabs, including lookalike domains.
- Router rejects wrong `sender.id` and malformed payloads with `UNAUTHORIZED_SENDER` and `INVALID_REQUEST`.
- `FakeBackend` through `verifySlot`: duplicate, screen, subject, unparseable-then-retry paths.

### 11.3 End-to-End (Playwright, Chromium persistent context, extension loaded)

Setup uses a local fixture server and `--host-resolver-rules="MAP blocked-site.test 127.0.0.1"`, with `blocked-site.test` added to the Blocklist. The fake webcam uses `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=tests/fixtures/y4m/leaf.y4m`. Production-like runs use the fake backend (`WXT_VISION_BACKEND_OVERRIDE=fake`).

| ID | Scenario | Assertion |
|---|---|---|
| E2E-1 | Navigate to blocked and non-blocked URLs | SC-1 matrix: blocked ones land on `blocked.html`, the rest load |
| E2E-2 | Complete a 1-slot challenge via webcam | Site loads after completion; badge shows remaining minutes |
| E2E-3 | Fail verdicts until lockout | After 8 failures capture is disabled and a countdown shows |
| E2E-4 | Unlock then `debug.forceExpire` (test build) | Open tab redirected to `blocked.html` within 5 s |
| E2E-5 | Upload with stale EXIF | Rejected with `EXIF_STALE` message; fresh EXIF accepted |
| E2E-6 | Network audit during E2E-2 | No request body contains image data; no origin other than the fixture server and (on the real-model run) `huggingface.co` |

### 11.4 Model Evaluation (nightly and on-demand)

`pnpm bench:model` runs the real default tier over `tests/fixtures/images/` (30 positive and 30 negative images spanning all 8 challenges) and writes accuracy and latency to `docs/model-benchmarks.md`. It fails if recall < 85% or false-positive rate > 10% (SC-3). In CI the run uses the WASM device with the `fast` tier at the same thresholds; local runs use WebGPU.

---

## 12. Security Considerations

### 12.1 Threat Model

- **Protected:** The user's intent to limit their own scrolling, and the privacy of their photos.
- **Adversary:** The user in a weak moment, with low effort. The extension adds friction. It does not defend against a determined user (disabling the extension, incognito, another browser, DevTools edits, printed or shown leaf images, text in an image that tries to steer the model). These are documented non-goals (§1.3).
- **Partial mitigations present:** screen detection, EXIF freshness for uploads, dHash distinctness, the "ignore any text" prompt line, rate limiting, and the friction guard.

### 12.2 Authentication and Authorization

There are no accounts. The only trust boundary is message origin: the router accepts messages only from the extension's own pages (`sender.id === chrome.runtime.id` and `sender.url` under the extension origin). `externally_connectable` is not declared, so web pages cannot message the extension. The service worker, not the Challenge Page, decides the unlock: it requires every Slot `passed` and recomputes hash distinctness.

### 12.3 Input Validation

- zod validates every message payload, every storage read, and the catalog.
- The `blocked.html` return URL is validated per §6.5, so the page cannot be used as an open redirect.
- Uploads are validated by MIME type, size, and decodability. Images are decoded with `createImageBitmap`; a decode failure is a rejection.
- `ollama.baseUrl` is restricted to loopback addresses so images cannot be sent to a remote host.

### 12.4 Data Protection and Privacy

- Photos are held in memory only and discarded after each verdict. Object URLs are revoked on completion.
- Persisted data: settings, unlock state, history (challenge id, timings, model id, device), and 16-hex-character perceptual hashes. No image, EXIF block, location, or camera identifier is stored.
- No analytics, telemetry, or crash reporting.
- Network use: model weights from `huggingface.co` on first run (with explicit consent shown on the Challenge Page before download), and optional loopback calls to Ollama. Both are listed in the README privacy statement and the store listing.

### 12.5 Supply Chain and Code Integrity

- No remotely hosted code: ONNX Runtime WASM is bundled (§9.4). The CSP allows only `'self'` and `'wasm-unsafe-eval'`.
- Model weights are data, fetched at a pinned commit SHA over HTTPS. Weights are not executed as JavaScript.
- Dependencies are pinned with `--save-exact`; the lockfile is committed; `pnpm audit` runs before every release; Dependabot is enabled.
- The production bundle must not contain `debug.forceExpire` (§9.3).

### 12.6 Permission Minimization

No `host_permissions` and no `<all_urls>`. The only host access is optional and limited to `127.0.0.1:11434` and `localhost:11434`, requested on a user click. Each permission in §9.1 has a written justification for store review.

---

## 13. Performance & Scalability Notes

### 13.1 Bottlenecks and Optimizations

| Bottleneck | Impact | Optimization |
|---|---|---|
| First-run model download (hundreds of MB; exact sizes recorded in `docs/model-benchmarks.md`) | Long first challenge | Start the download as soon as the Challenge Page opens, concurrently with capture. Show per-file progress. Cache in the Cache API (persisted via `unlimitedStorage`). |
| Model load and compile | Seconds of delay per Challenge Page visit | Load lazily only on the Challenge Page. Keep the worker alive for the page's lifetime. Capture UI is usable while loading; verifications queue. |
| Per-photo inference | Dominant latency | Max 2 inferences per photo (screen, subject). Run the cheap checks first (dHash, then screen). `max_new_tokens = 4`, greedy decoding, image splitting off, 512 px input. |
| Memory | Out-of-memory on small machines | Auto-downgrade to `fast` on WASM; handle `OUT_OF_MEMORY` per §10 row 3; dispose the worker on page unload. |
| Service worker wakeups | Battery and responsiveness | Cache settings and unlock in memory with `storage.onChanged` invalidation. The guard decision is a `Set` lookup. |

### 13.2 Targets

| Metric | Target |
|---|---|
| Navigation guard decision | ≤ 5 ms from cache (≤ 50 ms on a cold SW wake) |
| Cached model load (WebGPU, `balanced`) | ≤ 8 s |
| Photo-to-verdict, p95 | ≤ 6 s WebGPU; ≤ 25 s WASM with `fast` |
| Peak tab memory (`balanced`, WebGPU) | ≤ 2 GB |
| Persisted extension data excluding model cache | < 1 MB |
| Re-lock sweep latency | ≤ 5 s after `unlockedUntil` |

### 13.3 Scalability

Grass Pass has no server, so scaling is local. The Blocklist is capped at 100 entries (O(1) per-navigation lookup via a `Set` and suffix walk). History is capped at 500 entries (FIFO). The catalog is code-defined; adding challenges requires only a new `catalog.ts` entry that passes schema validation. A single model instance serves one verification at a time, which matches single-user use.

---

## 14. Open Questions / Assumptions

### 14.1 Assumptions

| ID | Assumption | Consequence if wrong |
|---|---|---|
| A-1 | v0.1.0 targets Chromium desktop only (Chrome, Edge). | Firefox and mobile need separate work (WebGPU, `webNavigation` and manifest differences). |
| A-2 | The default model is SmolVLM-500M via Transformers.js v3 on WebGPU, falling back to SmolVLM-256M on WASM. | Phase 0 downgrades the default to the `fast` tier and updates §3 and §5.7. |
| A-3 | The user captures photos with the laptop webcam or uploads phone photos (AirDrop or cable transfer preserve EXIF). | If most users transfer via apps that strip EXIF, upload mode is unusable and a phone-companion flow becomes the next priority. |
| A-4 | The threat model is self-control, not adversarial (§12.1). | A stricter model would need a different architecture (managed policy, server attestation), which contradicts the on-device goal. |
| A-5 | One global Unlock covers all Blocklist domains for a fixed duration. | Per-site unlocks would change `UnlockState` to a map and the guard's lookup. |
| A-6 | English-only UI and prompts. | Localization requires translated challenge text and prompt validation per language. |
| A-7 | The build window is one day with an AI pair-programmer. | The phase estimates in §8 would need rescaling. |

### 14.2 Open Questions

| ID | Question | Resolution plan | Owner phase |
|---|---|---|---|
| Q-1 | Do the pinned SmolVLM ONNX checkpoints and the dtype maps in §5.7 run correctly under Transformers.js v3 in an extension page worker? | Phase 0 spike. If not, adjust dtypes; if that fails, use `fast` as the only in-browser tier. | 0 |
| Q-2 | Is Qwen2-VL-2B (ONNX) viable on WebGPU in terms of size, memory, and accuracy? | Phase 0 benchmark. If it fails SC-3 or exceeds 2 GB peak, the `accurate` tier ships disabled and hidden behind the experimental flag. | 0 |
| Q-3 | Is there a validated in-browser path for Moondream? | None assumed. v0.1.0 supports Moondream only through the Ollama backend. | 0, 5 |
| Q-4 | Does the camera permission persist for the extension origin across browser restarts? | Verify manually in Phase 3. If it does not persist, the Challenge Page shows a one-line explanation before the prompt. | 3 |
| Q-5 | Does model fetching from `huggingface.co` work from extension pages without `host_permissions`? | Verify in Phase 0. If blocked, add the narrowest required `https://*.huggingface.co/*` and `https://*.hf.co/*` host permissions and update §9.1 and §12.6. | 0 |
| Q-6 | What `DISTINCT_HASH_MIN_DISTANCE` avoids rejecting legitimately different leaves photographed against similar greenery? | Calibrate in Phase 2 on the fixture set; record the value in `docs/model-benchmarks.md` and `constants.ts`. | 2 |
| Q-7 | Should the offline build (weights bundled in the extension) be the store-listed variant? | Decide after Phase 5 based on the packaged size against Chrome Web Store limits; the default listing stays download-on-first-run. | 5, 6 |
| Q-8 | Does the permission set (`webNavigation`, `tabs`) pass store review with the written justifications? | Submit with the §9.1 justifications; if rejected, switch to the `declarativeNetRequest` design (AD-1 alternative) with `<all_urls>` host permission. | 6 |
