/** Host loader entry for the liquid glass theme plugin: owns the settings
 * namespace the browser half reads and writes (the toggle, wallpaper, and
 * look knobs persist in the Host settings document, so they survive browser
 * switches). Provides no other host-side behavior. */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { DEFAULT_LOOK, GLASS_LOOK_PRESETS } from './look.ts'

/** The plugin's branded settings namespace. */
export const SETTINGS_NAMESPACE = settingsNamespace('liquid-glass')

const RICH = GLASS_LOOK_PRESETS[DEFAULT_LOOK]

/** The user-visible preferences the browser half renders from. `preset` may
 * name the device-local custom image, which lives in that browser's
 * IndexedDB — the Host only stores the id. Look knobs persist as a flat bag
 * so a custom mix survives a restart; the named look id is derived. */
export interface LiquidGlassConfig {
  /** Whether the glass theme is applied. */
  enabled: boolean
  /** Active wallpaper preset. `collage` is a retired id accepted so old Host
   * documents still resolve; the browser half paints `ridge` for it. */
  preset: string
  /** Surface clarity in percent (0–100); 0 is the shipped calibration, 100
   * fades static surface fills to transparent over the wallpaper. */
  clarity: number
  /** Base refraction across the composer pane, 0–1. */
  refraction: number
  /** Extra edge refraction simulating depth, 0–1. */
  bevelDepth: number
  /** Bevel-zone width as a fraction of the shortest side, 0–1. */
  bevelWidth: number
  /** Frosted blur radius in pixels; 0 is clear. */
  frost: number
  /** Chromatic aberration strength, 0–1. */
  aberration: number
  /** Lens magnification, 0.001–3. */
  magnify: number
  /** Draw the library drop shadow under the pane. */
  shadow: boolean
  /** Animate specular highlights over time. */
  specular: boolean
}

/** Schema resolving the namespace; the defaults are the composition entry the
 * section falls back to while no settings service stands. Look defaults are
 * the shipped `rich` calibration so existing Host documents without these
 * fields keep the look they already had. */
export const Config: z<LiquidGlassConfig> = z.object({
  enabled: z.boolean().default(true),
  preset: z.string().default('ridge'),
  clarity: z.number().step(1).min(0).max(100).default(0),
  refraction: z.number().min(0).max(1).default(RICH.refraction),
  bevelDepth: z.number().min(0).max(1).default(RICH.bevelDepth),
  bevelWidth: z.number().min(0).max(1).default(RICH.bevelWidth),
  frost: z.number().min(0).max(64).default(RICH.frost),
  aberration: z.number().min(0).max(1).default(RICH.aberration),
  magnify: z.number().min(0.001).max(3).default(RICH.magnify),
  shadow: z.boolean().default(RICH.shadow),
  specular: z.boolean().default(RICH.specular),
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
