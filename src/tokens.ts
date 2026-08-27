/**
 * Liquid Glass alias-token overrides, shared by the client controller (which
 * registers them as one `overrideTokens` layer) and the invariant companion
 * (which recognizes the layer's marker values). Values are literal CSS colors:
 * translucent surfaces let the plugin-owned wallpaper show through, while
 * text, state, mask, and scrollbar tokens stay on the base palette so
 * legibility does not depend on this plugin.
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** This plugin's override-layer identity and DOM namespace marker. */
export const PACKAGE_ID = 'dsh-ui-liquid-glass'

/** The settings namespace this plugin owns: the Host-side section holding the
 * toggle and the wallpaper preset (the unbranded string is what the browser
 * scope binds and what the card registration keys on). */
export const SETTINGS_NAMESPACE = 'liquid-glass'

/** Wallpaper presets in long-press cycling order; the first is the default.
 * All built-ins are line-art scenes with hard edges for the refraction to
 * bend. A Host document still holding the retired `collage` id falls back
 * to `ridge`. */
export const WALLPAPER_PRESETS = ['ridge', 'coast', 'garden', 'arch'] as const

/** All wallpaper preset ids. `custom` is a user-uploaded image persisted in
 * IndexedDB (device-local — the Host namespace only stores the id); it never
 * enters the dock's cycle, because cycling onto it without an uploaded image
 * would just fall back. `collage` is a retired Host id that paints as `ridge`. */
export type WallpaperPreset = (typeof WALLPAPER_PRESETS)[number] | 'custom' | 'collage'

/** DOM marker of the plugin-owned wallpaper layer (the refraction source). */
export const WALLPAPER_SELECTOR = '[data-dsh-liquid-glass-wallpaper]'

/** Stable selector of the app-owned composer card this plugin glassifies. */
export const COMPOSER_SELECTOR = '[data-composer-card]'

/** Stable selector of the composer seat wrapper this plugin lifts above the
 * library's body-level lens canvas in the phases ui-conversation does not. */
export const SEAT_SELECTOR = '[data-composer-seat]'

/** Stable selector of the app-owned sidebar column (ui-layout marker) this
 * plugin frosts with a backdrop blur. */
export const SIDEBAR_SELECTOR = '[data-app-sidebar]'

/** Stable selector of app-owned modal panels (the ui-primitives dialog card
 * and the settings shell panel) this plugin frosts with the same backdrop
 * blur as the sidebar: their translucent layer-2 fill alone lets dense text
 * behind read through as sharp noise. */
export const MODAL_PANEL_SELECTOR = '[data-modal-panel]'

/** The settings shell dialog. Distinct from other `role=dialog` surfaces
 * (ui-primitives Modal is not `aria-modal`) so this plugin can give the
 * settings panel an opaque fill without changing global surface tokens. */
export const SETTINGS_DIALOG_SELECTOR = '[role="dialog"][aria-modal="true"]'

/** Portal menus (`position: fixed` on body). Their `--dsw-specific-menu`
 * fill follows global clarity and would show the page through a picker;
 * this plugin restores an opaque fill on these lists only. */
export const PORTAL_MENU_SELECTOR = 'body > [role="menu"]'

/** Stable selector of the app-owned conversation scrollport whose scroll
 * position drives the wallpaper's parallax translation. */
export const SCROLL_SELECTOR = '[data-conversation-scroll]'

/** DOM marker set on the composer card while it is glassified. */
export const GLASS_MARKER = 'data-dsh-liquid-glass-composer'

/** DOM marker of the plugin-owned fixed toggle dock. */
export const DOCK_SELECTOR = '[data-dsh-liquid-glass-dock]'

/** DOM marker of the dock's right-click look-tuning popover. */
export const TUNING_PANEL_SELECTOR = '[data-dsh-liquid-glass-tuning]'

/** CSS custom property the controller drives with the custom-image veil
 * strength (0–1); the custom preset's gradient multiplies its stop alphas by
 * it, so 0 shows the raw image and the default 1 is the shipped calibration. */
export const VEIL_VAR = '--dsh-liquid-glass-veil'

/** Shipped veil strength, in percent — the default the slider and the Host
 * schema fall back to. */
export const VEIL_DEFAULT_PERCENT = 100

/** Shipped surface calibration, in percent — clarity 0. The slider and the
 * Host schema fall back to it. */
export const CLARITY_DEFAULT_PERCENT = 0

/** Wallpaper preset-swap crossfade. The live layer paints the new scene
 * underneath immediately; the outgoing clone fades out over this window, and
 * the refraction snapshot recaptures only once the outgoing layer is gone so
 * the lens and the wallpaper settle together. `prefers-reduced-motion: reduce`
 * skips the fade and recaptures in the same turn. */
export const WALLPAPER_CROSSFADE_MS = 150

/** The light-mode value of `--dsw-alias-bg-base` — the layer's presence marker. */
export const BG_BASE_LIGHT = 'rgba(255, 255, 255, 0.32)'

/** The dark-mode value of `--dsw-alias-bg-base` — the layer's presence marker. */
export const BG_BASE_DARK = 'rgba(16, 17, 22, 0.35)'

/**
 * The complete liquid-glass surface system: every alias whose base value
 * paints an opaque surface or hairline gets a translucent glass value in both
 * palette modes (the override API requires the pair even when a value is
 * scheme-invariant). Labels, state colors, masks, and scrollbars are
 * deliberately not listed — they keep the base palette. The sidebar tokens
 * return as deliberately weak values: the column is frosted (the controller
 * blurs its backdrop), so a low fill alpha reads as frosted glass, while the
 * old 0.34 value stacked on the frame's translucent `bg-base` into a ~0.55
 * white veil that washed the column out.
 */
export const LIQUID_GLASS_TOKENS: ThemeTokenOverrides = {
  '--dsw-alias-bg-base': { light: BG_BASE_LIGHT, dark: BG_BASE_DARK },
  '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.58)', dark: 'rgba(27, 27, 31, 0.55)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(255, 255, 255, 0.46)', dark: 'rgba(23, 23, 27, 0.48)' },
  '--dsw-alias-bg-layer-3': { light: 'rgba(255, 255, 255, 0.66)', dark: 'rgba(33, 33, 38, 0.62)' },
  '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.40)', dark: 'rgba(24, 24, 29, 0.45)' },
  '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.52)', dark: 'rgba(30, 30, 36, 0.55)' },
  '--dsw-alias-bg-overlay': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(20, 20, 26, 0.72)' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(0, 0, 0, 0.05)', dark: 'rgba(255, 255, 255, 0.08)' },
  '--dsw-alias-border-l1': { light: 'rgba(30, 41, 59, 0.08)', dark: 'rgba(255, 255, 255, 0.09)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(30, 41, 59, 0.10)', dark: 'rgba(255, 255, 255, 0.09)' },
  '--dsw-alias-border-l2': { light: 'rgba(30, 41, 59, 0.12)', dark: 'rgba(255, 255, 255, 0.12)' },
  '--dsw-alias-border-l3': { light: 'rgba(30, 41, 59, 0.14)', dark: 'rgba(255, 255, 255, 0.15)' },
  '--dsw-alias-border-l4': { light: 'rgba(30, 41, 59, 0.18)', dark: 'rgba(255, 255, 255, 0.19)' },
  '--dsw-alias-button-contrast-fill': { light: 'rgba(28, 32, 38, 0.82)', dark: 'rgba(232, 234, 240, 0.85)' },
  '--dsw-alias-button-elevated-fill': { light: 'rgba(255, 255, 255, 0.62)', dark: 'rgba(40, 40, 46, 0.66)' },
  '--dsw-alias-button-floating-fill': { light: 'rgba(255, 255, 255, 0.62)', dark: 'rgba(40, 40, 46, 0.66)' },
  '--dsw-alias-button-floating-hover': { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(48, 48, 54, 0.78)' },
  '--dsw-alias-button-ghost-active-border': { light: 'rgba(65, 118, 230, 0.35)', dark: 'rgba(103, 158, 254, 0.40)' },
  '--dsw-alias-button-ghost-active-fill': { light: 'rgba(65, 118, 230, 0.12)', dark: 'rgba(103, 158, 254, 0.16)' },
  '--dsw-alias-button-ghost-active-hover': { light: 'rgba(65, 118, 230, 0.18)', dark: 'rgba(103, 158, 254, 0.24)' },
  '--dsw-alias-button-tool-bar-fill': { light: 'rgba(84, 85, 87, 0.40)', dark: 'rgba(84, 85, 87, 0.40)' },
  '--dsw-alias-button-tool-bar-hover': { light: 'rgba(84, 85, 87, 0.50)', dark: 'rgba(84, 85, 87, 0.50)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: 'rgba(255, 255, 255, 0.50)', dark: 'rgba(48, 48, 54, 0.70)' },
  '--dsw-alias-markdown-citation': { light: 'rgba(235, 238, 242, 0.70)', dark: 'rgba(40, 40, 46, 0.70)' },
  '--dsw-alias-markdown-code-block-banner': { light: 'rgba(246, 248, 252, 0.72)', dark: 'rgba(30, 30, 34, 0.72)' },
  '--dsw-alias-markdown-code-block': { light: 'rgba(246, 248, 252, 0.72)', dark: 'rgba(24, 24, 28, 0.72)' },
  '--dsw-alias-markdown-code-segment-selected': { light: 'rgba(255, 255, 255, 0.85)', dark: 'rgba(48, 48, 54, 0.85)' },
  '--dsw-alias-markdown-code-segment-unselected': { light: 'rgba(241, 243, 245, 0.75)', dark: 'rgba(30, 30, 36, 0.80)' },
  '--dsw-alias-markdown-inline-code': { light: 'rgba(235, 238, 242, 0.80)', dark: 'rgba(40, 40, 46, 0.80)' },
  '--dsw-alias-markdown-placeholder': { light: 'rgba(245, 246, 247, 0.70)', dark: 'rgba(35, 35, 40, 0.70)' },
  '--dsw-alias-markdown-tag': { light: 'rgba(241, 243, 245, 0.80)', dark: 'rgba(36, 36, 42, 0.80)' },
  '--dsw-specific-bubble': { light: 'rgba(237, 243, 254, 0.66)', dark: 'rgba(36, 36, 44, 0.70)' },
  '--dsw-specific-bubble-highlight': { light: 'rgba(211, 226, 255, 0.80)', dark: 'rgba(58, 58, 68, 0.80)' },
  '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.60)', dark: 'rgba(28, 28, 33, 0.62)' },
  '--dsw-specific-login-input': { light: 'rgba(255, 255, 255, 0.50)', dark: 'rgba(22, 22, 27, 0.55)' },
  '--dsw-specific-menu': { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(28, 28, 34, 0.80)' },
  '--dsw-specific-selector': { light: 'rgba(255, 255, 255, 0.45)', dark: 'rgba(30, 30, 36, 0.50)' },
  '--dsw-specific-sidebar-fill': { light: 'rgba(255, 255, 255, 0.18)', dark: 'rgba(18, 18, 23, 0.25)' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: 'rgba(103, 158, 254, 0.35)', dark: 'rgba(86, 134, 254, 0.32)' },
  '--dsw-specific-sidebar-nav-item-active': { light: 'rgba(255, 255, 255, 0.55)', dark: 'rgba(255, 255, 255, 0.10)' },
  '--dsw-specific-sidebar-nav-item-hover': { light: 'rgba(255, 255, 255, 0.42)', dark: 'rgba(255, 255, 255, 0.07)' },
  '--dsw-specific-tip': { light: 'rgba(255, 255, 255, 0.50)', dark: 'rgba(30, 30, 36, 0.55)' },
  '--dsw-alias-toast-bg': { light: 'rgba(53, 54, 56, 0.82)', dark: 'rgba(40, 40, 46, 0.85)' },
  '--dsw-alias-tooltip-bg': { light: 'rgba(44, 44, 46, 0.85)', dark: 'rgba(40, 40, 46, 0.88)' },
}

/** Static surface fills fade to fully transparent at the clarity endpoint —
 * they are pure color casts over the wallpaper, so no trace of them remains. */
const CLEAR_SURFACES: ReadonlySet<string> = new Set([
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-module-platform',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-bg-skeleton',
  '--dsw-specific-sidebar-fill',
  '--dsw-specific-menu',
  '--dsw-specific-selector',
  '--dsw-specific-tip',
  '--dsw-specific-bubble',
  '--dsw-specific-bubble-highlight',
  '--dsw-alias-markdown-citation',
  '--dsw-alias-markdown-code-block-banner',
  '--dsw-alias-markdown-code-block',
  '--dsw-alias-markdown-inline-code',
  '--dsw-alias-markdown-placeholder',
  '--dsw-alias-markdown-tag',
])

/** Interactive and transient fills keep a usable floor at the clarity
 * endpoint: hover, selection, and input surfaces must stay perceptible for
 * the UI to remain operable, and toasts and tooltips must stay readable. */
const FLOORED_SURFACES: Readonly<Record<string, number>> = {
  '--dsw-alias-bg-multi-select': 0.12,
  '--dsw-alias-interactive-bg-hover-solid': 0.12,
  '--dsw-alias-button-elevated-fill': 0.25,
  '--dsw-alias-button-floating-fill': 0.25,
  '--dsw-alias-button-floating-hover': 0.3,
  '--dsw-alias-button-ghost-active-fill': 0.08,
  '--dsw-alias-button-ghost-active-hover': 0.06,
  '--dsw-alias-button-tool-bar-fill': 0.12,
  '--dsw-alias-button-tool-bar-hover': 0.18,
  '--dsw-alias-markdown-code-segment-selected': 0.3,
  '--dsw-alias-markdown-code-segment-unselected': 0.2,
  '--dsw-specific-sidebar-nav-item-active': 0.12,
  '--dsw-specific-sidebar-nav-item-hover': 0.1,
  '--dsw-specific-input-major': 0.15,
  '--dsw-specific-login-input': 0.12,
  '--dsw-alias-toast-bg': 0.5,
  '--dsw-alias-tooltip-bg': 0.5,
}

const RGBA_VALUE = /^(rgba?\(.+),\s*([\d.]+)\)$/

/**
 * Interpolate the token table between the shipped calibration (clarity 0)
 * and the clear endpoint (clarity 100): static surface fills fade to fully
 * transparent, floored fills fade to their minimum, and everything else
 * (borders, the contrast button, the colored accent) stays stock — they are
 * the glass's edges and interactive feedback, not color casts.
 * @param tokens - the shipped override table.
 * @param clarity - surface clarity in percent (0–100).
 * @returns the table to register for that clarity.
 */
export function scaleSurfaceTokens(tokens: ThemeTokenOverrides, clarity: number): ThemeTokenOverrides {
  const t = Math.max(0, Math.min(1, clarity / 100))
  if (t === 0) return tokens
  const scaled: ThemeTokenOverrides = {}
  for (const [name, modes] of Object.entries(tokens)) {
    const floor = CLEAR_SURFACES.has(name) ? 0 : FLOORED_SURFACES[name]
    scaled[name] = floor === undefined
      ? modes
      : {
        light: scaleAlpha(modes.light, t, floor),
        dark: scaleAlpha(modes.dark, t, floor),
      }
  }
  return scaled
}

/** Scale one literal `rgba(…, a)` value's alpha toward its floor by t: t=0
 * keeps the stock alpha, t=1 lands on the floor. */
function scaleAlpha(value: string, t: number, floor: number): string {
  const match = RGBA_VALUE.exec(value)
  // Owned constants: every entry carries an alpha channel, so an unmatched
  // value would be a table typo — keep the stock string rather than emit a
  // malformed color.
  if (match === null) return value
  const stock = Number(match[2])
  const scaled = stock + (floor - stock) * t
  return `${match[1]}, ${Number(scaled.toFixed(3))})`
}
