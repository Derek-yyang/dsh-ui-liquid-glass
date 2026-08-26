/** Host loader entry for the liquid glass theme plugin: owns the settings
 * namespace the browser half reads and writes (the toggle and the wallpaper
 * preference persist in the Host settings document, so they survive browser
 * switches). Provides no other host-side behavior. */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'

/** The plugin's branded settings namespace. */
export const SETTINGS_NAMESPACE = settingsNamespace('liquid-glass')

/** The user-visible preferences the browser half renders from. `preset` may
 * name the device-local custom image, which lives in that browser's
 * IndexedDB — the Host only stores the id. */
export interface LiquidGlassConfig {
  /** Whether the glass theme is applied. */
  enabled: boolean
  /** Active wallpaper preset. */
  preset: 'ridge' | 'collage' | 'custom'
  /** Custom-image veil strength in percent (0–100); 100 is the shipped
   * calibration, 0 shows the raw image. */
  veil: number
  /** Surface clarity in percent (0–100); 0 is the shipped calibration, 100
   * fades static surface fills to transparent over the wallpaper. */
  clarity: number
}

/** Schema resolving the namespace; the defaults are the composition entry the
 * section falls back to while no settings service stands. */
export const Config: z<LiquidGlassConfig> = z.object({
  enabled: z.boolean().default(true),
  preset: z.union(['ridge', 'collage', 'custom']).default('ridge'),
  veil: z.number().step(1).min(0).max(100).default(100),
  clarity: z.number().step(1).min(0).max(100).default(0),
})

/** Registers the settings namespace for this plugin fiber's lifetime.
 * @param ctx - Host plugin context.
 * @param config - composition entry config (defaults applied by the Loader).
 */
export function apply(ctx: Context, config: LiquidGlassConfig): void {
  installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, config, {
    // The config's consumer is the browser half, which reads the namespace
    // through its own scope; the Host side derives nothing from it.
    setSource: () => {},
    onChange: () => {},
  })
}
