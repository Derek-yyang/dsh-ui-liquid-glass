# dsh-ui-liquid-glass

English | [中文](README.zh.md)

A third-party UI theme plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) web. Liquid Glass theme: one alias-token override layer that turns the dsh web surface into a translucent glass palette over a plugin-owned wallpaper, [liquidGL](https://liquidgl.naughtyduk.com) (npm `liquid-gl`) WebGL refraction applied to the conversation composer card itself, scroll-synced wallpaper motion, a dock toggle, and a card in the Settings Plugins section exposing the same toggle plus the wallpaper choice — the toggle and preset id persist in the Host settings document, and a custom uploaded image persists device-local in IndexedDB. The wallpaper has four built-in line-art presets — `ridge`, `coast`, `garden`, `arch` — plus the user's uploaded images, painted raw; long-pressing the dock button cycles the whole gallery (built-ins, then customs) or a tile can be picked in the Settings card. Soft gradient scenes were dropped because they do not give the glass edges to bend.

## Install

Requires a running `dsh web` (developed against dsh `0.1.1-rc.2`). Install the package into your profile and register one insert row:

```sh
dsh plugin --profile web add file:/path/to/this/repo        # or an npm spec once published
```

Then add to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-ui-liquid-glass
      name: dsh-ui-liquid-glass
```

Restart `dsh web`; the dock button appears bottom-right. The toggle, preset, and clarity choices persist in Host settings.

## Development

```sh
pnpm install
pnpm run typecheck   # resolves @deepseek-ai/* from their published npm types
pnpm run test        # vitest; needs a deepseek-harness checkout at ../deepseek-harness
pnpm run build       # tsc emit + tsdown → lib/index.js, lib/client.js
pnpm run watch
```

Published `@deepseek-ai/dsh-client-*` artifacts are closure bundles for the dsh module loader, so the test lane resolves them to the source plane of a sibling deepseek-harness checkout (`git clone https://github.com/deepseek-ai/deepseek-harness ../deepseek-harness`) — the same source-plane rule in-repo development follows. Typecheck and builds stay standalone on the npm types. Rebuild (`pnpm run build`) before probing a live server: the registry serves `lib/client.js`, not sources. Push and pull requests run `pnpm run typecheck` and `pnpm run test` on GitHub Actions (`.github/workflows/ci.yml`); the test job clones harness next to this repo at tag `dsh-v0.1.1-rc.2` and installs both lockfiles, because vitest resolves `@deepseek-ai/*` to harness sources.

## Design

The token layer rides [`ctx.theme.overrideTokens`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-theme/README.md) under this package's id, so it composes over whichever base palette (`light`/`dark`/`system`) the user prefers and disappears completely when the plugin unmounts or the toggle turns off. Surfaces (layers, bubbles, code blocks, menus, inputs) become translucent; labels, state colors, masks, and scrollbars keep the base palette. The sidebar is frosted rather than washed: its fill token stays weak (0.18/0.25) and the controller blurs the column's backdrop through the `data-app-sidebar` marker ui-layout exposes, so the wallpaper reads as a soft color wash behind the session text instead of sharp noise under a white veil — the earlier 0.34 fill stacked on the frame's translucent `bg-base` into a ~0.55 white veil that washed the column out. Modal panels take the same frost through the shared `data-modal-panel` marker (the ui-primitives dialog card and the settings shell panel both carry it): their translucent layer-2 fill over dense transcript text stays readable only once the backdrop blurs into a color wash. The settings dialog is the exception: it keeps the frost off (the fill is already opaque, so a 20px backdrop blur is a full-viewport GPU pass with nothing to show), restores an opaque fill (`[role=dialog][aria-modal=true]`) so the global clarity slider cannot punch the conversation through a reading surface, and rebinds the nav hover/active fills on that node so they stay visible on the white panel (the global glass tokens are white). Opening the dialog also parks the liquidGL rAF loop until it closes. The full value set lives in `src/tokens.ts`.

The refraction target is the app-owned composer card (`data-composer-card`), not a plugin-owned surface: the library strips the card's fill inline and paints refracted glass on its shared body-level lens canvas, while the composer seat's stacking context (sticky + `z-index` 7 when docked; lifted by a plugin-injected rule in the hero and settling phases) keeps every glyph and control above that canvas. The tuning follows the library's demo-5 look — a slight center refraction, a deep narrow bevel rim, no frost, and the library's drop shadow, which lives as a fixed element beside the canvas plus an inline shadow on the card and is re-driven by the toggle across off/on. The snapshot source is the plugin wallpaper — never the app DOM — and it is `position: absolute` on purpose: the snapshot rasteriser skips fixed-position elements, and the document never scrolls, so absolute paints identically. The card mounts after boot, so the controller watches for it with a MutationObserver and re-glassifies remounted cards. When WebGL is unavailable the library itself degrades the target to a CSS `backdrop-filter` frost. The dock button (bottom-right) toggles the whole theme and is the re-entry control while off.

The wallpaper follows the conversation scrollport (`data-conversation-scroll`) at a fixed 0.25 parallax coefficient through one document-level capture listener, anchored at the first observed scroll after each enable and clamped to a ±60vh headroom (the wallpaper element is enlarged to match), so the offset stays bounded no matter how deep into the transcript the user starts. The enlarged canvas lives inside a viewport-sized clipping host (`overflow: hidden`) — an unclipped absolute box 60vh taller than the viewport would grow the document's scrollable area by the headroom and let the whole app be dragged down, while the app's layout premise is a never-scrolling document. The glass needs no recapture on scroll: the rasteriser bakes the texture in the wallpaper's own coordinates (it inverts the element's current transform), and the lens recomputes its sampling region from the live snapshot rect every frame, so a translated wallpaper is tracked automatically — recapturing mid-interaction would only re-rasterize the full-resolution texture. A preset swap clones the outgoing layer, paints the new scene underneath, and fades the clone out over 150ms (`prefers-reduced-motion: reduce` skips the fade); the one recapture waits for that clone to leave so the lens and the wallpaper settle together (size changes stay the library ResizeObserver's job). A light/dark palette flip is the other recapture: `theme/change` waits two animation frames for the `:global(body[data-ds-dark-theme])` wallpaper rules to paint, then recaptures so the composer does not keep refracting the previous scheme. The wallpaper is a compositor layer (`will-change: transform`) so the per-scroll-frame transform writes never repaint the 220vh gradient canvas. Nested scrollers (code blocks) and unrelated scrollers (sidebar lists) never drag the wallpaper — the listener matches the scrollport exactly.

The preferences persist in the plugin's Host settings namespace, not in the browser: the node half declares `Config` (`enabled` + `preset` + `clarity` plus the liquidGL look knobs) and registers it via `installSettingsSection`, and the browser half reads and writes the same namespace through `ctx.settingsScope` — so the choice survives browser and device switches, while the boot row still carries no config (the web boot composes browser entries by name alone). The Settings Plugins card is a browser-side editor over that namespace, registered as `settings.plugin.item` keyed by it; the controller publishes `{ enabled, preset, gallery, clarity, look, lookValues }` through a snapshot store carried in the inject hooks compartment, so dock clicks, long-press cycles, and Settings writes all render from one source. The composer-glass look is three named bags (`restrained` / `standard` / `rich` — `rich` is the shipped calibration) on a popover opened by right-clicking the droplet so the composer stays visible while dragging. Settings only toggles the theme and picks a wallpaper. Dock and popover copy follow the active UI locale (`locale/change`); the Settings card already does through its slot `t`. The popover itself follows the light/dark palette (`body[data-ds-dark-theme]`), same marker as the wallpaper. Picking a look copies its bag; dragging a knob derives `custom`. Numeric uniforms write through `lens.options` each frame; `setShadow` is the only library setter the hot path calls. Custom images paint raw — no softening veil. Surface clarity lives on the same popover, not in Settings: [`scaleSurfaceTokens`](src/tokens.ts) interpolates the whole override table between the shipped calibration (0) and the clear endpoint (100) — static surface fills fade to fully transparent, interactive and transient fills fade to a usable floor, and borders, the contrast button, and the colored accent stay stock (they are the glass's edges and feedback, not color casts); a clarity change disposes the plugin's previous override layer and registers the scaled one. The uploaded image itself never reaches the Host — images are device-local IndexedDB blobs, and the namespace stores only the `custom` id; another browser showing the same Host sees the built-in scene until it uploads its own.

## Model Experience

None, as the plugin renders browser presentation surfaces only and never assembles a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **liquidGL has no lens-removal or teardown API** — disabling hides the renderer's canvas and parks its rAF loop, and the card's fill is restored inline; the window-global renderer and any lens instances survive plugin disposal by library design.
- **A remounted composer card gets a fresh lens** — the library cannot unbind the old lens, so the orphaned instance stays registered on the detached node (where it draws nothing); a session of repeated workspace switches accumulates dormant lenses.
- **Safari stability degrades on wide glass** — the library documents instability when the liquid element exceeds ~50% of the viewport width, and the composer routinely does on narrow windows.
- **The parallax keeps oversized GPU surfaces resident** — the compositor layer behind `will-change: transform` and the snapshot texture both cover the viewport plus the 120vh headroom (the texture rasterised at 2× resolution), a constant GPU memory cost while the toggle is on.
- **The sidebar frost re-filters on every parallax frame** — the wallpaper's scroll-driven transform moves the backdrop under the column's `backdrop-filter`, so scrolling pays a per-frame blur of one column; unmeasured but unproblematic on desktop GPUs, and it is scroll-path cost unique to this plugin.
- **A later `overrideTokens` layer replaces surface values** — the seq-ordered override stack means any plugin registering after this one wins per-token; this plugin does not defend its values.
