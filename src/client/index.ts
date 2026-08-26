/**
 * Liquid glass theme: one `overrideTokens` alias layer over the active base
 * palette plus plugin-owned chrome (wallpaper, dock) and the glassified
 * conversation composer card. The browser half needs ui-theme's service, the
 * slots/locale pair, and the settings-scope binder: the toggle and the
 * wallpaper preference persist in the plugin's Host settings namespace (the
 * card in the Settings Plugins section edits the same namespace). There is no
 * boot row config — the web boot path composes browser entries by name alone.
 */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the `settings.plugin.item` slot declaration (owned by the
// configurable-plugins tab) into this program's SlotMap.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { LiquidGlassController } from './controller.ts'
import { LiquidGlassSettingsCard, type LiquidGlassSettingsCardInjected } from './settings-card.tsx'
import { en, zh, type LiquidGlassLocaleKey } from './locales.ts'
import { SETTINGS_NAMESPACE } from '../tokens.ts'

export type { LiquidGlassSettingsCardInjected, LiquidGlassSettingsCardProps } from './settings-card.tsx'
export type { LiquidGlassLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Liquid Glass settings card copy. */
    'settings.liquidGlass': LiquidGlassLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.liquidGlass'

/** Services required by the liquid glass theme plugin. */
export const inject = ['theme', 'slots', 'locale', 'settingsScope']

/** Mounts the overlay controller and the Settings card for this plugin
 * fiber's lifetime.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const controller = new LiquidGlassController(ctx.theme)
  controller.attachSettings(ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE }))
  ctx.effect(() => controller.start(), 'ui-liquid-glass: overlay controller')
  ctx.on('theme/change', () => { controller.onPaletteChange() })
  void controller.initCustomWallpaper()

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-liquid-glass: dictionaries')
  const injected = (): LiquidGlassSettingsCardInjected => ({
    hooks: { snapshot: controller.snapshot },
    setEnabled: (enabled) => { controller.setEnabled(enabled) },
    setPreset: (preset) => { controller.setPreset(preset) },
    setVeil: (percent) => { controller.setVeil(percent) },
    setClarity: (percent) => { controller.setClarity(percent) },
    setLook: (id) => { controller.setLook(id) },
    setLookValues: (values) => { controller.setLookValues(values) },
    uploadCustom: image => controller.uploadCustomWallpaper(image),
  })

  // The configurable-plugins tab owns the card slot and loads dynamically
  // after boot; the inject waits for the declaration and leaves with this
  // fiber. Keyed by the settings namespace, pairing this card with the
  // section the Host half registers.
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: SETTINGS_NAMESPACE,
    locale: NS,
    inject: injected,
  }, LiquidGlassSettingsCard))
}
