/** Controller that glassifies the conversation composer card (the rounded
 * input capsule) with liquidGL refraction over the plugin wallpaper. The card
 * is app-owned DOM: the library strips its fill and paints the glass on its
 * shared body-level lens canvas, while the composer seat's stacking context
 * (sticky + z-index 7 when docked; lifted by this plugin's rule in the hero
 * and settling phases) keeps every glyph and control above that canvas. */

import liquidGL from 'liquid-gl'
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import css from './glass.module.css'
import {
  addGalleryImage, customPresetId, galleryIdFromPreset, loadGallery, nextWallpaperPreset, removeGalleryImage,
} from './wallpaper-store.ts'
import type { GalleryRecord } from './wallpaper-store.ts'
import { zh, type LiquidGlassLocaleKey } from './locales.ts'
import {
  CLARITY_DEFAULT_PERCENT, COMPOSER_SELECTOR, GLASS_MARKER, LIQUID_GLASS_TOKENS,
  MODAL_PANEL_SELECTOR, PACKAGE_ID, SCROLL_SELECTOR, SEAT_SELECTOR,
  PORTAL_MENU_SELECTOR, SETTINGS_DIALOG_SELECTOR, SIDEBAR_SELECTOR, WALLPAPER_CROSSFADE_MS,
  WALLPAPER_SELECTOR,
} from '../tokens.ts'
import { scaleSurfaceTokens } from '../tokens.ts'
import type { WallpaperPreset } from '../tokens.ts'
import {
  DEFAULT_LOOK, GLASS_LOOKS, GLASS_LOOK_PRESETS, GLASS_LOOK_SLIDER_KEYS, GLASS_LOOK_SLIDERS, lookIdFor, sameLook,
} from '../look.ts'
import type { GlassLookId, GlassLookValues, LiquidGlassHostSection, NamedGlassLook } from '../look.ts'

/** liquidGL options that are not a look: the compositor target, the snapshot
 * source, HiDPI capture, the fade-in, and no tilt. Look knobs (refraction,
 * bevel, frost, aberration, magnify, shadow, specular) live on `#look`. */
const GL_FIXED = {
  target: COMPOSER_SELECTOR,
  snapshot: WALLPAPER_SELECTOR,
  resolution: 2.0,
  reveal: 'fade' as const,
  tilt: false,
}

const DEFAULT_LOOK_VALUES: GlassLookValues = GLASS_LOOK_PRESETS[DEFAULT_LOOK]

const KNOB_COPY: Record<(typeof GLASS_LOOK_SLIDER_KEYS)[number], LiquidGlassLocaleKey> = {
  refraction: 'knobRefraction',
  bevelDepth: 'knobBevelDepth',
  bevelWidth: 'knobBevelWidth',
  frost: 'knobFrost',
  aberration: 'knobAberration',
  magnify: 'knobMagnify',
}

const LOOK_COPY: Record<(typeof GLASS_LOOKS)[number], LiquidGlassLocaleKey> = {
  restrained: 'lookRestrained',
  standard: 'lookStandard',
  rich: 'lookRich',
}

/** Format a look-knob number for the popover readout. */
function formatKnob(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

/** Look knobs persisted in the Host document, in write order. */
const LOOK_KEYS = [
  'refraction', 'bevelDepth', 'bevelWidth', 'frost', 'aberration', 'magnify',
  'shadow', 'specular',
] as const satisfies ReadonlyArray<keyof GlassLookValues>

/** Scroll-sync tuning. The wallpaper trails the conversation scrollport at a
 * fixed parallax coefficient (0.25 — visibly alive without feeling detached);
 * its travel is bounded by a viewport-height headroom, split around an anchor
 * taken at the first observed scroll after each enable, and the wallpaper
 * element is enlarged by exactly that headroom (see `#applyWallpaperCanvas`)
 * so the translation never pulls an edge into view. No Config reaches a
 * browser plugin half (web boot composes rows by name alone), so these are
 * product design values like `GL_OPTIONS`. */
const PARALLAX_COEFFICIENT = 0.25
const PARALLAX_HEADROOM_VH = 120

/** Hold the dock button this long to cycle wallpaper presets instead of
 * toggling the theme; a shorter press keeps the toggle. */
const LONG_PRESS_MS = 450

/** The clarity slider fires an input event per drag tick; the Host document
 * write trails the last one so the wire sees one commit per gesture. The
 * local surfaces apply immediately either way. */
const SLIDER_WRITE_DEBOUNCE_MS = 250

/** Preset id → CSS module class carrying the preset's paint. */
const WALLPAPER_CLASSES = {
  ridge: css.ridge,
  coast: css.coast,
  garden: css.garden,
  arch: css.arch,
  custom: css.custom,
} as const

/** Built-in paint id for a Host preset. Retired `collage` and unknown ids
 * fall back to `ridge`; custom gallery ids are handled by the caller. */
function resolveWallpaperPreset(preset: WallpaperPreset): keyof typeof WALLPAPER_CLASSES {
  if (preset === 'coast' || preset === 'garden' || preset === 'arch' || preset === 'ridge') return preset
  return 'ridge'
}

/** One glassified lens the window-global renderer tracks (undocumented
 * surface, read-only intent): the shadow switch is re-driven across the
 * plugin's off/on cycle because the library has no lens teardown and its
 * shadow outlives the hidden canvas. */
interface LiquidGLLensHandle {
  options: GlassLookValues
  setShadow(enabled: boolean): void
}

/** The window-global renderer singleton the library keeps (undocumented
 * surface, read-only intent): the handles needed to silence it while the
 * toggle is off and to re-point its snapshot source at the live wallpaper,
 * because the library exposes no teardown, lens removal, or re-snapshot of a
 * replaced source element. */
interface LiquidGLRendererHandle {
  canvas: HTMLCanvasElement
  _rafId: number | null
  render: () => void
  snapshotTarget: Element
  captureSnapshot: () => unknown
  lenses: LiquidGLLensHandle[]
}

function rendererHandle(): LiquidGLRendererHandle | undefined {
  return (window as unknown as Record<'__liquidGLRenderer__', LiquidGLRendererHandle | undefined>)
    .__liquidGLRenderer__
}

/** Build the droplet glyph used by the dock button. */
function dropletIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M8 1.5c2.6 3.2 4.7 5.9 4.7 8.2a4.7 4.7 0 1 1-9.4 0C3.3 7.4 5.4 4.7 8 1.5Z')
  path.setAttribute('fill', 'currentColor')
  svg.append(path)
  return svg
}

/** The controller's user-visible state, published for the Settings card. */
export interface LiquidGlassSnapshot {
  /** Whether the theme is currently applied. */
  enabled: boolean
  /** Active wallpaper preset id. */
  preset: WallpaperPreset
  /** Object URLs of custom images on this device, oldest first. */
  gallery: readonly { id: string; url: string }[]
  /** Surface clarity in percent (0–100); 0 is the shipped calibration, 100
   * fades static surface fills to transparent over the wallpaper. */
  clarity: number
  /** Named look, or `custom` when the knobs match no calibration. */
  look: GlassLookId
  /** Live liquidGL knobs applied to the composer lens. */
  lookValues: GlassLookValues
}

/** Owns the overlay surfaces, the token layer, the glassified composer card,
 * and the user preferences. State lives in `#enabled`/`#preset`; the durable
 * source is the settings scope attached via `attachSettings` (writes go to
 * the Host document, adopted values come back through its subscription).
 * Until a scope attaches — or while it is unavailable — the defaults stand
 * and writes stay session-local. */
export class LiquidGlassController {
  readonly #theme: ThemeRuntime
  #copy: (key: LiquidGlassLocaleKey) => string
  /** Live user-visible state; the Settings card subscribes through the inject
   * hooks compartment so dock clicks and Settings writes stay in sync. */
  readonly snapshot: SnapshotStore<LiquidGlassSnapshot>
  #scope: SettingsScope<LiquidGlassHostSection> | undefined
  #enabled = true
  #preset: WallpaperPreset = 'ridge'
  /** Surface clarity in percent (0–100): 0 is the shipped calibration, 100
   * fades static surface fills to transparent. */
  #clarity = CLARITY_DEFAULT_PERCENT
  /** Live liquidGL look knobs. Defaults to the shipped `rich` calibration. */
  #look: GlassLookValues = { ...DEFAULT_LOOK_VALUES }
  /** Generation of the in-flight look persist. Host `set` republishes after
   * each field; a stale generation must not `#adopt` a half-applied bag, and
   * a newer persist must not let an older Promise.all reopen the gate. */
  #lookWriteGeneration = 0
  /** Custom images on this device, oldest first. */
  #gallery: { id: string; blob: Blob; url: string }[] = []
  #dock: HTMLButtonElement | undefined
  #tuning: HTMLDivElement | undefined
  #outsidePointer: ((event: Event) => void) | undefined
  #wallpaperHost: HTMLDivElement | undefined
  #wallpaper: HTMLDivElement | undefined
  /** Outgoing wallpaper clone fading out over a preset swap; removed when the
   * crossfade settles or is aborted. */
  #outgoing: HTMLDivElement | undefined
  #overlayRules: HTMLStyleElement | undefined
  #card: HTMLElement | undefined
  #savedCardStyle: string | null | undefined
  #lensCard: HTMLElement | undefined
  #observer: MutationObserver | undefined
  /** True while a settings dialog is covering the page; the lens parks then. */
  #dialogOpen = false
  #disposeLayer: (() => void) | undefined
  #scrollListener: ((event: Event) => void) | undefined
  #scrollPort: Element | undefined
  #parallaxAnchor: number | undefined
  #pressTimer: ReturnType<typeof setTimeout> | undefined
  #longPressed = false
  #clarityWriteTimer: ReturnType<typeof setTimeout> | undefined
  #lookWriteTimer: ReturnType<typeof setTimeout> | undefined
  #crossfadeTimer: ReturnType<typeof setTimeout> | undefined
  /** Object URL waiting to be revoked until the outgoing clone that still
   * paints it has been removed. */
  #pendingRevoke: string | undefined
  #removed = false

  /**
   * @param theme - the ui-theme service used to register the override layer.
   * @param copy - translator for dock and popover chrome; defaults to Chinese so
   * unit tests that construct the controller directly still have labels.
   */
  constructor(
    theme: ThemeRuntime,
    copy: (key: LiquidGlassLocaleKey) => string = (key) => zh[key],
  ) {
    this.#theme = theme
    this.#copy = copy
    this.snapshot = createSnapshotStore({
      enabled: this.#enabled, preset: this.#preset, gallery: [], clarity: this.#clarity,
      look: DEFAULT_LOOK, lookValues: { ...this.#look },
    })
  }

  /** Load every device-local custom image. A scope holding a `c_*` / `custom`
   * preset repaints once the matching blob is in memory. */
  async initCustomWallpaper(): Promise<void> {
    const records = await loadGallery()
    this.#gallery = records.map(record => ({
      id: record.id, blob: record.blob, url: URL.createObjectURL(record.blob),
    }))
    this.#publish()
    if (galleryIdFromPreset(this.#preset) !== undefined && this.#wallpaper !== undefined) {
      this.#crossfadeWallpaper()
    }
  }

  /**
   * Persist an uploaded image, append it to the gallery, and make it active.
   * @param blob - the image bytes to store device-local in IndexedDB.
   * @returns resolves once the image is stored and the preset switched.
   */
  async uploadCustomWallpaper(blob: Blob): Promise<void> {
    const record: GalleryRecord = await addGalleryImage(blob)
    this.#gallery = [...this.#gallery, { id: record.id, blob: record.blob, url: URL.createObjectURL(record.blob) }]
    this.setPreset(customPresetId(record.id))
  }

  /**
   * Remove one custom image. If it was active, fall back to `ridge`.
   * @param id - gallery record id.
   * @returns resolves once the record is gone.
   */
  async removeCustomWallpaper(id: string): Promise<void> {
    await removeGalleryImage(id)
    const gone = this.#gallery.find(entry => entry.id === id)
    this.#gallery = this.#gallery.filter(entry => entry.id !== id)
    if (gone !== undefined) {
      if (this.#outgoing !== undefined) this.#pendingRevoke = gone.url
      else URL.revokeObjectURL(gone.url)
    }
    if (galleryIdFromPreset(this.#preset) === id) this.setPreset('ridge')
    else this.#publish()
  }

  /**
   * Durable preference source: the plugin's settings namespace scope. While
   * absent (no Host connection yet) the defaults stand and writes stay
   * session-local; once attached, accepted sections are adopted onto the
   * surfaces and every write queues through the scope.
   * @param scope - the bound namespace scope, or undefined to detach.
   * @returns nothing; the subscription lives until the controller tears down.
   */
  attachSettings(scope: SettingsScope<LiquidGlassHostSection> | undefined): void {
    this.#scope = scope
    if (scope === undefined) return
    scope.subscribe(() => { this.#adopt() })
    this.#adopt()
  }

  /** Adopt an accepted Host section onto the surfaces. */
  #adopt(): void {
    if (this.#lookWriteGeneration !== 0) return
    const section = this.#scope?.getSnapshot()
    if (section === undefined || section.status !== 'ready' || section.value === undefined) return
    const value = section.value
    this.#setState({
      enabled: value.enabled,
      preset: value.preset as WallpaperPreset,
      clarity: value.clarity,
      look: {
        refraction: value.refraction,
        bevelDepth: value.bevelDepth,
        bevelWidth: value.bevelWidth,
        frost: value.frost,
        aberration: value.aberration,
        magnify: value.magnify,
        shadow: value.shadow,
        specular: value.specular,
      },
    })
  }

  /** The single state transition: applies surface diffs, publishes, and is
   * the only place enabled/preset/clarity/look change. */
  #setState(next: {
    enabled: boolean
    preset: WallpaperPreset
    clarity: number
    look: GlassLookValues
  }): void {
    if (next.enabled !== this.#enabled) this.#apply(next.enabled)
    if (next.preset !== this.#preset) {
      this.#preset = next.preset
      if (this.#wallpaper !== undefined) this.#crossfadeWallpaper()
    }
    if (next.clarity !== this.#clarity) {
      this.#clarity = next.clarity
      // The token layer only exists while enabled; the next enable registers
      // with the new clarity.
      if (this.#disposeLayer !== undefined) this.#registerLayer()
    }
    if (!sameLook(next.look, this.#look)) {
      this.#look = { ...next.look }
      this.#applyLook()
    }
    this.#enabled = next.enabled
    this.#publish()
  }

  /** Publish the live snapshot the Settings card renders from. */
  #publish(): void {
    this.snapshot.set({
      enabled: this.#enabled,
      preset: this.#preset,
      gallery: this.#gallery.map(entry => ({ id: entry.id, url: entry.url })),
      clarity: this.#clarity,
      look: lookIdFor(this.#look),
      lookValues: { ...this.#look },
    })
    this.#syncTuningPanel()
  }

  /**
   * Flip the theme from outside (dock button).
   * @returns nothing; the new state publishes through the snapshot store.
   */
  toggle(): void {
    this.setEnabled(!this.#enabled)
  }

  /**
   * Apply or remove the theme from outside (Settings card). No-op when the
   * state already holds the value.
   * @param enabled - whether the glass theme should be applied.
   * @returns nothing; the write queues through the attached scope.
   */
  setEnabled(enabled: boolean): void {
    if (this.#enabled === enabled) return
    this.#setState({ enabled, preset: this.#preset, clarity: this.#clarity, look: this.#look })
    void this.#scope?.set('enabled', enabled)
  }

  /**
   * Switch the wallpaper preset from outside (Settings card). No-op when the
   * state already holds the value.
   * @param preset - the preset id to activate.
   * @returns nothing; the write queues through the attached scope.
   */
  setPreset(preset: WallpaperPreset): void {
    if (this.#preset === preset) return
    this.#setState({ enabled: this.#enabled, preset, clarity: this.#clarity, look: this.#look })
    void this.#scope?.set('preset', preset)
  }

  /**
   * Scale the glass surface tint from outside (Settings card slider). Immediate
   * re-registration, debounced Host write.
   * @param percent - surface clarity in percent (0–100).
   * @returns nothing; the write queues debounced through the attached scope.
   */
  setClarity(percent: number): void {
    if (this.#clarity === percent) return
    this.#setState({ enabled: this.#enabled, preset: this.#preset, clarity: percent, look: this.#look })
    clearTimeout(this.#clarityWriteTimer)
    this.#clarityWriteTimer = setTimeout(() => {
      this.#clarityWriteTimer = undefined
      void this.#scope?.set('clarity', this.#clarity)
    }, SLIDER_WRITE_DEBOUNCE_MS)
  }

  /**
   * Apply a named look calibration from outside (Settings card picker).
   * Copies that bag onto the live knobs and persists every field.
   * @param id - a named look, never `custom` (the picker does not offer it).
   * @returns nothing; each knob queues through the attached scope.
   */
  setLook(id: NamedGlassLook): void {
    this.setLookValues(GLASS_LOOK_PRESETS[id])
  }

  /**
   * Apply a look bag from outside (advanced sliders). Immediate on the lens;
   * Host writes trail the gesture so a drag commits once.
   * @param values - the full knob bag to apply.
   * @returns nothing; the write queues debounced through the attached scope.
   */
  setLookValues(values: GlassLookValues): void {
    if (sameLook(values, this.#look)) return
    this.#setState({
      enabled: this.#enabled, preset: this.#preset, clarity: this.#clarity, look: values,
    })
    // Invalidate in-flight Host echoes immediately. Generation used to bump
    // only when `#persistLook` started, so a second click during the first
    // persist's Promise.all let that finally `#adopt` a half-written bag and
    // the sliders jumped.
    this.#lookWriteGeneration += 1
    clearTimeout(this.#lookWriteTimer)
    this.#lookWriteTimer = setTimeout(() => {
      this.#lookWriteTimer = undefined
      this.#persistLook()
    }, SLIDER_WRITE_DEBOUNCE_MS)
  }

  /** Persist every look knob through the attached scope. */
  #persistLook(): void {
    const scope = this.#scope
    const generation = this.#lookWriteGeneration
    if (scope === undefined) {
      this.#lookWriteGeneration = 0
      return
    }
    const snapshot = { ...this.#look }
    const writes = LOOK_KEYS.map(key => scope.set(key, snapshot[key]))
    void Promise.all(writes).finally(() => {
      if (generation !== this.#lookWriteGeneration) return
      this.#lookWriteGeneration = 0
      // Local look is already the bag we wrote; adopting here would paint
      // whatever the Host last republished, which can still be mid-batch.
    })
  }

  /** Whether the theme is currently applied. */
  get enabled(): boolean {
    return this.#enabled
  }

  /**
   * Recapture the wallpaper after a light/dark palette flip. The CSS
   * `:global(body[data-ds-dark-theme])` rules already repaint the live layer;
   * the lens texture does not, so without this the composer keeps refracting
   * the previous scheme. Two rAF ticks wait for that CSS to paint before the
   * rasteriser runs. No-op while the theme is off.
   */
  onPaletteChange(): void {
    if (!this.#enabled) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.#enabled) rendererHandle()?.captureSnapshot()
      })
    })
  }

  /**
   * Refresh dock and popover copy after the active locale switches. Dictionary
   * registrations do not call this — they bump LocaleFace revision for React
   * outlets, but this chrome is controller-owned DOM.
   */
  onLocaleChange(): void {
    if (this.#dock !== undefined) {
      this.#dock.setAttribute('aria-label', this.#copy('dockAria'))
      this.#dock.title = this.#copy('dockTitle')
    }
    if (this.#tuning === undefined) return
    this.#tuning.replaceChildren()
    this.#syncTuningPanel()
  }

  /**
   * Mount every surface for the controller's lifetime.
   * @returns the disposer that tears the dock, wallpaper, token layer, rules,
   * listeners, and observer down.
   */
  start(): () => void {
    this.#dock = document.createElement('button')
    this.#dock.type = 'button'
    this.#dock.className = css.dock
    this.#dock.dataset.dshLiquidGlassDock = ''
    this.#dock.setAttribute('aria-label', this.#copy('dockAria'))
    this.#dock.title = this.#copy('dockTitle')
    this.#dock.append(dropletIcon())
    this.#dock.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      this.#toggleTuningPanel()
    })
    this.#dock.addEventListener('click', () => {
      // A long press already did its own work (preset cycle); swallow the
      // click that always follows the pointer release.
      if (this.#longPressed) {
        this.#longPressed = false
        return
      }
      this.toggle()
    })
    this.#dock.addEventListener('pointerdown', () => {
      this.#pressTimer = setTimeout(() => {
        this.#pressTimer = undefined
        this.#longPressed = true
        this.#cycleWallpaper()
      }, LONG_PRESS_MS)
    })
    const cancelPress = (): void => { clearTimeout(this.#pressTimer) }
    this.#dock.addEventListener('pointerup', cancelPress)
    this.#dock.addEventListener('pointerleave', cancelPress)
    this.#dock.addEventListener('pointercancel', cancelPress)
    document.body.append(this.#dock)
    // The composer mounts after boot (the conversation plugin loads
    // dynamically) and can be remounted wholesale: keep watching so a fresh
    // card is glassified too. The callback early-returns while the current
    // card is still connected, so streaming renders cost one property read.
    this.#observer = new MutationObserver(() => {
      if (this.#enabled) this.#attachCard()
      this.#syncDialogPark()
    })
    this.#observer.observe(document.body, { childList: true, subtree: true })
    this.#apply(this.#enabled)
    return () => { this.#teardown() }
  }

  #apply(enabled: boolean): void {
    this.#dock?.classList.toggle(css.dockOff, !enabled)
    this.#dock?.setAttribute('aria-pressed', String(enabled))
    if (enabled) {
      this.#ensureWallpaper()
      this.#ensureOverlayRules()
      this.#registerLayer()
      this.#attachCard()
      this.#dialogOpen = document.querySelector(SETTINGS_DIALOG_SELECTOR) !== null
      if (this.#dialogOpen) this.#suspendRenderer()
      else this.#resumeRenderer()
      this.#ensureScrollSync()
    } else {
      this.#teardownScrollSync()
      this.#suspendRenderer()
      this.#disposeLayer?.()
      this.#disposeLayer = undefined
      // Hidden, not removed: the renderer's snapshot source is bound to this
      // exact element (and observed by its ResizeObserver) — removing it
      // would leave the next enable sampling a blank capture of a detached
      // node with nothing to trigger a fresh one.
      this.#abortCrossfade()
      if (this.#wallpaper !== undefined) this.#wallpaper.style.display = 'none'
      this.#overlayRules?.remove()
      this.#overlayRules = undefined
      this.#unglassCard()
    }
  }

  #ensureWallpaper(): void {
    if (this.#wallpaperHost === undefined) {
      const host = document.createElement('div')
      host.className = css.wallpaperHost
      document.body.prepend(host)
      this.#wallpaperHost = host
    }
    if (this.#wallpaper !== undefined) {
      this.#wallpaper.style.display = ''
      this.#applyWallpaperCanvas(this.#wallpaper)
      return
    }
    const wallpaper = document.createElement('div')
    this.#applyWallpaperPreset(wallpaper)
    wallpaper.setAttribute('data-dsh-liquid-glass-wallpaper', '')
    this.#wallpaperHost.append(wallpaper)
    this.#applyWallpaperCanvas(wallpaper)
    this.#wallpaper = wallpaper
  }

  /** Swap the live wallpaper onto the new preset. When a previous layer is
   * already on screen and motion is allowed, clone it as an outgoing overlay
   * that fades out over `WALLPAPER_CROSSFADE_MS` and recapture the refraction
   * snapshot only after that clone is gone — so the lens and the wallpaper
   * settle together. Rapid swaps abort the in-flight fade (the previous
   * outgoing clone is dropped immediately) so only one extra layer exists.
   * First paint, reduced-motion, and the theme-off path skip the fade. */
  #crossfadeWallpaper(): void {
    const wallpaper = this.#wallpaper
    /* v8 ignore next -- callers only invoke while a live wallpaper exists. */
    if (wallpaper === undefined) return
    const reduceMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches
    const host = this.#wallpaperHost
    const fade = this.#enabled && host !== undefined && !reduceMotion
      && wallpaper.style.display !== 'none'
    if (fade) {
      this.#abortCrossfade()
      const outgoing = wallpaper.cloneNode(true) as HTMLDivElement
      outgoing.removeAttribute('data-dsh-liquid-glass-wallpaper')
      outgoing.classList.add(css.outgoing)
      host.append(outgoing)
      this.#outgoing = outgoing
      // Double rAF: the clone has to paint at opacity 1 before the fade class
      // applies, otherwise the first interpolated frame is already 0.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (this.#outgoing !== outgoing) return
          outgoing.classList.add(css.outgoingFade)
        })
      })
      this.#crossfadeTimer = setTimeout(() => { this.#settleCrossfade() }, WALLPAPER_CROSSFADE_MS)
    }
    this.#applyWallpaperPreset(wallpaper)
    if (!fade && this.#enabled) rendererHandle()?.captureSnapshot()
  }

  /** Drop an in-flight outgoing clone without waiting for its timer. */
  #abortCrossfade(): void {
    clearTimeout(this.#crossfadeTimer)
    this.#crossfadeTimer = undefined
    this.#outgoing?.remove()
    this.#outgoing = undefined
    this.#flushPendingRevoke()
  }

  /** Finish a settled fade: drop the clone and recapture the now-visible scene. */
  #settleCrossfade(): void {
    this.#crossfadeTimer = undefined
    this.#outgoing?.remove()
    this.#outgoing = undefined
    this.#flushPendingRevoke()
    if (this.#enabled) rendererHandle()?.captureSnapshot()
  }

  /** Revoke an object URL that was held for an outgoing clone. */
  #flushPendingRevoke(): void {
    if (this.#pendingRevoke === undefined) return
    URL.revokeObjectURL(this.#pendingRevoke)
    this.#pendingRevoke = undefined
  }

  #applyWallpaperPreset(wallpaper: HTMLElement): void {
    // A custom preset without a loaded image (first boot before IndexedDB
    // answers, or another device) falls back to the default scene.
    const galleryId = galleryIdFromPreset(this.#preset)
    const custom = galleryId === undefined ? undefined : this.#gallery.find(entry => entry.id === galleryId)
    const preset = custom === undefined ? resolveWallpaperPreset(this.#preset) : 'custom'
    wallpaper.className = `${css.wallpaper} ${WALLPAPER_CLASSES[preset === 'custom' ? 'custom' : preset]}`
    if (custom !== undefined) {
      wallpaper.style.setProperty('--dsh-liquid-glass-custom-image', `url("${custom.url}")`)
    } else {
      wallpaper.style.removeProperty('--dsh-liquid-glass-custom-image')
    }
  }

  /** Advance to the next wallpaper in the gallery ring: built-ins, then every
   * device-local custom image. Crossfade, recapture, and publish happen in
   * `setPreset`. */
  #cycleWallpaper(): void {
    this.setPreset(nextWallpaperPreset(this.#preset, this.#gallery.map(entry => entry.id)))
  }

  /** Size the wallpaper as a canvas taller than the viewport by the parallax
   * headroom, split above and below, so the scroll-driven translation never
   * pulls an edge into view. Inline because the extent must match the JS
   * clamp constant exactly; the CSS module keeps only the static paint. */
  #applyWallpaperCanvas(wallpaper: HTMLElement): void {
    wallpaper.style.top = `${-PARALLAX_HEADROOM_VH / 2}vh`
    wallpaper.style.height = `calc(100% + ${PARALLAX_HEADROOM_VH}vh)`
  }

  /** Install the document-level capture scroll listener. Scroll events do not
   * bubble, but capture-phase delegation on `document` still sees them from
   * any descendant — one listener covers every remount of the conversation
   * scrollport with no per-element wiring or cleanup. */
  #ensureScrollSync(): void {
    document.addEventListener('scroll', this.#scrollListener ??= (event) => { this.#syncParallax(event) }, { capture: true })
  }

  /** Remove the scroll listener and the translation itself so the next enable
   * starts from the wallpaper's neutral position. */
  #teardownScrollSync(): void {
    if (this.#scrollListener !== undefined) {
      document.removeEventListener('scroll', this.#scrollListener, { capture: true })
      this.#scrollListener = undefined
    }
    this.#scrollPort = undefined
    this.#parallaxAnchor = undefined
    this.#wallpaper?.style.removeProperty('transform')
    this.#outgoing?.style.removeProperty('transform')
  }

  /** Translate the wallpaper against the conversation scroll at
   * `PARALLAX_COEFFICIENT`. The anchor resets when the scrollport element
   * changes (workspace switch), so the offset always measures travel from a
   * freshly observed position and stays inside the headroom no matter how
   * deep into the transcript the user starts. No snapshot recapture is
   * needed: the rasteriser bakes the texture in the wallpaper's own
   * coordinates (it inverts the element's current transform), and the lens
   * recomputes its sampling region from the live snapshot rect every frame —
   * a translated wallpaper is tracked automatically, and a recapture here
   * would only re-rasterize the full-resolution canvas mid-interaction. */
  #syncParallax(event: Event): void {
    const port = event.target
    // Exact match, not closest(): nested scrollers inside the conversation
    // (code blocks) must not drag the wallpaper, and unrelated scrollers
    // (sidebar lists) share this document-level listener.
    if (!(port instanceof Element) || !port.matches(SCROLL_SELECTOR)) return
    const wallpaper = this.#wallpaper
    /* v8 ignore next 2 -- unreachable: the listener is installed only while
       enabled and removed before the wallpaper is ever hidden or detached. */
    if (wallpaper === undefined) return
    if (port !== this.#scrollPort) {
      this.#scrollPort = port
      this.#parallaxAnchor = undefined
    }
    this.#parallaxAnchor ??= port.scrollTop
    const half = (window.innerHeight * PARALLAX_HEADROOM_VH) / 200
    const shift = Math.max(-half, Math.min(half, (this.#parallaxAnchor - port.scrollTop) * PARALLAX_COEFFICIENT))
    const transform = `translate3d(0, ${shift}px, 0)`
    wallpaper.style.transform = transform
    if (this.#outgoing !== undefined) this.#outgoing.style.transform = transform
  }

  /** Lift the composer seat above the library's body-level lens canvas in the
   * phases ui-conversation leaves it in plain flow (hero, settling; the
   * docked phase's own sticky + z-index 7 rule outranks the attribute-only
   * rule and already does the job), frost the sidebar column, and frost the
   * modal panels: the weak sidebar-fill and translucent layer-2 tokens alone
   * let the wallpaper's structure show sharply behind text, while the backdrop
   * blur turns it into a soft color wash — glass kinship without the noise.
   * The seat keeps its stock translucent fade band: transcript text scrolling
   * under the composer ghosts through the glass-token surfaces by design —
   * accepted, not masked. */
  #ensureOverlayRules(): void {
    if (this.#overlayRules !== undefined) return
    const rule = document.createElement('style')
    rule.textContent = [
      `${SEAT_SELECTOR}{position:relative;z-index:7}`,
      `${SIDEBAR_SELECTOR}{backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}`,
      `${MODAL_PANEL_SELECTOR}{backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}`,
      // The settings panel is already opaque: frost on it is a full-viewport
      // GPU pass that hitch hover/click with nothing to show for it.
      `${SETTINGS_DIALOG_SELECTOR}{backdrop-filter:none;-webkit-backdrop-filter:none}`,
      // Settings is a reading surface over dense transcript text: keep the
      // frost, but restore an opaque fill so the global clarity slider cannot
      // punch the conversation through the panel. Light/dark keyed off the
      // same body marker the wallpaper presets use.
      // Opaque reading fill, plus ink-on-paper hover/active on this node only:
      // the global glass nav tokens are white, which vanishes on #fff.
      `${SETTINGS_DIALOG_SELECTOR}{background:#fff;--dsw-specific-sidebar-nav-item-hover:rgba(15,17,21,0.06);--dsw-specific-sidebar-nav-item-active:rgba(15,17,21,0.10)}`,
      `${SETTINGS_DIALOG_SELECTOR} button{transition:background-color 120ms ease}`,
      `body[data-ds-dark-theme] ${SETTINGS_DIALOG_SELECTOR}{background:#1c1e24;--dsw-specific-sidebar-nav-item-hover:rgba(255,255,255,0.07);--dsw-specific-sidebar-nav-item-active:rgba(255,255,255,0.10)}`,
      `${PORTAL_MENU_SELECTOR}{background:#fff}`,
      `body[data-ds-dark-theme] ${PORTAL_MENU_SELECTOR}{background:#1c1e24}`,
    ].join('')
    document.head.append(rule)
    this.#overlayRules = rule
  }

  /** (Re-)register the alias-token override layer for the current clarity:
   * the seq-ordered override stack has no replace-by-id, so a clarity change
   * disposes its own previous layer and registers the scaled one. */
  #registerLayer(): void {
    this.#disposeLayer?.()
    this.#disposeLayer = this.#theme.overrideTokens(PACKAGE_ID, scaleSurfaceTokens(LIQUID_GLASS_TOKENS, this.#clarity))
  }

  /** Push the live look onto every tracked lens. Numeric knobs are uniforms
   * the renderer reads from `lens.options` each frame, so a field write is
   * enough. `setShadow` tears down and rebuilds the library's drop-shadow
   * DOM — only call it when the flag actually flips, otherwise switching
   * restrained/standard/rich hitch the popover sliders. */
  #applyLook(): void {
    const renderer = rendererHandle()
    if (renderer === undefined) return
    for (const lens of renderer.lenses) {
      const shadowWas = lens.options.shadow
      Object.assign(lens.options, this.#look)
      if (shadowWas !== this.#look.shadow) lens.setShadow(this.#look.shadow)
    }
  }

  /** Give the composer card to liquidGL. The library cannot remove a lens, so
   * one card node is glassified exactly once per page; later attachments only
   * re-apply the fill-stripping styles, and a remounted card gets a fresh
   * lens (the orphaned one draws nothing on its detached node). */
  #attachCard(): void {
    if (this.#card?.isConnected) return
    const card = document.querySelector<HTMLElement>(COMPOSER_SELECTOR)
    if (!card) return
    if (this.#card !== card) this.#savedCardStyle = undefined
    this.#card = card
    this.#applyGlassFill(card)
    if (this.#lensCard !== card) {
      this.#lensCard = card
      try {
        liquidGL({ ...GL_FIXED, ...this.#look })
      } catch (error) {
        // Marked attempted even on failure: a retry on every DOM mutation
        // would storm, and the library's own no-WebGL path handles the common
        // degradation before this constructor can throw.
        this.#unglassCard()
        console.warn('ui-liquid-glass: liquidGL unavailable; the composer keeps its token fill', error)
      }
    }
    // The library points the target at itself (decorative-pane default), but
    // the composer is interactive stock UI: restore hit-testing after the
    // lens constructor has run so the textarea and buttons stay clickable.
    // The card's token shadow needs no stripping: the constructor's
    // setShadow(true) overwrites it inline with the library's own.
    card.style.pointerEvents = 'auto'
  }

  /** Strip the card's token fill inline so the lens canvas below the seat
   * shows through. React never writes the card's style attribute after mount,
   * so the edit persists; `#unglassCard` puts the original back. */
  #applyGlassFill(card: HTMLElement): void {
    this.#savedCardStyle ??= card.getAttribute('style')
    card.style.background = 'transparent'
    card.style.backgroundImage = 'none'
    card.style.backdropFilter = 'none'
    card.style.setProperty('-webkit-backdrop-filter', 'none')
    card.setAttribute(GLASS_MARKER, '')
  }

  /** Restore the card's pre-glass state: its own fill, and no marker. The
   * card reference clears with the fill so the next enable re-attaches (the
   * connected-card guard in `#attachCard` would otherwise skip it). */
  #unglassCard(): void {
    const card = this.#card
    if (card === undefined) return
    if (this.#savedCardStyle === null) card.removeAttribute('style')
    else if (this.#savedCardStyle !== undefined) card.setAttribute('style', this.#savedCardStyle)
    card.removeAttribute(GLASS_MARKER)
    this.#savedCardStyle = undefined
    this.#card = undefined
  }

  /** Silence the shared renderer while off: hide its canvas, park its rAF
   * loop, and switch every lens's shadow off — the shadow is a fixed element
   * on body plus an inline boxShadow on the card, so hiding the canvas alone
   * would leave it floating over the un-glassed page. The renderer itself
   * outlives the plugin either way (library design) — this only stops it
   * painting. */
  #suspendRenderer(): void {
    const renderer = rendererHandle()
    if (renderer === undefined) return
    renderer.canvas.style.display = 'none'
    if (renderer._rafId) {
      cancelAnimationFrame(renderer._rafId)
      renderer._rafId = null
    }
    for (const lens of renderer.lenses) lens.setShadow(false)
  }

  /** Park the lens while a settings dialog covers the page. The composer is
   * hidden behind an opaque panel, so a 2× wallpaper snapshot + rAF loop only
   * fights the hover paint. Closing the dialog resumes if the theme is on. */
  #syncDialogPark(): void {
    const open = document.querySelector(SETTINGS_DIALOG_SELECTOR) !== null
    if (open === this.#dialogOpen) return
    this.#dialogOpen = open
    if (open) this.#suspendRenderer()
    else if (this.#enabled) this.#resumeRenderer()
  }

  #resumeRenderer(): void {
    const renderer = rendererHandle()
    if (renderer === undefined) return
    renderer.canvas.style.display = ''
    // Re-drive the shadow: the off cycle removed the shadow element and the
    // card's inline shadow went with its restored style attribute; the lens
    // still exists, so the switch re-applies both in one call.
    for (const lens of renderer.lenses) lens.setShadow(this.#look.shadow)
    // The renderer binds its snapshot source once at construction. After an
    // off cycle hid the wallpaper — or a teardown+restart replaced it — that
    // element can be detached, and the lens would sample a stale blank
    // capture forever: re-point at the live wallpaper and force a re-snapshot.
    const wallpaper = document.querySelector(WALLPAPER_SELECTOR)
    if (wallpaper !== null && renderer.snapshotTarget !== wallpaper) {
      renderer.snapshotTarget = wallpaper
    }
    renderer.captureSnapshot()
    if (!renderer._rafId) {
      const loop = (): void => {
        renderer.render()
        renderer._rafId = requestAnimationFrame(loop)
      }
      renderer._rafId = requestAnimationFrame(loop)
    }
  }

  /** Open or close the dock's right-click look panel. */
  #toggleTuningPanel(): void {
    if (this.#tuning !== undefined) this.#closeTuningPanel()
    else this.#openTuningPanel()
  }

  /** Mount the look-tuning popover above the dock. */
  #openTuningPanel(): void {
    if (this.#tuning !== undefined) return
    const panel = document.createElement('div')
    panel.className = css.tuning
    panel.setAttribute('data-dsh-liquid-glass-tuning', '')
    panel.addEventListener('pointerdown', (event) => { event.stopPropagation() })
    document.body.append(panel)
    this.#tuning = panel
    this.#syncTuningPanel()
    this.#outsidePointer = (event) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (this.#tuning?.contains(target) === true) return
      if (this.#dock?.contains(target) === true) return
      this.#closeTuningPanel()
    }
    // pointerup, not pointerdown: a range thumb's drag fires document
    // pointerdown (and, on some browsers, retargets outside the input),
    // which would close the panel mid-gesture.
    document.addEventListener('pointerup', this.#outsidePointer)
  }

  /** Drop the popover and its outside-click listener. */
  #closeTuningPanel(): void {
    if (this.#outsidePointer !== undefined) {
      document.removeEventListener('pointerup', this.#outsidePointer)
      this.#outsidePointer = undefined
    }
    this.#tuning?.remove()
    this.#tuning = undefined
  }

  /** Keep the popover in sync with the live look bag. First call builds the
   * controls; later calls only write values so a drag is not torn down. */
  #syncTuningPanel(): void {
    const panel = this.#tuning
    if (panel === undefined) return
    if (panel.childElementCount === 0) this.#buildTuningPanel(panel)
    for (const key of GLASS_LOOK_SLIDER_KEYS) {
      const input = panel.querySelector(`input[data-knob="${key}"]`)
      if (input instanceof HTMLInputElement && input !== document.activeElement) {
        input.value = String(this.#look[key])
      }
      const readout = input?.parentElement?.querySelector(`.${css.settingsSliderValue}`)
      if (readout instanceof HTMLElement) readout.textContent = formatKnob(this.#look[key])
    }
    const look = lookIdFor(this.#look)
    for (const id of GLASS_LOOKS) {
      const button = panel.querySelector(`button[data-look="${id}"]`)
      if (button instanceof HTMLButtonElement) button.setAttribute('aria-pressed', String(look === id))
    }
    this.#syncTuningSwitch(panel, this.#copy('knobShadow'), 'shadow')
    this.#syncTuningSwitch(panel, this.#copy('knobSpecular'), 'specular')
    const clarity = panel.querySelector('input[data-knob="clarity"]')
    if (clarity instanceof HTMLInputElement && clarity !== document.activeElement) {
      clarity.value = String(this.#clarity)
    }
    const clarityReadout = clarity?.parentElement?.querySelector(`.${css.settingsSliderValue}`)
    if (clarityReadout instanceof HTMLElement) clarityReadout.textContent = `${this.#clarity}%`
  }

  /** Build the popover controls once. */
  #buildTuningPanel(panel: HTMLDivElement): void {
    const title = document.createElement('div')
    title.className = css.tuningTitle
    title.textContent = this.#copy('tuningTitle')
    panel.append(title)
    const looks = document.createElement('div')
    looks.className = css.tuningLooks
    const current = lookIdFor(this.#look)
    for (const id of GLASS_LOOKS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = css.tuningLook
      button.dataset.look = id
      button.textContent = this.#copy(LOOK_COPY[id])
      button.setAttribute('aria-pressed', String(current === id))
      button.addEventListener('click', () => { this.setLook(id) })
      looks.append(button)
    }
    panel.append(looks)
    for (const key of GLASS_LOOK_SLIDER_KEYS) {
      const spec = GLASS_LOOK_SLIDERS[key]
      const row = document.createElement('div')
      row.className = css.tuningRow
      const label = document.createElement('span')
      label.className = css.tuningLabel
      label.textContent = this.#copy(KNOB_COPY[key])
      const input = document.createElement('input')
      input.type = 'range'
      input.className = css.settingsSlider
      input.min = String(spec.min)
      input.max = String(spec.max)
      input.step = String(spec.step)
      input.value = String(this.#look[key])
      input.dataset.knob = key
      input.setAttribute('aria-label', this.#copy(KNOB_COPY[key]))
      const readout = document.createElement('span')
      readout.className = css.settingsSliderValue
      readout.textContent = formatKnob(this.#look[key])
      input.addEventListener('input', () => {
        this.setLookValues({ ...this.#look, [key]: Number(input.value) })
      })
      row.append(label, input, readout)
      panel.append(row)
    }
    const clarityRow = document.createElement('div')
    clarityRow.className = css.tuningRow
    const clarityLabel = document.createElement('span')
    clarityLabel.className = css.tuningLabel
    clarityLabel.textContent = this.#copy('clarityTitle')
    const clarityInput = document.createElement('input')
    clarityInput.type = 'range'
    clarityInput.className = css.settingsSlider
    clarityInput.min = '0'
    clarityInput.max = '100'
    clarityInput.step = '5'
    clarityInput.value = String(this.#clarity)
    clarityInput.dataset.knob = 'clarity'
    clarityInput.setAttribute('aria-label', this.#copy('clarityTitle'))
    const clarityReadout = document.createElement('span')
    clarityReadout.className = css.settingsSliderValue
    clarityReadout.textContent = `${this.#clarity}%`
    clarityInput.addEventListener('input', () => {
      this.setClarity(Number(clarityInput.value))
    })
    clarityRow.append(clarityLabel, clarityInput, clarityReadout)
    panel.append(clarityRow)
    const switches = document.createElement('div')
    switches.className = css.tuningSwitches
    switches.append(
      this.#tuningSwitch(this.#copy('knobShadow'), 'shadow'),
      this.#tuningSwitch(this.#copy('knobSpecular'), 'specular'),
    )
    panel.append(switches)
  }

  /** Refresh one compact switch without replacing the button. */
  #syncTuningSwitch(panel: HTMLDivElement, labelText: string, key: 'shadow' | 'specular'): void {
    for (const button of panel.querySelectorAll(`.${css.tuningSwitch}`)) {
      if (!(button instanceof HTMLButtonElement)) continue
      if (button.dataset.switch !== key) continue
      const on = this.#look[key]
      button.setAttribute('aria-pressed', String(on))
      button.textContent = `${labelText} ${on ? this.#copy('switchOn') : this.#copy('switchOff')}`
    }
  }

  /** Compact on/off chip in the tuning popover. */
  #tuningSwitch(labelText: string, key: 'shadow' | 'specular'): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = css.tuningSwitch
    button.dataset.switch = key
    const on = this.#look[key]
    button.setAttribute('aria-pressed', String(on))
    button.textContent = `${labelText} ${on ? this.#copy('switchOn') : this.#copy('switchOff')}`
    button.addEventListener('click', () => {
      this.setLookValues({ ...this.#look, [key]: !this.#look[key] })
    })
    return button
  }

  #teardown(): void {
    if (this.#removed) return
    this.#removed = true
    this.#observer?.disconnect()
    this.#observer = undefined
    this.#dialogOpen = false
    clearTimeout(this.#pressTimer)
    clearTimeout(this.#clarityWriteTimer)
    clearTimeout(this.#lookWriteTimer)
    this.#abortCrossfade()
    this.#teardownScrollSync()
    this.#suspendRenderer()
    this.#disposeLayer?.()
    this.#disposeLayer = undefined
    this.#closeTuningPanel()
    this.#dock?.remove()
    this.#dock = undefined
    for (const entry of this.#gallery) URL.revokeObjectURL(entry.url)
    this.#gallery = []
    this.#wallpaperHost?.remove()
    this.#wallpaperHost = undefined
    this.#wallpaper = undefined
    this.#overlayRules?.remove()
    this.#overlayRules = undefined
    this.#unglassCard()
    this.#card = undefined
    this.#lensCard = undefined
  }
}
