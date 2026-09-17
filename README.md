# ARMarker

Mobile-first WebAR app: the device camera detects printed image markers and
overlays 3D models, video, and DOM UI anchored to those markers. Built with
Vite + React + TypeScript, three.js, and MindAR's three.js image-tracking
integration (not the A-Frame one).

Status: **Milestone 2 — manifest-driven bundle, not yet verified on a
physical phone.** M0 and M1 (harness, single hardcoded marker) are
phone-confirmed; M2 replaces the hardcoded marker with a JSON manifest,
Zod validation, and the GLTF model renderer, and needs its own device pass
before M3. See `CLAUDE.md` (project brief) for the full build order.

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

## Testing M2 on a physical phone

M2 replaces M1's single hardcoded marker with a real manifest-driven
bundle: `public/bundles/m2-demo.json` describes two targets, both using the
GLTF model renderer, backed by `public/targets/m2-demo.mind` (both marker
images compiled together — see below).

1. Print `targets/m2-demo/00-spin.png` and `targets/m2-demo/01-static.png`
   (or display full-screen on another device).
2. Open the app over HTTPS on the phone, tap **Start AR**, grant camera
   permission, and point the camera at either marker.
3. Check: does a small blue icosahedron appear anchored to each marker?
   The one on `00-spin.png` should be continuously rotating (it has an
   `animation: "Spin"` entry in the manifest); the one on `01-static.png`
   should hold still and render larger (`scale: 1.5` vs `1`) — that
   difference is there specifically to prove the manifest's per-target
   content and transform data actually reaches the renderer, not just that
   *a* model shows up. Does each stop rendering when its marker is lost and
   resume correctly when re-found? Try holding both markers in frame at
   once — both should track and render independently.
4. Add `?debug=1` and confirm the target index/name field shows
   `0 (spinning-icosahedron)` or `1 (static-icosahedron)` as appropriate,
   flipping to `—` when neither marker is visible.

This was verified structurally: build succeeds, and a headless-Chromium run
with a fake camera device fetches the manifest, validates it, fetches both
the `.mind` file and the shared `.glb` model, and renders with zero
console/page errors. **Not yet confirmed on physical hardware** — M1's
placeholder-marker drift fix (stratified, evenly-spread features) carried
over to these two markers, but that's only confirmed structurally, not on
a phone, for this specific pair.

### If content drifts, jitters, or one target won't track

Same troubleshooting order as M1, generalized beyond "the cube":

1. **Marker feature quality first.** Both `targets/m2-demo/*.png` use the
   same stratified-shapes generator that fixed M1's drift (see
   `scripts/generate-placeholder-marker.mjs`'s doc comment) — evenly spread
   small shapes, no dominant blobs. If a *specific* marker tracks worse
   than the other, compare them visually first; a bad seed can still
   produce a weaker pattern than another.
2. **Pose smoothing is tunable without a redeploy**, via
   `?filterMinCF=&filterBeta=` query params — see `ARStage`'s
   `ARStageStartOptions` doc comment for what each one trades off.
3. Physical factors: marker print size, lighting, camera steadiness — see
   the M1 section above (unchanged).
4. **New in M2**: if a model doesn't appear at all (as opposed to
   drifting), check the browser console first — `modelRenderer.ts` logs a
   clear error if the `.glb` fails to load or a named `animation` isn't
   found in the file, rather than failing silently.

### Regenerating markers, bundles, and models

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

**Models.** `public/models/placeholder.glb` is a synthetically generated
stand-in (`scripts/generate-placeholder-model.mjs`, using three.js's own
`GLTFExporter` in Node) — a small icosahedron with a 2-second `"Spin"`
animation clip. DRACO/KTX2 decoding is wired up (`src/ar/renderers/modelRenderer.ts`)
even though this particular placeholder doesn't use either compression;
the decoder files themselves are copied from `three`'s own
`examples/jsm/libs/` into `public/decoders/` and committed, since they're
static assets the browser fetches at runtime, not something Vite bundles.

## Project structure

```
src/
  ar/
    ARStage.ts              # plain TS, owns MindAR + three.js + one anchor per target
    ARView.tsx              # single-div React wrapper, empty-deps effect
    renderers/               # one file per content type (CLAUDE.md section 5)
      modelRenderer.ts       # GLTFLoader + DRACO/KTX2, play/pause named animation clip
      createContentHandle.ts # type -> renderer dispatch; 'video'/'dom' land in M3/M4
      applyTransform.ts      # position/rotation/scale from a ContentItem
      types.ts                # ContentHandle interface
  content/
    types.ts                # Vec3/ContentItem/TargetEntry/Bundle
    schema.ts                # Zod validation, parseBundle()
  debug/                    # ?debug=1 overlay + its store
  App.tsx                   # M2 placeholder shell; routing/bundle picker land in M5
scripts/
  generate-placeholder-marker.mjs   # image, given a path + seed (real art isn't ready)
  generate-placeholder-model.mjs    # one-off: produced public/models/placeholder.glb
  compile-target.mjs                # image(s) -> .mind, run whenever a marker image changes
targets/            # source marker images, per bundle, git-tracked
public/
  bundles/          # manifest JSON, one file per bundle
  targets/          # compiled .mind files
  models/           # .glb assets
  decoders/         # DRACO/KTX2 decoder files, copied from three's examples/jsm/libs/
```

Later milestones add `src/ar/renderers/videoRenderer.ts` (M3),
`src/ar/renderers/domRenderer.ts` + a component registry (M4), and
`src/routes/` (M5).

## Build order

Each milestone is meant to run on a physical phone before the next starts —
see the project brief for the full list. Current: **M0 and M1 done**,
confirmed on a physical phone; **M2 built, awaiting physical-device
confirmation**. Next after that: **M3**, the video renderer (iOS autoplay
unlock; the alpha-packed shader path is skipped per the brief's answers —
no video needs transparency).
