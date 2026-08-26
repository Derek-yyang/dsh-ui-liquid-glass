/** Host apply: the settings namespace registers with the composition entry as
 * its base layer, so the stored document resolves over the boot defaults. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, Config, SETTINGS_NAMESPACE } from '../src/index.ts'

describe('ui-liquid-glass host apply', () => {
  it('registers the settings namespace with the composition entry as the base layer', async () => {
    const register = vi.fn(() => ({
      get: () => ({ enabled: true, preset: 'collage', veil: 100, clarity: 0 }),
      watch: () => () => {},
    }))
    const ctx = new Context()
    ctx.provide('settings', { register })

    apply(ctx, { enabled: true, preset: 'collage', veil: 100, clarity: 0 })
    await ctx.inject(['settings'], async () => {}).await()

    expect(register).toHaveBeenCalledWith(SETTINGS_NAMESPACE, Config, {
      base: { enabled: true, preset: 'collage', veil: 100, clarity: 0 },
    })
  })
})
