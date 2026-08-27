/** Gallery helpers: Host preset ids and the dock long-press ring. */
import { describe, expect, it } from 'vitest'
import { customPresetId, galleryIdFromPreset, nextWallpaperPreset } from '../src/client/wallpaper-store.ts'
import { WALLPAPER_PRESETS } from '../src/tokens.ts'

describe('nextWallpaperPreset', () => {
  it('walks the four built-ins and wraps with no custom images', () => {
    expect(nextWallpaperPreset('ridge', [])).toBe('coast')
    expect(nextWallpaperPreset('coast', [])).toBe('garden')
    expect(nextWallpaperPreset('garden', [])).toBe('arch')
    expect(nextWallpaperPreset('arch', [])).toBe('ridge')
  })

  it('appends device-local custom ids after the built-ins, oldest first', () => {
    const gallery = ['alpha', 'beta']
    expect(nextWallpaperPreset('arch', gallery)).toBe(customPresetId('alpha'))
    expect(nextWallpaperPreset(customPresetId('alpha'), gallery)).toBe(customPresetId('beta'))
    expect(nextWallpaperPreset(customPresetId('beta'), gallery)).toBe('ridge')
  })

  it('treats a retired or deleted id as ridge so the next press is coast', () => {
    expect(nextWallpaperPreset('collage', [])).toBe('coast')
    expect(nextWallpaperPreset(customPresetId('gone'), ['kept'])).toBe('coast')
  })

  it('keeps the Host custom prefix parseable', () => {
    expect(galleryIdFromPreset(customPresetId('alpha'))).toBe('alpha')
    expect(galleryIdFromPreset('custom')).toBe('legacy')
    expect(galleryIdFromPreset(WALLPAPER_PRESETS[0])).toBeUndefined()
  })
})
