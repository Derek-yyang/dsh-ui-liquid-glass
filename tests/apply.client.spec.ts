/** apply wiring: the controller mounts for the fiber lifetime and the token
 * layer rides ctx.theme; the Settings card rides the slots/locale pair and
 * the settingsScope binder; disposing the plugin fiber removes everything. */
// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'

vi.mock('liquid-gl', () => ({
  default: Object.assign(vi.fn(() => ({ el: null })), { registerDynamic: vi.fn() }),
}))

import { apply, inject } from '../src/client/index.ts'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { LIQUID_GLASS_TOKENS, PACKAGE_ID, WALLPAPER_SELECTOR } from '../src/tokens.ts'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  ctx.provide('settingsScope', { bind: () => undefined })
  const disposeLayer = vi.fn()
  const overrideTokens = vi.fn(() => disposeLayer)
  ctx.provide('theme', { overrideTokens } as unknown as ThemeRuntime)
  await ctx.plugin({ inject, apply }).await()
  return { ctx, overrideTokens, disposeLayer }
}

beforeEach(() => {
  localStorage.clear()
})

describe('ui-liquid-glass apply', () => {
  it('declares the theme, slots, locale, and settingsScope services and mounts the overlay for the fiber lifetime', async () => {
    expect(inject).toEqual(['theme', 'slots', 'locale', 'settingsScope'])
    const { ctx, overrideTokens } = await bench()
    expect(overrideTokens).toHaveBeenCalledWith(PACKAGE_ID, LIQUID_GLASS_TOKENS)
    expect(document.querySelector(WALLPAPER_SELECTOR)).not.toBeNull()
    expect(document.querySelector('[data-dsh-liquid-glass-dock]')).not.toBeNull()
    await ctx.fiber.dispose()
  })

  it('a theme/change event recaptures the wallpaper snapshot', async () => {
    vi.useFakeTimers()
    try {
      const { ctx } = await bench()
      const captures = { count: 0 }
      ;(window as unknown as Record<string, unknown>).__liquidGLRenderer__ = {
        canvas: document.createElement('canvas'),
        _rafId: 0,
        render: () => {},
        snapshotTarget: null,
        captureSnapshot: () => { captures.count += 1 },
        lenses: [],
      }
      ctx.emit('theme/change', { preference: 'dark', active: { id: 'dark', colorScheme: 'dark', tokens: {} }, themes: [], revision: 1 })
      expect(captures.count).toBe(0)
      await vi.advanceTimersByTime(32)
      expect(captures.count).toBe(1)
      await ctx.fiber.dispose()
    } finally {
      vi.useRealTimers()
      delete (window as unknown as Record<string, unknown>).__liquidGLRenderer__
    }
  })

  it('disposing the fiber unmounts the surfaces and disposes the override layer', async () => {
    const { ctx, disposeLayer } = await bench()
    await ctx.fiber.dispose()
    expect(disposeLayer).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-dsh-liquid-glass-dock]')).toBeNull()
    expect(document.querySelector(WALLPAPER_SELECTOR)).toBeNull()
  })
})
