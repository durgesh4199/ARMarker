# Project Brief: Marker-Based WebAR Content App

You are building a mobile-first web app that uses the device camera to detect printed
image markers and overlay mixed content (3D models, video, and 2D UI) anchored to
those markers in real space. The app also has a non-AR shell with polished UI
transitions.

Read this entire brief before writing any code. At the end there is a list of
questions — ask them before starting Milestone 1.

---

## 1. Non-negotiable constraints

These are architectural decisions that have already been made. Do not substitute
alternatives without asking first.

1. **Vanilla JS/TS on the web platform.** No Flutter, no Unity WebGL, no Capacitor.
2. **Vite + React + TypeScript** for the app shell.
3. **MindAR** (`mind-ar`) for image tracking, using its **three.js** integration —
   NOT the A-Frame integration. A-Frame adds an entity-component layer we don't
   need and makes imperative control harder.
4. **The AR runtime lives outside React's render tree.** See section 4. This is the
   most important rule in this document.
5. **Content is data, not code.** Adding marker #11 must be a JSON edit plus an
   asset drop — never a code change. See section 3.
6. **2D text and UI are DOM elements, not WebGL text.** See section 5.3.
7. Everything must work on a real phone over HTTPS. Desktop-only correctness is
   not "done".

## 2. Stack

| Concern | Choice |
|---|---|
| Build | Vite |
| Language | TypeScript, `strict: true` |
| UI | React 18+ |
| 3D | three.js |
| AR tracking | `mind-ar` (three.js entry point) |
| UI animation | `motion` (the library formerly published as `framer-motion`) |
| Routing | `react-router` |
| State | Zustand (or React context — keep it minimal, do not add Redux) |
| Styling | Your choice — Tailwind or CSS Modules. Be consistent. |

**Before installing anything, check the current version of each package on npm and
pin exact versions in `package.json`** (no `^` ranges). My knowledge of version
numbers may be stale. `mind-ar` in particular has had breaking changes between
minor versions, and its three.js peer dependency range matters — verify
compatibility before locking the three.js version.

## 3. The content manifest (build this first)

A JSON manifest drives everything. Define the TypeScript types for it before
writing any rendering code, and validate manifests at load time with Zod so a
malformed entry fails loudly instead of rendering nothing.

```ts
type Vec3 = [number, number, number];

interface ContentItem {
  type: 'model' | 'video' | 'dom';
  // model
  src?: string;              // path to .glb
  animation?: string;        // named clip to autoplay on detect
  // video
  alpha?: 'none' | 'packed'; // see 5.2
  loop?: boolean;
  // dom
  component?: string;        // key into a component registry
  props?: Record<string, unknown>;
  // common
  position?: Vec3;           // metres, relative to marker centre
  rotation?: Vec3;           // radians
  scale?: number | Vec3;
  size?: [number, number];   // for video/plane, in marker-width units
}

interface TargetEntry {
  index: number;             // MUST match the image order in the .mind file
  name: string;              // human-readable, used in logs and debug UI
  content: ContentItem[];
}

interface Bundle {
  id: string;
  title: string;
  mindFile: string;          // e.g. /targets/chapter-1.mind
  targets: TargetEntry[];
}
```

**Bundling rule:** group **5–8 targets per `.mind` file**, never all of them in one.
MindAR's detection cost and memory footprint scale with target count, and a single
large bundle will degrade tracking on mid-range Android devices. The user picks a
bundle in the app shell before the camera starts.

The mapping from `index` to image is positional and fragile. Keep the source images
in `targets/<bundle-id>/` named `00-cover.png`, `01-page-3.png`, … so the ordering is
self-documenting, and write a short note in the repo README about regenerating
`.mind` files with MindAR's target compiler when images change.

## 4. AR-outside-React architecture

This is where naive implementations break. If React reconciles the AR scene, you get
camera restarts, tracking resets, and leaked WebGL contexts on every state change.

**Required structure:**

- One `ARStage` class (plain TypeScript, no React) that owns: the MindAR instance,
  the three.js renderer/scene/camera, the anchor groups, the render loop, and all
  loaded assets. It exposes an imperative API:
  `start(bundle)`, `stop()`, `on('targetFound' | 'targetLost', cb)`, `dispose()`.
- One React component `<ARView>` that renders a single `<div ref>` container and
  nothing else. It instantiates `ARStage` in an effect with an **empty dependency
  array**, and calls `dispose()` on unmount. It must never re-instantiate on prop or
  state change — pass new data through imperative method calls on the ref instead.
- React UI overlays sit in a sibling fixed-position layer above the canvas, with
  `pointer-events: none` on the container and `pointer-events: auto` only on
  actual interactive controls.

Under React 18 StrictMode in development, effects run twice. Your `dispose()` must be
genuinely idempotent — stop the camera track, cancel the animation frame, dispose
geometries/materials/textures, and call `renderer.dispose()`. If you see the camera
permission prompt twice or a black feed in dev, this is why. Do not "fix" it by
disabling StrictMode.

## 5. The three content renderers

Write one small renderer per content type. Each takes a `ContentItem` and an anchor
`THREE.Group`, and returns a handle with `show()`, `hide()`, and `dispose()`.

### 5.1 Model
GLTFLoader with DRACO and KTX2 support configured. Keep each GLB under ~2 MB.
Play the named animation clip on `targetFound`, pause on `targetLost`.

### 5.2 Video — read this carefully, it is the main time sink

- Create all `<video>` elements for a bundle **up front**, at bundle load, not on
  detection. Set `muted`, `playsinline`, `preload="auto"`, and `crossorigin`.
  Missing `playsinline` causes silent failure on iOS.
- **Autoplay unlock:** on the single user gesture that starts the AR session (the
  "Start" button tap), call `.play()` then immediately `.pause()` on every video
  element in the bundle. This unlocks them all so they can later start on marker
  detection without another tap. Without this, video will work on Android and fail
  on iOS.
- Wrap each in `THREE.VideoTexture`. Set `colorSpace = THREE.SRGBColorSpace`.
- **Transparent video:** there is no cross-browser alpha video codec. Use
  alpha-packed source video — RGB in the left half of the frame, the alpha mask in
  the right half — and recombine in a custom `ShaderMaterial`. Sketch:

  ```glsl
  // fragment shader
  uniform sampler2D map;
  varying vec2 vUv;
  void main() {
    vec2 uvRGB   = vec2(vUv.x * 0.5,        vUv.y);
    vec2 uvAlpha = vec2(vUv.x * 0.5 + 0.5,  vUv.y);
    vec3 rgb = texture2D(map, uvRGB).rgb;
    float a  = texture2D(map, uvAlpha).r;
    gl_FragColor = vec4(rgb, a);
  }
  ```
  Set `transparent: true` on the material. Handle the `alpha: 'none'` case with a
  plain `MeshBasicMaterial` so non-transparent videos don't pay for the shader.
- Pause on `targetLost` and resume on `targetFound`. Leaving videos playing
  off-screen wastes battery and decoder slots — mobile browsers allow only a
  handful of simultaneous video decodes.

### 5.3 DOM overlay
Do **not** render text as a WebGL plane. Instead:
- Each frame, take the anchor's world position, project it through the camera with
  `vector.project(camera)`, convert to screen pixels, and write the result to a
  React-rendered absolutely-positioned element via a ref (direct style mutation —
  do not `setState` per frame).
- Hide the element when the anchor is behind the camera (`vector.z > 1`) or the
  target is lost.
- A registry object maps `component` strings in the manifest to actual React
  components, so the manifest never contains JSX.

## 6. Loading strategy

- Load a bundle's `.mind` file and its manifest on bundle selection.
- Load per-target heavy assets (GLB, video) **lazily on first `targetFound`**, then
  cache. Eager-loading 10+ markers of mixed media is a 50 MB+ download.
- While a target's assets stream in, show a small anchored spinner. **Tracking must
  stay live during loading** — never block the render loop on a fetch, or the marker
  will feel dead.
- Show real progress on the initial bundle load. The gap between "tap start" and
  "camera live" is several seconds on mobile data; that is where your transition
  animations earn their place.

## 7. UI shell and transitions

Routes: Home → Bundle picker → AR view, plus a Help/How-to-scan screen.

- Use `motion` for enter/exit and layout animations; use the View Transitions API
  for route-level morphs where supported, with a graceful fallback.
- Respect `prefers-reduced-motion` — provide reduced variants, do not just disable.
- Animate `transform` and `opacity` only. Anything that triggers layout will drop
  frames while the CV engine is running.
- Include a **"How to scan"** screen with a marker-framing illustration. Users do not
  intuitively know to fill the frame with the marker, and this single screen removes
  most support questions.

## 8. Dev environment (set this up in Milestone 0)

- HTTPS is mandatory for `getUserMedia`. Configure `vite --host` with a local
  certificate (e.g. `vite-plugin-mkcert`), and document a tunnel fallback
  (ngrok or `cloudflared`) for testing on a physical device.
- Document remote debugging in the README: Safari Web Inspector for iOS, and
  `chrome://inspect` for Android. Device-only bugs are the norm in this project,
  and debugging a black screen without a console is guesswork.
- Add a debug overlay toggled by a query param (`?debug=1`) showing FPS, current
  detected target index and name, and asset load state. Build this early; it pays
  for itself many times over.

## 9. Build order

Do not skip ahead. Each milestone must run on a physical phone before the next
one starts.

- **M0 — Harness.** Vite + React + TS scaffold, HTTPS dev server, debug overlay,
  README with device-testing instructions.
- **M1 — Tracking spike.** One hardcoded marker, one cube. Prove camera + detection
  + correct anchor pose on a real phone. No manifest yet, no UI polish.
- **M2 — Manifest and stage.** Introduce the `ARStage` class, the manifest schema,
  Zod validation, and the model renderer. Multiple targets in one bundle.
- **M3 — Video renderer.** Including the iOS autoplay unlock and the alpha-packed
  shader path.
- **M4 — DOM overlay renderer.** Screen-space projection and the component registry.
- **M5 — App shell.** Routing, bundle picker, how-to-scan screen, transitions,
  loading states.
- **M6 — Hardening.** Lazy loading, dispose correctness, permission-denied and
  unsupported-browser fallback screens, performance pass on a mid-range Android.

## 10. Explicit non-goals and guardrails

- Do not add a backend, database, or CMS unless asked. Manifests are static files.
- Do not add analytics, error-reporting SaaS, or any third-party script.
- Do not use A-Frame.
- Do not use `dangerouslySetInnerHTML` anywhere, including for manifest content.
- Do not commit generated `.mind` files without also committing the source images.
- Do not silently swallow camera or asset-loading errors — surface them in the UI.
- If tracking robustness turns out to be the blocker rather than anything in this
  brief, say so rather than adding complexity. The fallback plan is the open-source
  8th Wall engine, which is a separate decision to make deliberately.

## 11. Ask me these before starting

1. Do any videos actually need transparency? If none do, skip the alpha shader
   entirely in M3.
2. Roughly how many bundles, and are markers grouped by a natural unit (chapters,
   product categories, rooms)?
3. Are the marker images already designed, or still to be produced? If still to be
   produced, I need the trackability constraints before layout is finalised:
   high-contrast, feature-dense, asymmetric, non-repeating patterns.
4. Minimum target devices — specifically, how old an Android are we supporting?
   This sets the performance budget.
5. Will this be printed material, on-screen markers, or both? On-screen markers
   introduce glare and refresh-rate artefacts that change the tuning.
6. Is offline / PWA support needed after first load?

---

## Answers (confirmed before M0)

1. No video needs transparency — the alpha-packed shader path is skipped in M3.
2. A few bundles, grouped by chapter/category, ~5-8 markers each (per the
   bundling rule in section 3).
3. Marker images are not designed yet — M1/M2 use MindAR's
   generated/sample high-contrast targets as placeholders until real art
   exists.
4. Minimum target device: recent flagship/mid-range Android (last ~2-3
   years) — a looser performance budget than the brief's worst case.
5. Printed material only — no on-screen glare/refresh-rate tuning needed.
6. No offline/PWA support — online-only, no service worker.
