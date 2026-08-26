/** Named look calibrations classify a live bag as a named id or custom. */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOOK, GLASS_LOOK_PRESETS, lookIdFor, sameLook,
} from '../src/look.ts'

describe('glass look calibrations', () => {
  it('the shipped default is rich, matching the pre-picker GL_OPTIONS', () => {
    expect(DEFAULT_LOOK).toBe('rich')
    expect(GLASS_LOOK_PRESETS.rich).toEqual({
      refraction: 0.06, bevelDepth: 0.18, bevelWidth: 0.09, frost: 0,
      aberration: 0, magnify: 1, shadow: true, specular: true,
    })
  })

  it('lookIdFor returns the matching named id, or custom when a knob drifts', () => {
    expect(lookIdFor(GLASS_LOOK_PRESETS.standard)).toBe('standard')
    expect(lookIdFor({ ...GLASS_LOOK_PRESETS.rich, refraction: 0.09 })).toBe('custom')
  })

  it('sameLook is exact across every knob', () => {
    expect(sameLook(GLASS_LOOK_PRESETS.restrained, { ...GLASS_LOOK_PRESETS.restrained })).toBe(true)
    expect(sameLook(GLASS_LOOK_PRESETS.restrained, GLASS_LOOK_PRESETS.rich)).toBe(false)
  })
})
