# ARMarker

Mobile-first WebAR app: the device camera detects printed image markers and
overlays 3D models, video, and DOM UI anchored to those markers. Built with
Vite + React + TypeScript, three.js, and MindAR's three.js image-tracking
integration (not the A-Frame one).

Status: **Milestone 5 — app shell (routing, bundle picker, how-to-scan,
transitions), not yet verified on a physical phone.** M0-M4 (harness,
tracking spike, manifest + model/video/DOM renderers, plus tap-to-
interact added ahead of schedule) are phone-confirmed. Along the way,
device-only bugs surfaced and got fixed: tap-to-interact was silently
swallowed by an unrelated MindAR overlay layer, and models rendered pure
black with a non-advancing animation until the scene got actual lights
and the placeholder's animation clip got real intermediate keyframes —
see the "Tap-to-interact" and model/lighting notes further down for what
actually broke and why. See `CLAUDE.md` (project brief) for the full
build order.

## Stack and pinned versions

Every dependency is pinned to an exact version (no `^`/`~` ranges) in
`package.json`. Two are pinned for a specific reason, not just "latest at
scaffold time":

- **`three` is pinned to `0.161.0`, not latest.** `mind-ar@1.2.5`'s three.js
  bundle (`mind-ar/dist/mindar-image-three.prod.js`) imports `sRGBEncoding`
  from `three` and sets `renderer.outputEncoding`. Three.js removed that
  deprecated encoding API in `three@0.162.0` (Feb 2024) — one month after
  mind-ar 1.2.5 shipped. Any `three` version `>=0.162.0` throws an import
  error on load and mind-ar's three integration doesn't run at all. This was
  verified directly (installing successive `three` versions against
  `mind-ar@1.2.5` and checking for the export). `0.161.0` is the newest
  version where mind-ar's three.js path still works. Do not bump `three`
  without re-verifying against whatever `mind-ar` version is current at the
  time — mind-ar's peer range (`>=0.136.0`) does not reflect this ceiling.
- **`mind-ar` is pinned to `1.2.5`**, the latest published release (last
  updated Jan 2024). There is no newer version to track.

`mind-ar` also depends on `canvas` (`node-canvas`), which needs native
build tools at `npm install` time (Cairo/Pango headers) unless a prebuilt
binary matches your platform. On Debian/Ubuntu:

```sh
sudo apt-get install -y libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev pkg-config build-essential
```

`npm audit` will report vulnerabilities in `tar`/`@mapbox/node-pre-gyp`,
pulled in transitively through `canvas`'s native-build tooling. These are
build-time/install-time issues in `canvas`'s own toolchain, not in code that
ships to the browser bundle — `npm audit fix --force` would downgrade
`mind-ar` to `1.1.5` to "fix" this, which is a worse trade. Known accepted
risk until mind-ar publishes an update.

## Dev setup

```sh
npm install
npm run dev -- --host
```

The dev server uses [`vite-plugin-mkcert`](https://github.com/liuweiGL/vite-plugin-mkcert)
for local HTTPS, which `getUserMedia` (camera access) requires on anything
other than `localhost`. On first run it downloads the `mkcert` binary — this
needs outbound internet access once; after that it's cached. Vite will print
a `https://<your-lan-ip>:5173` URL — use that on your phone.

### Testing on a physical phone

1. Make sure your phone and dev machine are on the same network, then open
   the printed `https://<lan-ip>:5173` URL on the phone. You'll need to
   accept the self-signed cert (mkcert's local CA isn't installed on the
   phone, only on the dev machine).
2. If the phone can't reach your machine directly (different networks,
   restrictive Wi-Fi, corporate VPN), tunnel instead:
   - `npx cloudflared tunnel --url https://localhost:5173`, or
   - `ngrok http https://localhost:5173`

   Either gives you a public HTTPS URL that proxies to your local dev
   server — open that on the phone instead.

### Remote debugging a device-only bug

Camera/AR bugs are frequently device-only (they won't repro in desktop
Chrome). To get a console on the device:

- **iOS**: Settings → Safari → Advanced → Web Inspector (on the phone), then
  Safari → Develop → `<your device>` (on a Mac) to get a full console
  attached to the mobile Safari tab.
- **Android**: enable USB debugging in Developer Options, plug in over USB,
  then open `chrome://inspect` on desktop Chrome and inspect the tab.

### Debug overlay

Append `?debug=1` to the URL to show a fixed-position overlay (top-left)
with live FPS, the currently detected target index/name, and asset load
state. It reads from a small Zustand store (`src/debug/debugStore.ts`);
`ARStage`'s `targetFound`/`targetLost` events (now carrying the matched
`TargetEntry`) feed the target fields.

### AR HUD (scanning / found / tracking / lost)

`src/ar/ArHud.tsx` is a real React overlay — MindAR's own built-in
scanning/loading UI is fully disabled (`uiScanning: 'no'` in
`ARStage.start()`) in favor of it, since a static template can't do the
color-coded states below. It subscribes directly to an `ARStage`
instance (handed to it via `ARView`'s `onStage` callback — see "M5 app
shell" further down for why that replaced individual
`onTargetFound`/`onTargetLost`/... props) and renders one of:

- **initializing** — full-screen, shown until `ARStage` emits `ready`
  (camera live, render loop started).
- **scanning** — a dim corner-bracket frame + "Point your camera at a
  marker", shown once ready with nothing found.
- **found-loading** — the frame turns accent-green with "MARKER FOUND",
  plus a loading percentage once a target is found but its content
  (currently just the model renderer) hasn't finished loading yet. Content
  loads once, eagerly, at bundle start and stays loaded — this is
  independent of found/lost and never re-fires for the same target, so
  with the current placeholder assets (tiny, fast to load) this state
  will often be too brief to actually see; it's there for when real,
  larger assets replace them.
- **tracking** — a small "TRACKING · STABLE" pill once that target's
  content is confirmed ready, no frame (the content itself is now what's
  visible).
- **lost** — the frame turns amber with "Lost track — move back into
  frame". Debounced by 500ms (`LOST_GRACE_MS`) before showing, so
  marginal tracking flickering found/lost across a couple of frames
  doesn't flash "lost" for one frame before snapping back.

## Testing M3 on a physical phone

`public/bundles/m2-demo.json` ("Full Showcase" in the picker) has three
targets, backed by `public/targets/m2-demo.mind` (all three marker images
compiled together):

1. Print `targets/m2-demo/00-spin.png`, `01-static.png`, and
   `02-video.png` (or display full-screen on another device).
2. Open the app over HTTPS on the phone, tap through **Start Scanning →
   Full Showcase → Continue → Got it** (see "Testing M5" below for the
   full-flow walkthrough) — that "Got it" tap is the
   gesture that also unlocks video autoplay (see below) — grant camera
   permission, and point the camera at each marker in turn.
3. Check `00-spin.png` and `01-static.png` still behave as in M2 (rotating
   vs. static/larger icosahedron) — M3 didn't touch the model renderer.
4. Check `02-video.png`: a looping test-pattern video (a moving
   color/gradient pattern with a frame counter, generated by ffmpeg) should
   appear as a plane anchored to the marker, **already playing** the moment
   the marker is found — no second tap needed. This is the actual thing to
   verify: does it start immediately with no extra gesture, especially on
   iOS? Does it pause when the marker is lost and resume (not restart) when
   re-found? Does it loop seamlessly?
5. Add `?debug=1` and confirm the target name field shows
   `2 (looping-video)` while that marker is in view.
6. **Tap the spinning icosahedron on `00-spin.png`** while it's anchored
   and visible: it should flash a different solid color and give a quick
   scale "punch" (bigger then settling back). This is a tap-to-interact
   demo (see below), not part of the original milestone list — it exists
   to prove the AR scene graph is properly hit-testable, which any future
   interactive content depends on.

### Tap-to-interact

`ARStage` raycasts from a `pointerdown` on the AR canvas into the scene
against whatever content handles expose both `object` (the root to
hit-test) and `onInteract()` (what to do on a hit) — see the `ContentHandle`
doc comment in `src/ar/renderers/types.ts`. Only `modelRenderer.ts` wires
this up right now, with a hardcoded demo behavior (cycle through a color
palette, quick scale punch via a timed curve in its existing `update()`
hook) — this isn't a manifest feature. If per-content interactivity turns
out to be something the app actually needs, it belongs as a `ContentItem`
field (e.g. an `onTap` behavior name resolved through a small registry,
the same pattern M4's DOM component registry will use), not hardcoded in
one renderer.

Verified with the same isolated-scene technique used for the lighting/
animation fixes above (a headless run can't drive real marker detection,
so the object's never actually anchored/visible to click on through the
normal flow): built a minimal scene with the real `modelRenderer.ts`,
made the model visible, and dispatched a real `pointerdown` at the
canvas's center pixel using the exact same NDC-conversion and
raycast-then-walk-up-to-handle logic `ARStage` uses. First tap correctly
hit, changed color, and the scale punch was visible a frame later.

**On a physical device, taps registered zero hits.** Root cause: MindAR
always creates a `CSS3DRenderer` (for `CSS3DObject` content this app never
adds — DOM overlays go through screen-space projection of real React
elements instead, per section 5.3) and stacks its root element directly on
top of the WebGL canvas. Three.js's own `CSS3DRenderer` sets that root
element's `pointer-events: auto` by default, so with nothing overriding
it, it silently swallowed every tap meant for the canvas underneath — the
raycasting logic itself was correct, the tap just never reached it. The
isolated-scene test above didn't catch this because it used a bare
`WebGLRenderer` with no `CSS3DRenderer` overlay at all, i.e. it wasn't
actually exercising MindAR's real DOM structure. Fixed by setting
`mindar.cssRenderer.domElement.style.pointerEvents = 'none'` once, right
after MindAR is constructed. Confirmed in a headless run against the real
app: `document.elementFromPoint()` at the canvas's center now returns the
`<canvas>` itself instead of the CSS3D overlay div.
**Re-confirm on a physical device** — a headless run can prove the DOM
structure changed, not that a real touchscreen tap now lands correctly.

This was verified structurally: build succeeds, and a headless-Chromium run
with a fake camera device fetches the manifest, creates and unlocks all
three targets' media, and renders with zero console/page errors *for the
model targets*. The video target's own `.mp4` couldn't be exercised
end-to-end in that environment — Playwright's bundled Chromium is the
open-source build, which has no H.264 decoder at all (`canPlayType`
returns empty for any H.264 source; confirmed directly), unlike every real
target browser (Android Chrome and iOS Safari both ship licensed H.264
support — that's exactly why H.264 baseline is the safe universal choice
here). Swapping the same content item to a VP9 `.webm` this environment
*can* decode round-tripped through the whole pipeline — autoplay unlock,
`THREE.VideoTexture`, plane rendering, pause/resume on target lost/found —
with zero errors, which is as far as this can be checked without a phone.
**Not yet confirmed with the actual `.mp4` on physical hardware.**

### If content drifts, jitters, or one target won't track

Same troubleshooting order as M1/M2, generalized further:

1. **Marker feature quality first** — all three `targets/m2-demo/*.png`
   use the same stratified-shapes generator that fixed M1's drift (see
   `scripts/generate-placeholder-marker.mjs`'s doc comment).
2. **Pose smoothing is tunable without a redeploy**, via
   `?filterMinCF=&filterBeta=` query params — see `ARStage`'s
   `ARStageStartOptions` doc comment for what each one trades off.
3. Physical factors: marker print size, lighting, camera steadiness — see
   the M1 section above (unchanged).
4. If a model doesn't appear, check the console — `modelRenderer.ts` logs a
   clear error for a failed `.glb` load or a missing named `animation`.
5. **If a model renders solid black:** MindAR's scene ships with zero
   lights (confirmed by reading its source — it only ever calls
   `new Scene()`). `MeshStandardMaterial` (what the model renderer's GLTF
   assets use, and what real PBR export pipelines produce) renders pure
   black with nothing to shade it. `ARStage.start()` adds a basic ambient +
   directional light once, but if a future real asset still looks black,
   check whether it uses an *unlit* material (`MeshBasicMaterial`, or a
   glTF `KHR_materials_unlit` extension) that this lighting fix wouldn't
   affect either way, or whether the light intensities need tuning for
   that asset's exposure.
5. **New in M3, video-specific:**
   - **Video doesn't autoplay on marker detection (iOS especially).** This
     means the unlock didn't take — check the console for the
     `autoplay-unlock failed for video "..."` warning `prepareVideoElements.ts`
     logs, and confirm nothing async (a manifest fetch, a state update) runs
     between the "Start AR" tap and the `.play()/.pause()` unlock calls in
     `App.tsx`'s `handleStart`. The manifest is deliberately prefetched on
     page load, not inside that click handler, specifically so this call
     chain can stay synchronous.
   - **Video element never loads / wrong codec.** `canPlayType` in the
     browser's own devtools console is the fastest way to confirm a codec
     gap vs. a real bug — see the H.264-in-Chromium note above for exactly
     that check.

## Testing M4 on a physical phone

`00-spin.png`'s target now has a second content item alongside its model:
a `"Label"` DOM component reading "Spinning!", floating above the
icosahedron.

1. Point the camera at `00-spin.png`.
2. Check: does a dark rounded label reading "Spinning!" appear floating
   above the spinning icosahedron, staying correctly positioned as you
   move the phone (screen-space projection recalculated every frame, not
   a one-time placement)? Does it disappear when the marker is lost and
   reappear correctly when re-found?
3. Tilt the phone to extreme angles relative to the marker — the label
   should hide (not render somewhere nonsensical) if the projection ever
   puts it behind the camera, per `domRenderer.ts`'s `projected.z > 1`
   check.
4. This is real text rendered by React (inspect it in devtools — it's an
   actual `<div>`, not a canvas/WebGL texture), confirming the "no WebGL
   text" rule actually holds.

Verified structurally with an isolated three.js scene (a headless run
can't drive real marker detection, so there's no way to get a target
"found" through the normal flow to check this against): built a scene with
the real `domRenderer.ts`, called `show()` then `update()`, and confirmed
the wrapper div's computed screen position matched hand-calculated
expectations for the anchor's position and camera setup, and that
`hide()`/pre-`show()` both correctly set `display: none`.
**Not yet confirmed on physical hardware.**

## Testing M5 on a physical phone

M5 replaces the M0-M4 single-bundle "Start AR" button with the full app
shell: routing (`react-router`), a real bundle picker (4 bundles now, up
from the 1 test bundle M2-M4 used), a "how to scan" screen, and
`motion`-driven transitions between all of them.

1. Open the app over HTTPS on the phone. **Home**: tap "Start Scanning".
2. **Bundle picker** (`/bundles`): four cards — "Full Showcase" (badged
   FEATURED — model + video + DOM label, the M2-M4 bundle), "Model
   Gallery" (two model-only targets), "Video Showcase" (two video-only
   targets, different sizes), "Label Demo" (two DOM-only targets, no
   3D/video decode cost at all). Tap one, then "Continue".
3. **How to scan** (`/how-to-scan/:bundleId`): tap "Got it" — this is the
   gesture that unlocks video autoplay for whichever bundle you picked
   (see the M3 section above for why that has to happen here, synchronously,
   not earlier in the flow).
4. **AR view** (`/ar/:bundleId`): should show "INITIALIZING CAMERA..."
   briefly, then the scanning frame. Point the camera at that bundle's
   markers (under `targets/<bundle-id>/`) and check the AR HUD section
   above end to end — found-loading (likely brief, see why above),
   tracking, and lost states, plus the actual content (model/video/label
   depending on which bundle).
5. Go back (browser back button) from the AR view, pick a **different**
   bundle, and confirm its markers work too — each bundle compiles to its
   own `.mind` file, so this also checks that switching bundles doesn't
   leak state from the previous one (a fresh `ARStage` is created per AR
   route visit).
6. Check the transitions themselves: Home → Bundles → How-to-scan should
   slide/fade smoothly (`motion`, transform+opacity only). If your OS has
   "reduce motion" enabled, the slide should drop to a plain fade instead
   of just looking identical to motion off — that's the reduced-motion
   variant (`usePageTransition`/`usePrefersReducedMotion`), not a bug.

Verified structurally: build succeeds, and a headless-Chromium run walks
the entire flow — Home → Bundles (all 4 cards render) → How-to-scan → Got
it → AR route — for all four bundles, confirming the "INITIALIZING
CAMERA..." → "Point your camera at a marker" HUD transition and zero
console/page errors throughout. Real per-bundle marker detection isn't
checkable this way (see the "AR HUD" and M1-M4 sections above for why).
**Not yet confirmed on physical hardware.**

### Regenerating markers, bundles, models, and videos

**Marker images → `.mind` files.** `scripts/generate-placeholder-marker.mjs`
takes an output path and a seed (real marker art isn't ready yet — see
`CLAUDE.md`'s answers section):

```sh
node scripts/generate-placeholder-marker.mjs targets/<bundle-id>/00-name.png <seed>
```

Then compile every image for a bundle, in index order, into its `.mind`
file with MindAR's own offline compiler (`mind-ar`'s `OfflineCompiler`, via
`node-canvas` — no network needed):

```sh
node scripts/compile-target.mjs <bundle-id> targets/<bundle-id>/00-*.png targets/<bundle-id>/01-*.png ...
```

This writes `public/targets/<bundle-id>.mind` (served at
`/targets/<bundle-id>.mind`). Both the source images **and** the compiled
`.mind` file are committed together, per the brief's rule against
committing one without the other — there's no build-time compile step in
CI to regenerate it, so the committed `.mind` file is what the deployed app
actually serves. Re-run and commit whenever a marker image changes.

**Bundle manifests** are plain JSON under `public/bundles/`, validated at
load time against `src/content/schema.ts` — see `public/bundles/m2-demo.json`
for the shape. A malformed entry (e.g. a `model` item missing `src`) throws
a specific, path-pointing error instead of silently rendering nothing.

**The bundle picker catalog** (`public/bundles/catalog.json`, validated by
`src/content/catalog.ts`) is separate, lighter-weight metadata — just
`id`/`title`/`description`/`icon`/`manifestUrl`/`markerCount`/`badge` — so
the picker screen doesn't have to fetch every bundle's full manifest just
to render its cards. Adding a bundle means adding both: a full manifest
(this section) and a catalog entry pointing at it.

**Models.** `public/models/placeholder.glb` is a synthetically generated
stand-in (`scripts/generate-placeholder-model.mjs`, using three.js's own
`GLTFExporter` in Node) — a small icosahedron with a 2-second `"Spin"`
animation clip. DRACO/KTX2 decoding is wired up (`src/ar/renderers/modelRenderer.ts`)
even though this particular placeholder doesn't use either compression;
the decoder files themselves are copied from `three`'s own
`examples/jsm/libs/` into `public/decoders/` and committed, since they're
static assets the browser fetches at runtime, not something Vite bundles.

**Videos.** `public/videos/placeholder.mp4` was generated with ffmpeg —
`ffmpeg -f lavfi -i "testsrc2=duration=4:size=480x270:rate=24" -pix_fmt yuv420p -c:v libx264 -profile:v baseline -level 3.0 -movflags +faststart -an out.mp4`
— H.264 baseline profile (the most broadly compatible, including older
iOS), no audio track (the manifest's videos are always muted per the
brief, so there's no reason to encode one), `+faststart` so the `moov` atom
is at the front for fast start over HTTP. No transparency — alpha-packed
video isn't implemented (skipped per the brief's answers, see
`videoRenderer.ts`), so `alpha: 'none'` (or omitted) is the only supported
value right now.

## Project structure

```
src/
  ar/
    ARStage.ts              # plain TS, owns MindAR + three.js + one anchor per target
    ARView.tsx              # single-div React wrapper, empty-deps effect
    ArHud.tsx               # scanning/found-loading/tracking/lost overlay (see "AR HUD" above)
    arSessionStore.ts        # hands the autoplay-unlocked <video> elements from HowToScan to ArRoute
    prepareVideoElements.ts # create + iOS-autoplay-unlock a bundle's <video> elements
    useFilterParams.ts      # ?filterMinCF=&filterBeta= query-param reader
    renderers/               # one file per content type (CLAUDE.md section 5)
      modelRenderer.ts       # GLTFLoader + DRACO/KTX2, play/pause named animation clip
      videoRenderer.ts       # THREE.VideoTexture on a plane, pause/resume on lost/found
      domRenderer.ts         # screen-space-projected React component, no WebGL text
      createContentHandle.ts # type -> renderer dispatch
      applyTransform.ts      # position/rotation/scale from a ContentItem
      types.ts                # ContentHandle interface
  content/
    types.ts                # Vec3/ContentItem/TargetEntry/Bundle
    schema.ts                # Zod validation, parseBundle()
    catalog.ts               # lighter-weight picker metadata + parseCatalog()
  dom/
    iconRegistry.ts          # icon name -> component, used by the picker
    icons.tsx                 # the actual icon components
    componentRegistry.ts     # manifest `component` string -> actual React component
    components/              # the registered components themselves (e.g. Label.tsx)
    PillButton.tsx            # shared button used by every non-AR screen
    usePageTransition.ts     # shared motion enter/exit for Home/Bundles/HowToScan
    usePrefersReducedMotion.ts
  routes/
    Home.tsx
    BundlePicker.tsx
    HowToScan.tsx
    ArRoute.tsx               # wires ARView + ArHud together for /ar/:bundleId
  debug/                    # ?debug=1 overlay + its store
  App.tsx                   # router shell (AnimatePresence + Routes)
scripts/
  generate-placeholder-marker.mjs   # image, given a path + seed (real art isn't ready)
  generate-placeholder-model.mjs    # one-off: produced public/models/placeholder.glb
  compile-target.mjs                # image(s) -> .mind, run whenever a marker image changes
targets/            # source marker images, per bundle, git-tracked
public/
  bundles/          # manifest JSON per bundle + catalog.json (picker metadata)
  targets/          # compiled .mind files
  models/           # .glb assets
  videos/           # .mp4 assets
  decoders/         # DRACO/KTX2 decoder files, copied from three's examples/jsm/libs/
```

## Build order

Each milestone is meant to run on a physical phone before the next starts —
see the project brief for the full list. Current: **M0-M4 done**, confirmed
on a physical phone (plus tap-to-interact, added ahead of schedule and now
also confirmed); **M5 built, awaiting physical-device confirmation**. Next
after that: **M6**, hardening — lazy per-target asset loading (everything
currently loads eagerly at bundle start), permission-denied and
unsupported-browser fallback screens, and a real performance pass on a
mid-range Android.
