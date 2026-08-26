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
import { loadCustomWallpaper, saveCustomWallpaper } from './wallpaper-store.ts'
import {
  CLARITY_DEFAULT_PERCENT, COMPOSER_SELECTOR, GLASS_MARKER, LIQUID_GLASS_TOKENS,
  MODAL_PANEL_SELECTOR, PACKAGE_ID, SCROLL_SELECTOR, SEAT_SELECTOR,
  SIDEBAR_SELECTOR, VEIL_DEFAULT_PERCENT, VEIL_VAR, WALLPAPER_PRESETS,
  WALLPAPER_SELECTOR,
} from '../tokens.ts'
import { scaleSurfaceTokens } from '../tokens.ts'
import type { WallpaperPreset } from '../tokens.ts'

/** liquidGL tuning: the demo-5 look with the dial turned up — a clearly
 * visible center refraction, a deep wide bevel rim, no frost, and the
 * library's drop shadow. Stronger than demo-5 because at surface clarity 100
 * the card sits on the raw wallpaper with no milky contrast around it, so the
 * bend has to read on its own. Full snapshot resolution keeps the rim crisp
 * on HiDPI. */
const GL_OPTIONS = {
  target: COMPOSER_SELECTOR,
  snapshot: WALLPAPER_SELECTOR,
  resolution: 2.0,
  refraction: 0.06,
  aberration: 0,
  bevelDepth: 0.18,
  bevelWidth: 0.09,
  frost: 0,
  magnify: 1,
  shadow: true,
  specular: true,
  reveal: 'fade',
  tilt: false,
} as const

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

/** The veil and clarity sliders fire an input event per drag tick; the Host
 * document write trails the last one so the wire sees one commit per gesture.
 * The local surfaces apply immediately either way. */
const SLIDER_WRITE_DEBOUNCE_MS = 250

/** Preset id → CSS module class carrying the preset's paint. */
const WALLPAPER_CLASSES: Record<WallpaperPreset, string> = {
  ridge: css.ridge,
  collage: css.collage,
  custom: css.custom,
}

/** One glassified lens the window-global renderer tracks (undocumented
 * surface, read-only intent): the shadow switch is re-driven across the
 * plugin's off/on cycle because the library has no lens teardown and its
 * shadow outlives the hidden canvas. */
interface LiquidGLLensHandle {
  options: { shadow: boolean }
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
  /** Whether a custom image has been uploaded on this device. */
  custom: boolean
  /** Custom-image veil strength in percent (0–100); 100 is the shipped
   * calibration, 0 shows the raw image. */
  veil: number
  /** Surface clarity in percent (0–100); 0 is the shipped calibration, 100
   * fades static surface fills to transparent over the wallpaper. */
  clarity: number
}

/** Owns the overlay surfaces, the token layer, the glassified composer card,
 * and the user preferences. State lives in `#enabled`/`#preset`; the durable
 * source is the settings scope attached via `attachSettings` (writes go to
 * the Host document, adopted values come back through its subscription).
 * Until a scope attaches — or while it is unavailable — the defaults stand
 * and writes stay session-local. */
export class LiquidGlassController {
  readonly #theme: ThemeRuntime
  /** Live user-visible state; the Settings card subscribes through the inject
   * hooks compartment so dock clicks and Settings writes stay in sync. */
  readonly snapshot: SnapshotStore<LiquidGlassSnapshot>
  #scope: SettingsScope<LiquidGlassSnapshot> | undefined
  #enabled = true
  #preset: WallpaperPreset = 'ridge'
  /** Custom-image veil strength in percent (0–100). */
  #veil = VEIL_DEFAULT_PERCENT
  /** Surface clarity in percent (0–100): 0 is the shipped calibration, 100
   * fades static surface fills to transparent. */
  #clarity = CLARITY_DEFAULT_PERCENT
  /** Object URL of the uploaded custom image; undefined until one loads or is
   * uploaded on this device. */
  #customUrl: string | undefined
  #dock: HTMLButtonElement | undefined
  #wallpaperHost: HTMLDivElement | undefined
  #wallpaper: HTMLDivElement | undefined
  #overlayRules: HTMLStyleElement | undefined
  #card: HTMLElement | undefined
  #savedCardStyle: string | null | undefined
  #lensCard: HTMLElement | undefined
  #observer: MutationObserver | undefined
  #disposeLayer: (() => void) | undefined
  #scrollListener: ((event: Event) => void) | undefined
  #scrollPort: Element | undefined
  #parallaxAnchor: number | undefined
  #pressTimer: ReturnType<typeof setTimeout> | undefined
  #longPressed = false
  #veilWriteTimer: ReturnType<typeof setTimeout> | undefined
  #clarityWriteTimer: ReturnType<typeof setTimeout> | undefined
  #removed = false

  constructor(theme: ThemeRuntime) {
    this.#theme = theme
    this.snapshot = createSnapshotStore({
      enabled: this.#enabled, preset: this.#preset, custom: false, veil: this.#veil, clarity: this.#clarity,
    })
  }

  /** Load the device-local custom image, if one was uploaded before. The
   * snapshot's `custom` flag flips once it exists; a scope holding
   * `preset: 'custom'` repaints at that point. */
  async initCustomWallpaper(): Promise<void> {
    const blob = await loadCustomWallpaper()
    if (blob === undefined) return
    this.#customUrl = URL.createObjectURL(blob)
    this.snapshot.set({
      enabled: this.#enabled,
      preset: this.#preset,
      custom: true,
      veil: this.#veil,
      clarity: this.#clarity,
    })
    if (this.#preset === 'custom' && this.#wallpaper !== undefined) {
      this.#applyWallpaperPreset(this.#wallpaper)
    }
  }

  /**
   * Persist an uploaded image and make it the active preset. The previous
   * object URL is revoked only after the repaint switched to the new one.
   * @param blob - the image bytes to store device-local in IndexedDB.
   * @returns resolves once the image is stored and the preset switched.
   */
  async uploadCustomWallpaper(blob: Blob): Promise<void> {
    await saveCustomWallpaper(blob)
    const previous = this.#customUrl
    this.#customUrl = URL.createObjectURL(blob)
    this.setPreset('custom')
    if (previous !== undefined) URL.revokeObjectURL(previous)
  }

  /**
   * Durable preference source: the plugin's settings namespace scope. While
   * absent (no Host connection yet) the defaults stand and writes stay
   * session-local; once attached, accepted sections are adopted onto the
   * surfaces and every write queues through the scope.
   * @param scope - the bound namespace scope, or undefined to detach.
   * @returns nothing; the subscription lives until the controller tears down.
   */
  attachSettings(scope: SettingsScope<LiquidGlassSnapshot> | undefined): void {
    this.#scope = scope
    if (scope === undefined) return
    scope.subscribe(() => { this.#adopt() })
    this.#adopt()
  }

  /** Adopt an accepted Host section onto the surfaces. */
  #adopt(): void {
    const section = this.#scope?.getSnapshot()
    if (section === undefined || section.status !== 'ready' || section.value === undefined) return
    this.#setState(section.value.enabled, section.value.preset, section.value.veil, section.value.clarity)
  }

  /** The single state transition: applies surface diffs, publishes, and is
   * the only place the enabled/preset/veil/clarity quadruple changes. */
  #setState(enabled: boolean, preset: WallpaperPreset, veil: number, clarity: number): void {
    if (enabled !== this.#enabled) this.#apply(enabled)
    if (preset !== this.#preset) {
      this.#preset = preset
      if (this.#wallpaper !== undefined) this.#applyWallpaperPreset(this.#wallpaper)
      if (this.#enabled) rendererHandle()?.captureSnapshot()
    }
    if (veil !== this.#veil) {
      this.#veil = veil
      if (this.#wallpaper !== undefined) this.#applyVeil(this.#wallpaper)
    }
    if (clarity !== this.#clarity) {
      this.#clarity = clarity
      // The token layer only exists while enabled; the next enable registers
      // with the new clarity.
      if (this.#disposeLayer !== undefined) this.#registerLayer()
    }
    this.#enabled = enabled
    this.snapshot.set({
      enabled: this.#enabled,
      preset: this.#preset,
      custom: this.#customUrl !== undefined,
      veil: this.#veil,
      clarity: this.#clarity,
    })
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
    this.#setState(enabled, this.#preset, this.#veil, this.#clarity)
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
    this.#setState(this.#enabled, preset, this.#veil, this.#clarity)
    void this.#scope?.set('preset', preset)
  }

  /**
   * Scale the custom-image veil from outside (Settings card slider). The
   * surface applies immediately; the Host document write trails the gesture
   * (see `SLIDER_WRITE_DEBOUNCE_MS`). No-op when the state already holds the
   * value.
   * @param percent - veil strength in percent (0–100).
   * @returns nothing; the write queues debounced through the attached scope.
   */
  setVeil(percent: number): void {
    if (this.#veil === percent) return
    this.#setState(this.#enabled, this.#preset, percent, this.#clarity)
    clearTimeout(this.#veilWriteTimer)
    this.#veilWriteTimer = setTimeout(() => {
      this.#veilWriteTimer = undefined
      void this.#scope?.set('veil', this.#veil)
    }, SLIDER_WRITE_DEBOUNCE_MS)
  }

  /**
   * Scale the glass surface tint from outside (Settings card slider). Same
   * shape as `setVeil`: immediate re-registration, debounced Host write.
   * @param percent - surface clarity in percent (0–100).
   * @returns nothing; the write queues debounced through the attached scope.
   */
  setClarity(percent: number): void {
    if (this.#clarity === percent) return
    this.#setState(this.#enabled, this.#preset, this.#veil, percent)
    clearTimeout(this.#clarityWriteTimer)
    this.#clarityWriteTimer = setTimeout(() => {
      this.#clarityWriteTimer = undefined
      void this.#scope?.set('clarity', this.#clarity)
    }, SLIDER_WRITE_DEBOUNCE_MS)
  }

  /** Whether the theme is currently applied. */
  get enabled(): boolean {
    return this.#enabled
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
    this.#dock.setAttribute('aria-label', '切换液态玻璃效果')
    this.#dock.title = '液态玻璃效果（长按切换壁纸）'
    this.#dock.append(dropletIcon())
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
      this.#resumeRenderer()
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

  #applyWallpaperPreset(wallpaper: HTMLElement): void {
    // A custom preset without a loaded image (first boot before IndexedDB
    // answers, or another device) falls back to the default scene.
    const preset = this.#preset === 'custom' && this.#customUrl === undefined ? 'ridge' : this.#preset
    wallpaper.className = `${css.wallpaper} ${WALLPAPER_CLASSES[preset]}`
    this.#applyVeil(wallpaper)
    if (preset === 'custom') {
      wallpaper.style.setProperty('--dsh-liquid-glass-custom-image', `url("${this.#customUrl}")`)
    } else {
      wallpaper.style.removeProperty('--dsh-liquid-glass-custom-image')
    }
  }

  /** Carry the current veil strength onto the wallpaper; only the custom
   * preset's gradient reads the variable, the others ignore it. */
  #applyVeil(wallpaper: HTMLElement): void {
    wallpaper.style.setProperty(VEIL_VAR, String(this.#veil / 100))
  }

  /** Advance to the next preset — the dock's write path with wrap around;
   * repaint, recapture, and publish happen in `setPreset`. Cycling walks the
   * built-in presets only: landing on `custom` without an uploaded image
   * would fall straight back. */
  #cycleWallpaper(): void {
    const index = WALLPAPER_PRESETS.indexOf(this.#preset as (typeof WALLPAPER_PRESETS)[number])
    const next = WALLPAPER_PRESETS[(index + 1) % WALLPAPER_PRESETS.length] ?? WALLPAPER_PRESETS[0]
    this.setPreset(next)
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
    wallpaper.style.transform = `translate3d(0, ${shift}px, 0)`
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
        liquidGL({ ...GL_OPTIONS })
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
    for (const lens of renderer.lenses) {
      if (lens.options.shadow) lens.setShadow(false)
    }
  }

  #resumeRenderer(): void {
    const renderer = rendererHandle()
    if (renderer === undefined) return
    renderer.canvas.style.display = ''
    // Re-drive the shadow: the off cycle removed the shadow element and the
    // card's inline shadow went with its restored style attribute; the lens
    // still exists, so the switch re-applies both in one call.
    for (const lens of renderer.lenses) {
      if (lens.options.shadow) lens.setShadow(true)
    }
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

  #teardown(): void {
    if (this.#removed) return
    this.#removed = true
    this.#observer?.disconnect()
    this.#observer = undefined
    clearTimeout(this.#pressTimer)
    clearTimeout(this.#veilWriteTimer)
    clearTimeout(this.#clarityWriteTimer)
    this.#teardownScrollSync()
    this.#suspendRenderer()
    this.#disposeLayer?.()
    this.#disposeLayer = undefined
    this.#dock?.remove()
    this.#dock = undefined
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
