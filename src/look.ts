/**
 * Composer-card liquidGL look: three named calibrations plus a custom bag of
 * the same knobs. The Settings card's look picker writes a named id and copies
 * its values; the advanced sliders write individual knobs and the look id
 * becomes `custom` the moment the bag no longer matches a named calibration.
 */

/** Named look ids the picker offers, in display order. */
export const GLASS_LOOKS = ['restrained', 'standard', 'rich'] as const

/** A named look id. */
export type NamedGlassLook = (typeof GLASS_LOOKS)[number]

/** Look id including the derived `custom` bag. */
export type GlassLookId = NamedGlassLook | 'custom'

/** The Host-persisted settings document: wallpaper + surface + look knobs.
 * The named look id is derived from the knobs, not stored. */
export interface LiquidGlassHostSection extends GlassLookValues {
  /** Whether the glass theme is applied. */
  enabled: boolean
  /** Active wallpaper preset id. */
  preset: string
  /** Surface clarity in percent (0–100). */
  clarity: number
}

/** The liquidGL knobs this plugin exposes. Target, snapshot, resolution,
 * reveal, and tilt stay product constants — they are not a look. */
export interface GlassLookValues {
  /** Base refraction across the pane, 0–1. */
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

/** Shipped look — the current "turned up" demo-5 calibration. */
export const DEFAULT_LOOK: NamedGlassLook = 'rich'

/**
 * Named calibrations. `rich` is the values this plugin shipped before the
 * picker existed; `standard` sits between library demo-5 and rich; `restrained`
 * is close to the library's own demo-5 defaults.
 */
export const GLASS_LOOK_PRESETS: Record<NamedGlassLook, GlassLookValues> = {
  restrained: {
    refraction: 0.02, bevelDepth: 0.08, bevelWidth: 0.12, frost: 0,
    aberration: 0, magnify: 1, shadow: true, specular: true,
  },
  standard: {
    refraction: 0.04, bevelDepth: 0.12, bevelWidth: 0.10, frost: 0,
    aberration: 0, magnify: 1, shadow: true, specular: true,
  },
  rich: {
    refraction: 0.06, bevelDepth: 0.18, bevelWidth: 0.09, frost: 0,
    aberration: 0, magnify: 1, shadow: true, specular: true,
  },
}

/** Slider bounds for each numeric look knob, matching liquidGL's documented
 * ranges with a tighter frost ceiling so the advanced row stays usable. */
export const GLASS_LOOK_SLIDERS = {
  refraction: { min: 0, max: 0.12, step: 0.005 },
  bevelDepth: { min: 0, max: 0.3, step: 0.01 },
  bevelWidth: { min: 0.02, max: 0.25, step: 0.01 },
  frost: { min: 0, max: 16, step: 1 },
  aberration: { min: 0, max: 0.2, step: 0.01 },
  magnify: { min: 0.8, max: 1.4, step: 0.05 },
} as const satisfies Record<Exclude<keyof GlassLookValues, 'shadow' | 'specular'>, { min: number; max: number; step: number }>

/** Numeric look knobs in the order the advanced row renders them. */
export const GLASS_LOOK_SLIDER_KEYS = [
  'refraction', 'bevelDepth', 'bevelWidth', 'frost', 'aberration', 'magnify',
] as const satisfies ReadonlyArray<keyof typeof GLASS_LOOK_SLIDERS>

/**
 * Classify a value bag as a named look or `custom`.
 * @param values - the live knobs.
 * @returns the matching named id, or `custom` when no preset matches exactly.
 */
export function lookIdFor(values: GlassLookValues): GlassLookId {
  for (const id of GLASS_LOOKS) {
    if (sameLook(GLASS_LOOK_PRESETS[id], values)) return id
  }
  return 'custom'
}

/**
 * Whether two look bags are identical.
 * @param left - first bag.
 * @param right - second bag.
 * @returns true when every knob matches.
 */
export function sameLook(left: GlassLookValues, right: GlassLookValues): boolean {
  return left.refraction === right.refraction
    && left.bevelDepth === right.bevelDepth
    && left.bevelWidth === right.bevelWidth
    && left.frost === right.frost
    && left.aberration === right.aberration
    && left.magnify === right.magnify
    && left.shadow === right.shadow
    && left.specular === right.specular
}
