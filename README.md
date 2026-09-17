# ARMarker

Mobile-first WebAR app: the device camera detects printed image markers and
overlays 3D models, video, and DOM UI anchored to those markers. Built with
Vite + React + TypeScript, three.js, and MindAR's three.js image-tracking
integration (not the A-Frame one).

Status: **Milestone 3 — video renderer, not yet verified on a physical
phone.** M0-M2 (harness, tracking spike, manifest + model renderer) are
phone-confirmed; M3 adds the video renderer and the iOS autoplay unlock,
and needs its own device pass before M4. See `CLAUDE.md` (project brief)
for the full build order.

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

## Testing M3 on a physical phone

`public/bundles/m2-demo.json` (the one demo bundle so far) now has three
targets, backed by `public/targets/m2-demo.mind` (all three marker images
compiled together):

1. Print `targets/m2-demo/00-spin.png`, `01-static.png`, and
   `02-video.png` (or display full-screen on another device).
2. Open the app over HTTPS on the phone, tap **Start AR** — this is the
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
    prepareVideoElements.ts # create + iOS-autoplay-unlock a bundle's <video> elements
    renderers/               # one file per content type (CLAUDE.md section 5)
      modelRenderer.ts       # GLTFLoader + DRACO/KTX2, play/pause named animation clip
      videoRenderer.ts       # THREE.VideoTexture on a plane, pause/resume on lost/found
      createContentHandle.ts # type -> renderer dispatch; 'dom' lands in M4
      applyTransform.ts      # position/rotation/scale from a ContentItem
      types.ts                # ContentHandle interface
  content/
    types.ts                # Vec3/ContentItem/TargetEntry/Bundle
    schema.ts                # Zod validation, parseBundle()
  debug/                    # ?debug=1 overlay + its store
  App.tsx                   # M3 placeholder shell; routing/bundle picker land in M5
scripts/
  generate-placeholder-marker.mjs   # image, given a path + seed (real art isn't ready)
  generate-placeholder-model.mjs    # one-off: produced public/models/placeholder.glb
  compile-target.mjs                # image(s) -> .mind, run whenever a marker image changes
targets/            # source marker images, per bundle, git-tracked
public/
  bundles/          # manifest JSON, one file per bundle
  targets/          # compiled .mind files
  models/           # .glb assets
  videos/           # .mp4 assets
  decoders/         # DRACO/KTX2 decoder files, copied from three's examples/jsm/libs/
```

Later milestones add `src/ar/renderers/domRenderer.ts` + a component
registry (M4), and `src/routes/` (M5).

## Build order

Each milestone is meant to run on a physical phone before the next starts —
see the project brief for the full list. Current: **M0-M2 done**, confirmed
on a physical phone; **M3 built, awaiting physical-device confirmation**.
Next after that: **M4**, the DOM overlay renderer (screen-space projection
of an anchor's position, plus the component registry that maps a
manifest's `component` string to an actual React component).
