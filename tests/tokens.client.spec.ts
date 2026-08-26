/** Token-layer shape: every entry is an alias variable carrying both palette
 * modes, and the marker values the invariant-facing constants promise. */
import { describe, expect, it } from 'vitest'
import {
  BG_BASE_DARK, BG_BASE_LIGHT, LIQUID_GLASS_TOKENS, PACKAGE_ID,
  WALLPAPER_CROSSFADE_MS, scaleSurfaceTokens,
} from '../src/tokens.ts'

describe('LIQUID_GLASS_TOKENS', () => {
  it('keys are --dsw-* variables and values are { light, dark } string pairs', () => {
    const keys = Object.keys(LIQUID_GLASS_TOKENS)
    expect(keys.length).toBeGreaterThan(0)
    for (const [name, modes] of Object.entries(LIQUID_GLASS_TOKENS)) {
      expect(name.startsWith('--dsw-'), name).toBe(true)
      expect(typeof modes.light, name).toBe('string')
      expect(typeof modes.dark, name).toBe('string')
      expect(modes.light.length, name).toBeGreaterThan(0)
      expect(modes.dark.length, name).toBeGreaterThan(0)
    }
  })

  it('covers the surface system in both palettes: layers, borders, sidebar, menus, code blocks', () => {
    for (const name of [
      '--dsw-alias-bg-base',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-overlay',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-border-l3',
      '--dsw-specific-sidebar-fill',
      '--dsw-specific-sidebar-nav-item-active',
      '--dsw-specific-sidebar-nav-item-active-accent',
      '--dsw-specific-sidebar-nav-item-hover',
      '--dsw-specific-menu',
      '--dsw-specific-input-major',
      '--dsw-alias-markdown-code-block',
    ]) {
      expect(LIQUID_GLASS_TOKENS[name], name).toBeDefined()
    }
    // The sidebar is frosted, not washed: its fill stays weak because the
    // controller blurs the column's backdrop on top of the frame's own
    // translucent bg-base veil.
    expect(LIQUID_GLASS_TOKENS['--dsw-specific-sidebar-fill']?.light).toBe('rgba(255, 255, 255, 0.18)')
  })

  it('keeps text legible: labels, state colors, and masks stay on the base palette', () => {
    for (const name of [
      '--dsw-alias-label-primary',
      '--dsw-alias-state-error-primary',
      '--dsw-alias-bg-mask-1',
      '--dsw-alias-scrollbar-bg-l1',
    ]) {
      expect(LIQUID_GLASS_TOKENS[name], `${name} must not be overridden`).toBeUndefined()
    }
  })

  it('exposes the bg-base marker values the layer presence check relies on', () => {
    expect(LIQUID_GLASS_TOKENS['--dsw-alias-bg-base']).toEqual({ light: BG_BASE_LIGHT, dark: BG_BASE_DARK })
    expect(PACKAGE_ID).toBe('dsh-ui-liquid-glass')
    expect(WALLPAPER_CROSSFADE_MS).toBe(150)
  })

  describe('scaleSurfaceTokens', () => {
    it('returns the stock table at clarity 0', () => {
      expect(scaleSurfaceTokens(LIQUID_GLASS_TOKENS, 0)).toBe(LIQUID_GLASS_TOKENS)
    })

    it('fades static surfaces to transparent and floors interactive fills at clarity 100', () => {
      const scaled = scaleSurfaceTokens(LIQUID_GLASS_TOKENS, 100)
      // Static casts: fully gone, both palettes.
      expect(scaled['--dsw-alias-bg-base']).toEqual({ light: 'rgba(255, 255, 255, 0)', dark: 'rgba(16, 17, 22, 0)' })
      expect(scaled['--dsw-specific-sidebar-fill']?.light).toBe('rgba(255, 255, 255, 0)')
      expect(scaled['--dsw-specific-menu']?.dark).toBe('rgba(28, 28, 34, 0)')
      // Interactive floor: the stock alpha interpolates down to the minimum.
      expect(scaled['--dsw-specific-input-major']?.light).toBe('rgba(255, 255, 255, 0.15)')
      expect(scaled['--dsw-alias-toast-bg']?.light).toBe('rgba(53, 54, 56, 0.5)')
      // The glass's edges and feedback stay stock: borders, the contrast
      // button, the colored accent.
      expect(scaled['--dsw-alias-border-l2']).toEqual(LIQUID_GLASS_TOKENS['--dsw-alias-border-l2'])
      expect(scaled['--dsw-alias-button-contrast-fill']).toEqual(LIQUID_GLASS_TOKENS['--dsw-alias-button-contrast-fill'])
      expect(scaled['--dsw-specific-sidebar-nav-item-active-accent']).toEqual(LIQUID_GLASS_TOKENS['--dsw-specific-sidebar-nav-item-active-accent'])
    })

    it('interpolates linearly in between', () => {
      const scaled = scaleSurfaceTokens(LIQUID_GLASS_TOKENS, 50)
      expect(scaled['--dsw-alias-bg-base']?.light).toBe('rgba(255, 255, 255, 0.16)')
      // 0.60 stock → 0.15 floor: halfway is 0.375.
      expect(scaled['--dsw-specific-input-major']?.light).toBe('rgba(255, 255, 255, 0.375)')
    })
  })
})
