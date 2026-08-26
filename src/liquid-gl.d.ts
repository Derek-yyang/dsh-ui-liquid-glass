/**
 * Hand-written ambient types for `liquid-gl` (the npm package ships no
 * declarations). Only the surface this plugin uses is typed; unknown options
 * stay open through the index signature so upstream additions do not require
 * a declaration change.
 */

declare module 'liquid-gl' {
  /** liquidGL factory options (v2.x); see https://liquidgl.naughtyduk.com. */
  export interface LiquidGLOptions {
    /** CSS selector for the element(s) to glassify. The library reads the
     * live rect of any positioned target; a fixed, high-z-index target is
     * the documented recipe, while in-flow targets work when their stacking
     * context sits above the library's body-level lens canvas. */
    target?: string
    /** CSS selector for the element rasterised as the refraction source. */
    snapshot?: string
    /** Background snapshot resolution, clamped 0.1–3.0 (default 2.0). */
    resolution?: number
    /** Base refraction offset across the pane, 0–1. */
    refraction?: number
    /** Chromatic aberration strength, 0–1. */
    aberration?: number
    /** Extra edge refraction simulating depth, 0–1. */
    bevelDepth?: number
    /** Bevel-zone width as a fraction of the shortest side, 0–1. */
    bevelWidth?: number
    /** Frosted blur radius in pixels; 0 is clear. */
    frost?: number
    /** Draw a subtle drop shadow under the pane. */
    shadow?: boolean
    /** Animate specular highlights over time. */
    specular?: boolean
    /** Reveal animation: `'none'` renders immediately, `'fade'` eases in. */
    reveal?: 'none' | 'fade'
    /** 3D tilt interaction following the cursor. */
    tilt?: boolean
    /** Tilt depth in degrees (0–25 recommended). */
    tiltFactor?: number
    /** Tilt settle duration in milliseconds, both directions. */
    tiltEase?: number
    /** Lens magnification factor, clamped 0.001–3.0. */
    magnify?: number
    /** Lifecycle callbacks. */
    on?: {
      /** Runs once after the first render completes. */
      init?: (instance: LiquidGLLens) => void
    }
    [option: string]: unknown
  }

  /** One glassified lens instance; the library exposes no removal API. */
  export interface LiquidGLLens {
    /** The glassified element. */
    el: Element
    [member: string]: unknown
  }

  /** A lens instance, one per matched target, or undefined when no target matched. */
  export type LiquidGLResult = LiquidGLLens | LiquidGLLens[] | undefined

  /** The glassify factory with the snapshot-registration helper attached. */
  export interface LiquidGLFactory {
    /** Glassify every element matching `options.target`. */
    (options: LiquidGLOptions): LiquidGLResult
    /** Register elements whose mutations must re-enter the snapshot. */
    registerDynamic(elements: string | Element[]): void
  }

  const liquidGL: LiquidGLFactory
  export default liquidGL
}
