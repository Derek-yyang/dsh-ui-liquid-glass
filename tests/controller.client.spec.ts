/** Controller behavior: deferred card attachment, toggle persistence, surface
 * lifecycle, scroll-synced wallpaper, and teardown. Every test disposes in
 * `finally`: a leaked controller's MutationObserver would keep glassifying
 * later tests' cards. */
// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { liquidGLMock } = vi.hoisted(() => ({
  liquidGLMock: vi.fn<(options: unknown) => { el: null }>(() => ({ el: null })),
}))

vi.mock('liquid-gl', () => ({
  default: Object.assign(liquidGLMock, { registerDynamic: vi.fn() }),
}))

import { LiquidGlassController } from '../src/client/controller.ts'
import type { LiquidGlassSnapshot } from '../src/client/controller.ts'
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import css from '../src/client/glass.module.css'
import {
  COMPOSER_SELECTOR, GLASS_MARKER, LIQUID_GLASS_TOKENS, MODAL_PANEL_SELECTOR,
  PACKAGE_ID, PORTAL_MENU_SELECTOR, SEAT_SELECTOR, SETTINGS_DIALOG_SELECTOR, SIDEBAR_SELECTOR, TUNING_PANEL_SELECTOR, VEIL_VAR, WALLPAPER_SELECTOR,
} from '../src/tokens.ts'
import { DEFAULT_LOOK, GLASS_LOOK_PRESETS } from '../src/look.ts'
import type { LiquidGlassHostSection } from '../src/look.ts'

const RICH = GLASS_LOOK_PRESETS[DEFAULT_LOOK]

function hostSection(
  partial: Partial<LiquidGlassHostSection> & Pick<LiquidGlassHostSection, 'enabled' | 'preset'>,
): LiquidGlassHostSection {
  return { veil: 100, clarity: 0, ...RICH, ...partial }
}

function published(partial: Partial<LiquidGlassSnapshot> & Pick<LiquidGlassSnapshot, 'enabled' | 'preset'>): LiquidGlassSnapshot {
  return {
    custom: false, veil: 100, clarity: 0, look: DEFAULT_LOOK, lookValues: { ...RICH }, ...partial,
  }
}

function bench() {
  const ctx = new Context()
  const disposeLayer = vi.fn()
  const overrideTokens = vi.fn((_id: string, _tokens: ThemeTokenOverrides) => disposeLayer)
  ctx.provide('theme', { overrideTokens } as unknown as ThemeRuntime)
  const controller = new LiquidGlassController(ctx.theme)
  return { controller, overrideTokens, disposeLayer }
}

/** A settings scope stub standing `ready` with the given section; records
 * field writes and republishes on `set`. */
function scopeStub(section: LiquidGlassHostSection) {
  let value = { ...section }
  const listeners = new Set<() => void>()
  const writes: Array<[string, unknown]> = []
  const scope = {
    getSnapshot: () => ({
      status: 'ready' as const,
      value,
      base: undefined,
      user: undefined,
      revision: 1,
      writable: true,
      mode: 'host' as const,
    }),
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (field: string, next: unknown): Promise<void> => {
      writes.push([field, next])
      value = { ...value, [field]: next }
      for (const listener of [...listeners]) listener()
      return Promise.resolve()
    },
    unset: (): Promise<void> => Promise.resolve(),
  }
  return { scope: scope as unknown as SettingsScope<LiquidGlassHostSection>, writes }
}

/** Install a renderer handle so recapture scheduling can be observed. */
function installRenderer() {
  const captures = { count: 0 }
  const lens = {
    options: { ...RICH },
    setShadow: vi.fn((enabled: boolean) => { lens.options.shadow = enabled }),
  }
  ;(window as unknown as Record<'__liquidGLRenderer__', unknown>).__liquidGLRenderer__ = {
    canvas: document.createElement('canvas'),
    _rafId: 0,
    render: () => {},
    snapshotTarget: null,
    captureSnapshot: () => { captures.count += 1 },
    lenses: [lens],
  }
  return { captures, lens }
}

/** Mount a stand-in conversation scrollport at the given scroll position.
 * scrollTop is defined directly: jsdom has no layout to produce one. */
function mountScroller(scrollTop: number): HTMLElement {
  const scroller = document.createElement('div')
  scroller.setAttribute('data-conversation-scroll', '')
  Object.defineProperty(scroller, 'scrollTop', { value: scrollTop, configurable: true })
  document.body.append(scroller)
  return scroller
}

function setScrollTop(scroller: HTMLElement, value: number): void {
  Object.defineProperty(scroller, 'scrollTop', { value, configurable: true })
}

function dispatchScroll(target: EventTarget): void {
  target.dispatchEvent(new Event('scroll'))
}

/** Mount a stand-in composer card carrying its own token fill. */
function mountCard(): HTMLElement {
  const card = document.createElement('div')
  card.setAttribute('data-composer-card', '')
  card.style.background = 'rgb(255, 255, 255)'
  document.body.append(card)
  return card
}

beforeEach(() => {
  localStorage.clear()
  liquidGLMock.mockClear()
  delete (window as unknown as Record<string, unknown>).__liquidGLRenderer__
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

describe('LiquidGlassController', () => {
  it('starts enabled: surfaces mounted, token layer registered, dock pressed, glass deferred until the card mounts', () => {
    const { controller, overrideTokens } = bench()
    const dispose = controller.start()
    try {
      expect(overrideTokens).toHaveBeenCalledTimes(1)
      expect(overrideTokens).toHaveBeenCalledWith(PACKAGE_ID, LIQUID_GLASS_TOKENS)
      expect(document.querySelector(WALLPAPER_SELECTOR)).not.toBeNull()
      expect(document.querySelector('style')?.textContent).toContain(SEAT_SELECTOR)
      expect(document.querySelector('style')?.textContent).toContain(`${SIDEBAR_SELECTOR}{backdrop-filter:blur(20px)`)
      expect(document.querySelector('style')?.textContent).toContain(`${MODAL_PANEL_SELECTOR}{backdrop-filter:blur(20px)`)
      expect(document.querySelector('style')?.textContent).toContain(`${SETTINGS_DIALOG_SELECTOR}{background:#fff}`)
      expect(document.querySelector('style')?.textContent).toContain(`${PORTAL_MENU_SELECTOR}{background:#fff}`)
      const dock = document.querySelector('[data-dsh-liquid-glass-dock]')
      expect(dock).not.toBeNull()
      expect(dock?.getAttribute('aria-pressed')).toBe('true')
      expect(liquidGLMock).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('glassifies the composer card once it mounts, stripping its fill', async () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const card = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      expect(liquidGLMock).toHaveBeenCalledWith(expect.objectContaining({
        target: COMPOSER_SELECTOR,
        snapshot: WALLPAPER_SELECTOR,
        refraction: 0.06,
        shadow: true,
      }))
      expect(card.getAttribute(GLASS_MARKER)).toBe('')
      expect(card.style.background).toBe('transparent')
    } finally {
      dispose()
    }
  })

  it('toggling off disposes the layer, hides the surfaces, restores the card fill, keeps the dock', async () => {
    const { controller, disposeLayer } = bench()
    const dispose = controller.start()
    try {
      const card = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      ;(document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement).click()
      expect(disposeLayer).toHaveBeenCalledTimes(1)
      // The wallpaper is hidden, not removed: the renderer's snapshot source
      // stays bound to this exact element across the off cycle.
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR)
      expect(wallpaper).not.toBeNull()
      expect((wallpaper as HTMLElement).style.display).toBe('none')
      expect(document.querySelector('style')).toBeNull()
      expect(card.getAttribute(GLASS_MARKER)).toBeNull()
      expect(card.style.background).toBe('rgb(255, 255, 255)')
      expect(controller.snapshot.getSnapshot().enabled).toBe(false)
      expect(controller.enabled).toBe(false)
    } finally {
      dispose()
    }
  })

  it('re-enabling re-registers the layer and re-strips the card without a second lens', async () => {
    const { controller, overrideTokens, disposeLayer } = bench()
    const dispose = controller.start()
    try {
      const card = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      const dock = document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement
      dock.click()
      dock.click()
      expect(disposeLayer).toHaveBeenCalledTimes(1)
      expect(overrideTokens).toHaveBeenCalledTimes(2)
      expect(liquidGLMock).toHaveBeenCalledTimes(1) // no duplicate lens on off→on
      expect(document.querySelector(WALLPAPER_SELECTOR)).not.toBeNull()
      expect(card.getAttribute(GLASS_MARKER)).toBe('')
      expect(card.style.background).toBe('transparent')
      expect(controller.snapshot.getSnapshot().enabled).toBe(true)
    } finally {
      dispose()
    }
  })

  it('off→on keeps the renderer alive: hides canvas and wallpaper, re-points the snapshot source, re-captures, and re-drives the shadow', async () => {
    let captures = 0
    const setShadow = vi.fn()
    const renderer = {
      canvas: document.createElement('canvas'),
      _rafId: 0 as number | null,
      render: () => {},
      snapshotTarget: null as unknown as Element,
      captureSnapshot: () => { captures += 1 },
      lenses: [{ options: { shadow: true }, setShadow }],
    }
    ;(window as unknown as Record<'__liquidGLRenderer__', unknown>).__liquidGLRenderer__ = renderer
    const { controller } = bench()
    const dispose = controller.start()
    try {
      mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      // Start enabled: the handle is adopted, the snapshot source re-pointed
      // at the live wallpaper, a capture forced, and the shadow re-driven.
      expect(renderer.snapshotTarget).toBe(wallpaper)
      const capturesAtStart = captures
      expect(capturesAtStart).toBeGreaterThan(0)
      expect(renderer.canvas.style.display).toBe('')
      expect(setShadow).toHaveBeenCalledWith(true)

      const dock = document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement
      dock.click()
      expect(renderer.canvas.style.display).toBe('none')
      expect(wallpaper.style.display).toBe('none')
      // The shadow is a fixed element on body: switched off with the canvas.
      expect(setShadow).toHaveBeenLastCalledWith(false)

      dock.click()
      expect(renderer.canvas.style.display).toBe('')
      expect(wallpaper.style.display).toBe('')
      expect(renderer.snapshotTarget).toBe(wallpaper)
      expect(captures).toBeGreaterThan(capturesAtStart)
      expect(setShadow).toHaveBeenLastCalledWith(true)
    } finally {
      if (renderer._rafId !== null) cancelAnimationFrame(renderer._rafId)
      delete (window as unknown as Record<string, unknown>).__liquidGLRenderer__
      dispose()
    }
  })

  it('an attached scope holding disabled boots to stock chrome with only the dock mounted', async () => {
    const { controller, overrideTokens } = bench()
    controller.attachSettings(scopeStub(hostSection({ enabled: false, preset: 'ridge' })).scope)
    const dispose = controller.start()
    try {
      mountCard()
      await new Promise((resolve) => { setTimeout(resolve, 20) })
      expect(overrideTokens).not.toHaveBeenCalled()
      expect(document.querySelector(WALLPAPER_SELECTOR)).toBeNull()
      expect(document.querySelector('[data-dsh-liquid-glass-dock]')).not.toBeNull()
      expect(liquidGLMock).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('teardown removes every surface, disposes the layer, restores the card, and detaches the observer', async () => {
    const { controller, disposeLayer } = bench()
    const dispose = controller.start()
    try {
      const card = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      dispose()
      expect(disposeLayer).toHaveBeenCalledTimes(1)
      expect(document.querySelector('[data-dsh-liquid-glass-dock]')).toBeNull()
      expect(document.querySelector(WALLPAPER_SELECTOR)).toBeNull()
      expect(document.querySelector('style')).toBeNull()
      expect(card.getAttribute(GLASS_MARKER)).toBeNull()
      expect(card.style.background).toBe('rgb(255, 255, 255)')
      // A card mounting after teardown must not be glassified.
      liquidGLMock.mockClear()
      mountCard()
      await new Promise((resolve) => { setTimeout(resolve, 20) })
      expect(liquidGLMock).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('a remounted card gets a fresh lens while the orphaned one is not re-created', async () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const first = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })
      first.remove()
      const second = mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(2)
      })
      expect(second.getAttribute(GLASS_MARKER)).toBe('')
    } finally {
      dispose()
    }
  })

  it('scroll-syncs the wallpaper at the parallax coefficient, clamps to the headroom, and never recaptures the snapshot', async () => {
    const { captures } = installRenderer()
    const { controller } = bench()
    const dispose = controller.start()
    try {
      mountCard()
      await vi.waitFor(() => {
        expect(liquidGLMock).toHaveBeenCalledTimes(1)
      })

      // Starting deep in the transcript (bottom-follow): the first observed
      // scroll anchors there with no offset.
      const scroller = mountScroller(50000)
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).toBe('translate3d(0, 0px, 0)')
      const capturesAtAnchor = captures.count

      setScrollTop(scroller, 49600)
      dispatchScroll(scroller)
      // Scrolling up moves the text down, so the wallpaper follows downward.
      expect(wallpaper.style.transform).toBe('translate3d(0, 100px, 0)')

      // Reaching the transcript top overshoots the headroom and clamps
      // (jsdom innerHeight 768 → half headroom 768 × 120vh / 200 = 460.8px).
      setScrollTop(scroller, 0)
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).toBe('translate3d(0, 460.8px, 0)')
      setScrollTop(scroller, 49600)
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).toBe('translate3d(0, 100px, 0)')

      // The lens tracks the translated wallpaper through its live snapshot
      // rect, so scrolling must not trigger a re-rasterization at all.
      expect(captures.count).toBe(capturesAtAnchor)
    } finally {
      dispose()
    }
  })

  it('wraps the wallpaper in a viewport-sized clipping host so the enlarged canvas cannot scroll the document', () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      const host = wallpaper.parentElement as HTMLElement
      // The host is a direct body child carrying the clip class; the wallpaper
      // keeps its inline overscan geometry inside it.
      expect(host.className).toBe(css.wallpaperHost)
      expect(host.parentElement).toBe(document.body)
      expect(wallpaper.style.top).toBe('-60vh')
      expect(wallpaper.style.height).toBe('calc(100% + 120vh)')
      // Toggling off hides the wallpaper but keeps the host structure.
      ;(document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement).click()
      expect(document.querySelector(WALLPAPER_SELECTOR)).not.toBeNull()
      expect(wallpaper.style.display).toBe('none')
    } finally {
      dispose()
    }
  })

  it('boots with the default wallpaper preset and adopts a scope holding another', () => {
    const first = bench()
    const disposeFirst = first.controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      expect(wallpaper.className).toContain(css.ridge)
    } finally {
      disposeFirst()
    }

    const second = bench()
    second.controller.attachSettings(scopeStub(hostSection({ enabled: true, preset: 'collage' })).scope)
    const disposeSecond = second.controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      expect(wallpaper.className).toContain(css.collage)
    } finally {
      disposeSecond()
    }
  })

  it('long-press cycles the preset, persists it, recaptures, and swallows the trailing click', async () => {
    vi.useFakeTimers()
    try {
      const { captures } = installRenderer()
      const { controller } = bench()
      const dispose = controller.start()
      try {
        mountCard()
        await vi.advanceTimersByTimeAsync(0)
        const dock = document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement
        const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
        expect(wallpaper.className).toContain(css.ridge)
        const capturesBeforeCycle = captures.count

        // Holding past the threshold cycles the preset: the live layer
        // paints the new scene, an outgoing clone fades, and the snapshot
        // recaptures only after the 150ms crossfade settles. No theme toggle.
        dock.dispatchEvent(new Event('pointerdown'))
        await vi.advanceTimersByTime(450)
        expect(wallpaper.className).toContain(css.collage)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(1)
        expect(captures.count).toBe(capturesBeforeCycle)
        // Two rAF ticks start the fade class; the 150ms timer then settles.
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(150)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(0)
        expect(captures.count).toBe(capturesBeforeCycle + 1)
        expect(dock.getAttribute('aria-pressed')).toBe('true')

        // The click that always follows a long press is swallowed.
        dock.click()
        expect(dock.getAttribute('aria-pressed')).toBe('true')

        // A quick press releases before the threshold: the click toggles.
        dock.dispatchEvent(new Event('pointerdown'))
        dock.dispatchEvent(new Event('pointerup'))
        dock.click()
        expect(dock.getAttribute('aria-pressed')).toBe('false')
        expect(wallpaper.className).toContain(css.collage)
        // The long-press cycle and the trailing toggle both published.
        expect(controller.snapshot.getSnapshot()).toEqual(published({ enabled: false, preset: 'collage' }))
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('setEnabled and setPreset drive the surfaces, queue scope writes, and publish to the snapshot', async () => {
    vi.useFakeTimers()
    try {
      const { captures } = installRenderer()
      const { controller } = bench()
      const settings = scopeStub(hostSection({ enabled: true, preset: 'ridge' }))
      controller.attachSettings(settings.scope)
      const dispose = controller.start()
      try {
        mountCard()
        await vi.advanceTimersByTimeAsync(0)
        const scroller = mountScroller(1000)
        setScrollTop(scroller, 1400)
        dispatchScroll(scroller)

        // No-op when the state already holds the value: no write, same snapshot.
        const layersBefore = controller.snapshot.getSnapshot()
        controller.setEnabled(true)
        expect(controller.snapshot.getSnapshot()).toBe(layersBefore)
        expect(settings.writes).toEqual([])

        controller.setEnabled(false)
        expect(settings.writes).toEqual([['enabled', false]])
        expect(controller.snapshot.getSnapshot().enabled).toBe(false)

        controller.setEnabled(true)
        expect(settings.writes).toEqual([['enabled', false], ['enabled', true]])
        expect(controller.snapshot.getSnapshot()).toEqual(published({ enabled: true, preset: 'ridge' }))

        controller.setPreset('collage')
        expect(settings.writes).toEqual([['enabled', false], ['enabled', true], ['preset', 'collage']])
        expect(controller.snapshot.getSnapshot().preset).toBe('collage')
        expect((document.querySelector(WALLPAPER_SELECTOR) as HTMLElement).className).toContain(css.collage)
        // Live layer already paints collage; the snapshot recaptures after the
        // 150ms outgoing fade, not on the same turn as the class swap.
        const capturesAtSwap = captures.count
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(1)
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(150)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(0)
        expect(captures.count).toBeGreaterThan(capturesAtSwap)
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('a second preset swap aborts the in-flight fade so only one outgoing clone exists', async () => {
    vi.useFakeTimers()
    try {
      const { captures } = installRenderer()
      const { controller } = bench()
      const dispose = controller.start()
      try {
        const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
        controller.setPreset('collage')
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(1)
        const firstOutgoing = document.querySelector(`.${css.outgoing}`)
        const capturesMidFade = captures.count
        controller.setPreset('ridge')
        expect(wallpaper.className).toContain(css.ridge)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(1)
        expect(document.querySelector(`.${css.outgoing}`)).not.toBe(firstOutgoing)
        expect(captures.count).toBe(capturesMidFade)
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(16)
        await vi.advanceTimersByTime(150)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(0)
        expect(captures.count).toBe(capturesMidFade + 1)
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('turning the theme off mid-fade drops the outgoing clone without recapturing', async () => {
    vi.useFakeTimers()
    try {
      const { captures } = installRenderer()
      const { controller } = bench()
      const dispose = controller.start()
      try {
        controller.setPreset('collage')
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(1)
        const capturesMidFade = captures.count
        controller.setEnabled(false)
        expect(document.querySelectorAll(`.${css.outgoing}`).length).toBe(0)
        await vi.advanceTimersByTime(200)
        expect(captures.count).toBe(capturesMidFade)
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('setVeil scales the veil variable immediately and commits one debounced scope write per gesture', async () => {
    vi.useFakeTimers()
    try {
      const { controller } = bench()
      const settings = scopeStub(hostSection({ enabled: true, preset: 'custom' }))
      controller.attachSettings(settings.scope)
      const dispose = controller.start()
      try {
        const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
        expect(wallpaper.style.getPropertyValue(VEIL_VAR)).toBe('1')

        controller.setVeil(45)
        expect(wallpaper.style.getPropertyValue(VEIL_VAR)).toBe('0.45')
        expect(controller.snapshot.getSnapshot().veil).toBe(45)
        // The write trails the gesture: nothing on the wire while dragging.
        expect(settings.writes).toEqual([])
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['veil', 45]])

        // Rapid ticks collapse into one trailing write with the last value.
        controller.setVeil(30)
        controller.setVeil(20)
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['veil', 45], ['veil', 20]])
        expect(wallpaper.style.getPropertyValue(VEIL_VAR)).toBe('0.2')

        // No-op when the state already holds the value: no further write.
        controller.setVeil(20)
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['veil', 45], ['veil', 20]])
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('an adopted section carries its veil onto the wallpaper', () => {
    const { controller } = bench()
    controller.attachSettings(scopeStub(hostSection({ enabled: true, preset: 'collage', veil: 45 })).scope)
    const dispose = controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      expect(wallpaper.style.getPropertyValue(VEIL_VAR)).toBe('0.45')
      expect(controller.snapshot.getSnapshot().veil).toBe(45)
    } finally {
      dispose()
    }
  })

  it('setClarity re-registers the token layer scaled, and commits one debounced scope write per gesture', async () => {
    vi.useFakeTimers()
    try {
      const { controller, overrideTokens, disposeLayer } = bench()
      const settings = scopeStub(hostSection({ enabled: true, preset: 'ridge' }))
      controller.attachSettings(settings.scope)
      const dispose = controller.start()
      try {
        // Clarity 0 ships the stock table (the same reference, not a copy).
        expect(overrideTokens).toHaveBeenCalledWith(PACKAGE_ID, LIQUID_GLASS_TOKENS)

        controller.setClarity(50)
        expect(overrideTokens).toHaveBeenCalledTimes(2)
        expect(disposeLayer).toHaveBeenCalledTimes(1)
        const scaled = overrideTokens.mock.calls[1]?.[1]
        expect(scaled?.['--dsw-alias-bg-base']?.light).toBe('rgba(255, 255, 255, 0.16)')
        expect(controller.snapshot.getSnapshot().clarity).toBe(50)
        expect(settings.writes).toEqual([])
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['clarity', 50]])

        // Rapid ticks collapse into one trailing write with the last value.
        controller.setClarity(80)
        controller.setClarity(100)
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['clarity', 50], ['clarity', 100]])
        const clear = overrideTokens.mock.calls[3]?.[1]
        expect(clear?.['--dsw-alias-bg-base']?.light).toBe('rgba(255, 255, 255, 0)')
        expect(scaled?.['--dsw-alias-border-l2']).toEqual(LIQUID_GLASS_TOKENS['--dsw-alias-border-l2'])

        // No-op when the state already holds the value.
        controller.setClarity(100)
        await vi.advanceTimersByTime(250)
        expect(settings.writes).toEqual([['clarity', 50], ['clarity', 100]])
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('an adopted clarity re-registers the layer scaled', () => {
    const { controller, overrideTokens } = bench()
    controller.attachSettings(scopeStub(hostSection({ enabled: true, preset: 'collage', clarity: 100 })).scope)
    const dispose = controller.start()
    try {
      expect(overrideTokens).toHaveBeenCalledTimes(1)
      const scaled = overrideTokens.mock.calls[0]?.[1]
      expect(scaled?.['--dsw-alias-bg-base']?.light).toBe('rgba(255, 255, 255, 0)')
      expect(controller.snapshot.getSnapshot().clarity).toBe(100)
    } finally {
      dispose()
    }
  })

  it('ignores scroll events from anything but the conversation scrollport itself', () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      // window target: not an Element
      dispatchScroll(window)
      // an Element without the conversation marker (sidebar lists share this
      // document-level listener)
      const sidebar = document.createElement('div')
      document.body.append(sidebar)
      dispatchScroll(sidebar)
      // a nested scroller inside the conversation (code blocks): exact match,
      // not closest(), so it must not drag the wallpaper either
      const scroller = mountScroller(1000)
      const inner = document.createElement('div')
      scroller.append(inner)
      dispatchScroll(inner)
      expect(wallpaper.style.transform).toBe('')
    } finally {
      dispose()
    }
  })

  it('re-anchors when the scrollport element changes', () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      const first = mountScroller(1000)
      dispatchScroll(first)
      expect(wallpaper.style.transform).toBe('translate3d(0, 0px, 0)')
      setScrollTop(first, 1200)
      dispatchScroll(first)
      expect(wallpaper.style.transform).toBe('translate3d(0, -50px, 0)')

      // A workspace switch replaces the element; the fresh port anchors at
      // its own position instead of inheriting the old offset.
      const second = mountScroller(4000)
      dispatchScroll(second)
      expect(wallpaper.style.transform).toBe('translate3d(0, 0px, 0)')

      // Scrolling down far past the headroom clamps on the negative side.
      setScrollTop(second, 100000)
      dispatchScroll(second)
      expect(wallpaper.style.transform).toBe('translate3d(0, -460.8px, 0)')
    } finally {
      dispose()
    }
  })

  it('toggling off removes the translation and re-enabling starts from the neutral position', () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      mountCard()
      const scroller = mountScroller(1000)
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      setScrollTop(scroller, 1400)
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).not.toBe('')

      ;(document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement).click()
      expect(wallpaper.style.transform).toBe('')

      // Re-enabling starts from the neutral position, not the stale offset.
      ;(document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement).click()
      expect(wallpaper.style.transform).toBe('')
    } finally {
      dispose()
    }
  })

  it('teardown detaches the scroll listener so later scrolls do nothing', () => {
    const { controller } = bench()
    const dispose = controller.start()
    try {
      mountCard()
      const scroller = mountScroller(1000)
      const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
      setScrollTop(scroller, 1400)
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).not.toBe('')

      dispose()
      setScrollTop(scroller, 2000)
      dispatchScroll(scroller)
      expect(wallpaper.style.transform).toBe('')
    } finally {
      dispose()
    }
  })

  it('setLook copies a named calibration onto the live lens and persists every knob', async () => {
    vi.useFakeTimers()
    try {
      const { lens } = installRenderer()
      const { controller } = bench()
      const settings = scopeStub(hostSection({ enabled: true, preset: 'ridge' }))
      controller.attachSettings(settings.scope)
      const dispose = controller.start()
      try {
        expect(controller.snapshot.getSnapshot().look).toBe('rich')
        controller.setLook('restrained')
        expect(controller.snapshot.getSnapshot().look).toBe('restrained')
        expect(controller.snapshot.getSnapshot().lookValues).toEqual(GLASS_LOOK_PRESETS.restrained)
        expect(lens.options.refraction).toBe(GLASS_LOOK_PRESETS.restrained.refraction)
        expect(lens.setShadow).toHaveBeenCalledWith(true)
        await vi.advanceTimersByTime(250)
        expect(settings.writes.filter(([field]) => field === 'refraction')).toEqual([['refraction', GLASS_LOOK_PRESETS.restrained.refraction]])
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('setLookValues marks the look custom and hot-updates the lens without recreating it', async () => {
    vi.useFakeTimers()
    try {
      const { lens } = installRenderer()
      const { controller } = bench()
      const dispose = controller.start()
      try {
        const callsBefore = liquidGLMock.mock.calls.length
        controller.setLookValues({ ...RICH, refraction: 0.09 })
        expect(controller.snapshot.getSnapshot().look).toBe('custom')
        expect(lens.options.refraction).toBe(0.09)
        expect(liquidGLMock.mock.calls.length).toBe(callsBefore)
        await vi.advanceTimersByTime(250)
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('onPaletteChange recaptures after two animation frames so the CSS scheme paints first', async () => {
    vi.useFakeTimers()
    try {
      const { captures } = installRenderer()
      const { controller } = bench()
      const dispose = controller.start()
      try {
        const before = captures.count
        controller.onPaletteChange()
        expect(captures.count).toBe(before)
        await vi.advanceTimersByTime(16)
        expect(captures.count).toBe(before)
        await vi.advanceTimersByTime(16)
        expect(captures.count).toBe(before + 1)

        controller.setEnabled(false)
        const offCount = captures.count
        controller.onPaletteChange()
        await vi.advanceTimersByTime(32)
        expect(captures.count).toBe(offCount)
      } finally {
        dispose()
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('right-clicking the dock opens a tuning panel whose sliders hot-update the look', () => {
    const { lens } = installRenderer()
    const { controller } = bench()
    const dispose = controller.start()
    try {
      const dock = document.querySelector('[data-dsh-liquid-glass-dock]') as HTMLButtonElement
      expect(document.querySelector(TUNING_PANEL_SELECTOR)).toBeNull()
      dock.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      const panel = document.querySelector(TUNING_PANEL_SELECTOR) as HTMLElement
      expect(panel).not.toBeNull()
      const slider = panel.querySelector('input[aria-label="折射"]') as HTMLInputElement
      expect(slider.value).toBe(String(RICH.refraction))
      slider.value = '0.09'
      slider.dispatchEvent(new Event('input'))
      expect(controller.snapshot.getSnapshot().look).toBe('custom')
      expect(lens.options.refraction).toBe(0.09)
      // A drag must not rebuild the input (that would abort the gesture).
      expect(panel.querySelector('input[aria-label="折射"]')).toBe(slider)
      const restrained = panel.querySelector('button[data-look="restrained"]') as HTMLButtonElement
      expect(restrained).not.toBeNull()
      restrained.click()
      expect(controller.snapshot.getSnapshot().look).toBe('restrained')
      expect(lens.options.refraction).toBe(GLASS_LOOK_PRESETS.restrained.refraction)
      expect(restrained.getAttribute('aria-pressed')).toBe('true')
      slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      expect(document.querySelector(TUNING_PANEL_SELECTOR)).not.toBeNull()
      dock.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      expect(document.querySelector(TUNING_PANEL_SELECTOR)).toBeNull()
    } finally {
      dispose()
    }
  })
})
