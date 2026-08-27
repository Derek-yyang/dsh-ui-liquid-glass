/** Host apply: the settings namespace registers with the composition entry as
 * its base layer, so the stored document resolves over the boot defaults. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, Config, SETTINGS_NAMESPACE } from '../src/index.ts'
import { DEFAULT_LOOK, GLASS_LOOK_PRESETS } from '../src/look.ts'

const RICH = GLASS_LOOK_PRESETS[DEFAULT_LOOK]
const coast = { enabled: true as const, preset: 'coast' as const, veil: 100, clarity: 0, ...RICH }

describe('ui-liquid-glass host apply', () => {
  it('registers the settings namespace with the composition entry as the base layer', async () => {
    const register = vi.fn(() => ({
      get: () => coast,
      watch: () => () => {},
    }))
    const ctx = new Context()
    ctx.provide('settings', { register })

    apply(ctx, coast)
    await ctx.inject(['settings'], async () => {}).await()

    expect(register).toHaveBeenCalledWith(SETTINGS_NAMESPACE, Config, {
      base: coast,
    })
  })
})
