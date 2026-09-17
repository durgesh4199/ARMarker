# ARMarker

Mobile-first WebAR app: the device camera detects printed image markers and
overlays 3D models, video, and DOM UI anchored to those markers. Built with
Vite + React + TypeScript, three.js, and MindAR's three.js image-tracking
integration (not the A-Frame one).

Status: **Milestone 1 — tracking spike.** One hardcoded marker, one
rotating cube, no manifest yet. **Not yet verified on a physical phone** —
see "Testing M1" below. See `CLAUDE.md` (project brief) for the full build
order.

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
`ARStage`'s `targetFound`/`targetLost` events feed the target fields as of
M1.

## Testing M1 on a physical phone

M1 is a tracking spike: tap "Start AR" on the home screen, point the camera
at the marker image, and a cube should appear anchored to it.

1. Print `targets/m1-spike/00-cube-marker.png` (or display it full-screen on
   another device — printed is what's confirmed to work per the answers in
   `CLAUDE.md`; on-screen wasn't in scope but will likely work too for a
   quick check).
2. Open the app over HTTPS on the phone (see "Testing on a physical phone"
   above), tap **Start AR**, grant camera permission, and point the camera
   at the printed marker, filling as much of the frame as practical.
3. Check: does the cube appear reasonably anchored to the marker (stays put
   as you move the phone, doesn't drift wildly)? Does it survive occlusion/
   losing and re-finding the marker without the tab needing a reload? Add
   `?debug=1` to watch FPS and confirm the target index/name field flips
   between `—` and `0 (m1-spike-cube)` as the marker comes in and out of
   view.

This was verified structurally (build succeeds, headless Chromium with a
fake camera device runs the full pipeline — camera → MindAR init → `.mind`
file fetch and parse → render loop — with zero console/page errors, and a
React 18 StrictMode double-mount in dev settles to exactly one live camera
track and no leaked `resize` listener) but **not yet on real hardware** —
that's the one thing only a physical device test can confirm, per the
brief's build-order rule.

### Regenerating the marker

`targets/m1-spike/00-cube-marker.png` is a synthetically generated
placeholder (real marker art isn't ready yet — see `CLAUDE.md`'s answers
section), built by `scripts/generate-placeholder-marker.mjs`. Compile any
new or changed source image into the `.mind` file MindAR loads at runtime
with:

```sh
node scripts/compile-target.mjs m1-spike targets/m1-spike/00-cube-marker.png
```

This runs MindAR's own offline target compiler (`mind-ar`'s
`OfflineCompiler`, via `node-canvas` — no network needed) and writes
`public/targets/m1-spike.mind`. Source images live in `targets/<bundle-id>/`
(named `00-...`, `01-...` in index order — the index is positional and
fragile, see `CLAUDE.md` section 3); compiled `.mind` files live in
`public/targets/` (served at `/targets/<bundle-id>.mind`). Multi-target
bundles pass every image in index order:
`node scripts/compile-target.mjs chapter-1 targets/chapter-1/00-*.png targets/chapter-1/01-*.png ...`.

Both the source images **and** the compiled `.mind` file are committed
together, per the brief's rule against committing one without the other —
the `.mind` file is what the deployed app actually serves, and there's no
build-time compile step in CI to regenerate it. Re-run the command above
and commit the result whenever a marker image changes.

## Project structure

```
src/
  ar/               # ARStage (plain TS, owns MindAR + three.js) and its React wrapper
  debug/            # ?debug=1 overlay + its store
  App.tsx           # M1 placeholder shell; routing/bundle picker land in M5
scripts/
  generate-placeholder-marker.mjs   # one-off: produced targets/m1-spike/00-cube-marker.png
  compile-target.mjs                # image(s) -> .mind, run whenever a marker image changes
targets/            # source marker images, per bundle, git-tracked
```

Later milestones add `src/content/` (manifest types + Zod schema + the
three content renderers) and `src/routes/`.

## Build order

Each milestone is meant to run on a physical phone before the next starts —
see the project brief for the full list. Current: **M0 done**; **M1 built,
awaiting physical-device confirmation**. Next: **M2**, the manifest schema,
Zod validation, and the model (GLTF) renderer, with multiple targets in one
bundle.
