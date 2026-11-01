# Developer guide

## Requirements and local setup

Use Node.js 22.12+ (or Node.js 24+) and Python 3.
From the repository root:

```sh
npm run setup
npm run dev
```

`setup` installs v2 dependencies from `v2/package-lock.json` with `npm ci`.
Run it after dependency changes. `dev` builds both versions, then serves `dist/`:

- [Default / version 2](http://127.0.0.1:4819/)
- [Version 1](http://127.0.0.1:4819/v1/)
- [Version 2](http://127.0.0.1:4819/v2/)

Use the explicit loopback address to avoid another server bound to `localhost`.
For v2 hot reload, run `npm run dev:v2` and open http://127.0.0.1:3000/.
The Python server serves a snapshot; rebuild after changing sources.

## Structure and routing

- `v1/`: original standalone JavaScript/CSS simulator and its screenshot.
- `v2/`: independent React, TypeScript, Three.js, Vite and Tailwind CSS app.
- `index.html`: redirects `/` to `/v2/`, preserving query parameters and fragments.
- `scripts/build.mjs`: builds v2 and assembles the static site in `dist/`.
- `tests/`: v1 input/physics tests and browser checks for both versions.

Vite uses relative asset URLs, supporting domain-root hosting and the
`/parking-simulator/` GitHub Pages prefix. Directory routes accept `/v1` and
`/v2` with the hosting server adding trailing slashes. No backend is required.
The extracted v2 source is maintained here; the original export archive was removed.
Use npm and `v2/package-lock.json` as the dependency source of truth.

## Implementation notes

V1 shares world-space roads, markings, vehicle geometry and obstacles across its
windshield, mirrors and parking cameras. The windshield refreshes at 30 FPS and
mirrors/camera panels at 12 FPS. Traffic follows right-hand lanes, brakes over an
18-metre zone and waits for blocked routes to clear instead of respawning.

V1 service braking uses 8 m/s², with forward/reverse acceleration of 3.2/2.2 m/s².
Vehicle side mirrors participate in clearance checks. Headlamp cones illuminate
world surfaces with distance falloff; rainy weather clears droplets along the
continuous paths of the two wiper blades.

V1 touch devices use non-passive Touch Events for independent wheel/pedal contacts;
mouse and pen use Pointer Events. Wheel grip takes priority over steering buttons.
Viewport changes, backgrounding and other interruptions clear or rebase held inputs.

V2 separates vehicle physics, parking evaluation, scene creation and rendering
under `v2/src/simulation/`, with React cockpit components under `v2/src/components/`.
Acceleration and reversing keep longitudinal body pitch at zero.

The v1 neighbourhood is a scaled driving interpretation, informed by the
[City of Markham official plan](https://www.markham.ca/economic-development-business/planning-development-services/official-plan),
[City street guide](https://www.markham.ca/about-the-city-of-markham/city-hall/interactive-maps-applications)
and [OpenStreetMap](https://www.openstreetmap.org/#map=15/43.8914/-79.3038).

## Build and deployment

```sh
npm run check:v2
npm run build
```

Publish the entire `dist/` directory. It contains the root redirect, v1 and
compiled v2 assets, excluding v2 source, dependencies and archives.
`.github/workflows/deploy-pages.yml` builds on pushes to `main` and publishes to
`gh-pages`. GitHub Settings → Pages must use **gh-pages** and its root folder, never
`main`: serving `v2/src/main.tsx` directly causes a blank page because the browser
cannot execute TypeScript/JSX. Deployment checks verify a compiled asset entry.
`.github/workflows/validate.yml` installs dependencies, checks syntax and types,
runs unit tests and builds the site; browser jobs exercise the built output.

## Automated checks

```sh
npm test
npm run check:v2
npm run build
```

For browser tests, install the Playwright version pinned in
`.github/workflows/validate.yml`, then:

```sh
npx playwright install --with-deps chromium webkit
node tests/browser.mjs
node tests/v2-browser.mjs
```

Set `APP_ROOT=dist` for `tests/browser.mjs` to test the deployed v1 build instead
of source. Set `BROWSER=chromium` or `BROWSER=webkit` to select its engine.
The v2 smoke check serves the built site under a repository prefix and verifies
the default redirect, explicit v2 route, views, help, driving input, reset and
switching to v1. Set `UPDATE_SCREENSHOT=1` to refresh the root `screenshot.png`.
`BROWSER_CHANNEL=chrome` optionally uses installed Chrome for that smoke check.

## Documentation and screenshots

Keep the player-facing README and both application screenshots current when
features, behavior or appearance change. `screenshot.png` shows v2;
`v1/screenshot.png` shows v1. Keep setup, architecture and test instructions in
this guide. Documentation-only changes can retain screenshots of the current app.

## V1 device regression checklist


Run `npm test` for the dependency-free multi-touch, interruption, cleanup and
braking tests, then `npm run build`. Pull requests run syntax checks, tests and the
static build without publishing the game.

Manual browser/device checks: drag the rim across the ±180° seam, continue around
to both hard stops and reverse, release and re-grab while recentering, move through
the hub, and hold a pedal with another finger throughout. Verify that the center
horn button still works and wheel gestures do not scroll or zoom the page.
Check sizes 568×320, 667×375, 844×390 and 1024×768; hold steering
with either pedal, slide a finger off a held button before releasing, interrupt a
hold by switching apps or rotating, open/close tools and settings, hide/restore
cameras, then return to desktop keyboard control. Verify the notch/home indicator
areas on a physical iPhone. The README includes desktop screenshots for both versions. CI also captures
mobile viewport screenshots.

For full-page input regressions, install the CI-pinned Playwright version from
`.github/workflows/validate.yml`, run `npx playwright install --with-deps chromium webkit`,
then `node tests/browser.mjs`. CI saves viewport screenshots and browser traces.
Chromium uses browser-generated multi-touch; WebKit uses synthetic touch contacts
bubbling through the real DOM. Neither replaces physical-iPhone testing.

## App identity and offline support

The in-game title is Parking Simulator; the install name is Parking.
`v2/public/` contains the manifest, favicon and icon sizes, including a padded
maskable icon. Root and v1 also use the approved side-mirror favicon.
The root build generates `dist/v2/sw.js` from the exact compiled assets using
`scripts/service-worker.mjs`. It precaches the game shell and uses network-first
navigation with cached offline fallback, scoped to v2. Old versioned caches are
removed when a new worker activates; close and reopen app tabs to finish updates.
The root redirect needs a network connection; use the installed app or /v2/ offline.

## Platform app switcher

The header's nine-dot launcher reads `https://hedgies.cloud/app.json` on open.
`platformApps.ts` excludes the stable ID `parking-simulator` independently of the
current host or URL. Apps open in new tabs. There is no hard-coded app/icon list.

GitHub Pages has no server proxy and the registry currently lacks CORS headers.
`scripts/platform-apps.mjs` therefore resolves the live registry and each app's
page/manifest at build time into `dist/v2/apps.json`. The browser tries the live
URL, then this same-origin copy. `.github/workflows/refresh-apps.yml` refreshes
that file every 15 minutes without rebuilding the game; GitHub schedules can be
delayed. Names/icons come from app manifests, with ID/initial fallbacks.
The resolver limits response sizes, uses HTTPS, and rejects private IPs and
redirects to them. No third-party public proxy is used. Each UI excludes itself
by ID, while the generated file retains the complete registry.

The last good list is also saved locally for offline use. Set `VITE_APPS_URL` at
build time to use a shared CORS-enabled enriched endpoint if one becomes
available. If both live and saved requests fail, the menu offers Try again.

## Mobile layout

`utils/mobile.ts` treats `(pointer: coarse) and (hover: none)` devices with a short
side of 900px or less as mobile. Components take a `mobile` prop and use the `.m-*`
classes in `index.css`, which size panels in `vw`/`dvh` so they cannot overlap.
Portrait shows a rotate prompt; the first touch requests fullscreen and a landscape
lock (unsupported on iPhone Safari, so use Add to Home Screen there).
