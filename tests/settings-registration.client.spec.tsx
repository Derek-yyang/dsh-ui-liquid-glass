/** The browser apply: locale dictionaries plus the configurable-plugins card
 * registration, wired to the controller's snapshot, write paths, and the
 * plugin's settings-namespace scope. */
// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { apply, inject, NS } from '../src/client/index.ts'
import { LiquidGlassSettingsCard } from '../src/client/settings-card.tsx'
import type { LiquidGlassSettingsCardInjected } from '../src/client/settings-card.tsx'
import { SETTINGS_NAMESPACE, WALLPAPER_SELECTOR } from '../src/tokens.ts'
import { DEFAULT_LOOK, GLASS_LOOK_PRESETS } from '../src/look.ts'
import type { LiquidGlassHostSection } from '../src/look.ts'

const RICH = GLASS_LOOK_PRESETS[DEFAULT_LOOK]

function hostSection(
  partial: Partial<LiquidGlassHostSection> & Pick<LiquidGlassHostSection, 'enabled' | 'preset'>,
): LiquidGlassHostSection {
  return { clarity: 0, ...RICH, ...partial }
}

usePinnedBrowserLanguages('zh-CN')
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

/** A settings scope stub: ready with the given section, recording writes. */
function scopeStub(section: LiquidGlassHostSection) {
  const writes: Array<[string, unknown]> = []
  let value = { ...section }
  const listeners = new Set<() => void>()
  const publish = (): void => {
    for (const listener of listeners) listener()
  }
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
      publish()
      return Promise.resolve()
    },
    unset: (): Promise<void> => Promise.resolve(),
  }
  return { scope: scope as unknown as SettingsScope<LiquidGlassHostSection>, writes }
}

async function bench(section: LiquidGlassHostSection) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  ctx.provide('theme', { overrideTokens: () => () => {} } as unknown as ThemeRuntime)
  const settings = scopeStub(section)
  ctx.provide('settingsScope', { bind: () => settings.scope })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, settings }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugin.item': { kind: 'keyed', scope: 'root' } },
  } as never, () => null)
}

describe('ui-liquid-glass browser plugin settings registration', () => {
  it('declares the services the controller, the card, and the scope consume', () => {
    expect(inject).toEqual(['theme', 'slots', 'locale', 'settingsScope'])
  })

  it('registers a namespace-keyed card whose inject face drives the controller and the scope', async () => {
    const b = await bench(hostSection({ enabled: true, preset: 'ridge' }))
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugin.item')[0]!
    expect(entry.component).toBe(LiquidGlassSettingsCard)
    expect(entry.options).toMatchObject({ key: SETTINGS_NAMESPACE })
    expect(entry.locale).toBe(NS)

    const injected = (entry.inject as unknown as () => LiquidGlassSettingsCardInjected)()
    expect(injected.hooks.snapshot.getSnapshot()).toEqual({
      enabled: true, preset: 'ridge', gallery: [], clarity: 0,
      look: DEFAULT_LOOK, lookValues: RICH,
    })

    injected.setEnabled(false)
    expect(b.settings.writes).toEqual([['enabled', false]])
    expect(injected.hooks.snapshot.getSnapshot().enabled).toBe(false)
    // Disabled: the wallpaper hides but stays mounted (the renderer's
    // snapshot source stays bound to this element).
    const wallpaper = document.querySelector(WALLPAPER_SELECTOR) as HTMLElement
    expect(wallpaper).not.toBeNull()
    expect(wallpaper.style.display).toBe('none')

    injected.setPreset('coast')
    expect(b.settings.writes).toEqual([['enabled', false], ['preset', 'coast']])
    expect(injected.hooks.snapshot.getSnapshot().preset).toBe('coast')
    expect(wallpaper.className).toContain('coast')

    await b.ctx.fiber.dispose()
  })
})
