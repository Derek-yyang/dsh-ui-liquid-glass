/** The Liquid Glass card inside the Plugins settings section's configurable
 * tab: the theme toggle and the wallpaper gallery, driven through the
 * controller's inject face and its published snapshot. Look and clarity live
 * on the droplet popover. */

import { useRef, useState, type ReactNode } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { WALLPAPER_PRESETS, type WallpaperPreset } from '../tokens.ts'
import { customPresetId } from './wallpaper-store.ts'
import type { LiquidGlassSnapshot } from './controller.ts'
import type { LiquidGlassLocaleKey } from './locales.ts'
import css from './glass.module.css'

/** Registration-side face: the live state store and the write paths. */
export interface LiquidGlassSettingsCardInjected {
  hooks: {
    /** Published controller state, bound as useSnapshot. */
    snapshot: SnapshotStore<LiquidGlassSnapshot>
  }
  /** Apply or remove the theme. */
  setEnabled(enabled: boolean): void
  /** Switch the wallpaper preset. */
  setPreset(preset: WallpaperPreset): void
  /** Persist an uploaded image, append it to the gallery, and make it active. */
  uploadCustom(image: File): Promise<void>
  /** Remove one custom image from this device. */
  removeCustom(id: string): Promise<void>
}

/** Full component props assembled by the Settings slot renderer. */
export type LiquidGlassSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.liquidGlass'>
  & InjectFace<LiquidGlassSettingsCardInjected>

/** Built-in presets; the custom entry appears in the menu only when an image
 * has been uploaded on this device. */
const PRESET_LABEL: Record<(typeof WALLPAPER_PRESETS)[number], LiquidGlassLocaleKey> = {
  ridge: 'presetRidge',
  coast: 'presetCoast',
  garden: 'presetGarden',
  arch: 'presetArch',
}

/** Render the Liquid Glass preference card.
 * @param props - locale copy, the state store, and the write paths.
 * @returns the card, or nothing while the namespace has not loaded.
 */
export function LiquidGlassSettingsCard(
  {
    useSnapshot, setEnabled, setPreset, uploadCustom, removeCustom, t,
  }: LiquidGlassSettingsCardProps,
): ReactNode {
  const snapshot = useSnapshot(value => value)
  const [open, setOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  return (
    <li className={css.card}>
      <button
        type="button"
        className={css.cardHeader}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className={css.cardHeadText}>
          <span className={css.cardTitle}>{t('cardTitle')}</span>
          <span className={css.cardDescription}>{t('cardDescription')}</span>
        </span>
        <IconChevronDownOutline14 size={12} aria-hidden="true" />
      </button>
      {open
        ? (
          <div className={css.cardBody}>
            <div className={css.settingsRow}>
              <div className={css.settingsRowText}>
                <div className={css.settingsRowTitle}>{t('effectTitle')}</div>
                <div className={css.settingsRowDesc}>{t('effectDescription')}</div>
              </div>
              <button
                type="button"
                className={css.settingsToggle}
                aria-pressed={snapshot.enabled}
                onClick={() => { setEnabled(!snapshot.enabled) }}
              >
                {snapshot.enabled ? t('stateOn') : t('stateOff')}
              </button>
            </div>
            <div>
              <div className={css.settingsRowTitle}>{t('presetTitle')}</div>
              <div className={css.settingsRowDesc}>{t('presetDescription')}</div>
              <div className={css.gallery}>
                {WALLPAPER_PRESETS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`${css.galleryTile} ${css[id]} ${snapshot.preset === id ? css.gallerySelected : ''}`}
                    aria-pressed={snapshot.preset === id}
                    onClick={() => { setPreset(id) }}
                  >
                    <span className={css.galleryCaption}>{t(PRESET_LABEL[id])}</span>
                  </button>
                ))}
                {snapshot.gallery.map((entry, index) => {
                  const preset = customPresetId(entry.id)
                  return (
                    <div key={entry.id} className={`${css.galleryTile} ${snapshot.preset === preset ? css.gallerySelected : ''}`}>
                      <button
                        type="button"
                        className={css.galleryThumb}
                        aria-pressed={snapshot.preset === preset}
                        style={{ backgroundImage: `url("${entry.url}")` }}
                        onClick={() => { setPreset(preset) }}
                      >
                        <span className={css.galleryCaption}>{t('presetCustom')} {index + 1}</span>
                      </button>
                      <button
                        type="button"
                        className={css.galleryDelete}
                        aria-label={t('deleteCustom')}
                        onClick={() => { void removeCustom(entry.id) }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  className={`${css.galleryTile} ${css.galleryAdd}`}
                  onClick={() => { fileInput.current?.click() }}
                >
                  <span className={css.galleryAddMark}>+</span>
                  <span>{t('upload')}</span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={() => {
                    const input = fileInput.current
                    const file = input?.files?.[0]
                    if (file !== undefined) void uploadCustom(file)
                    if (input !== null) input.value = ''
                  }}
                />
              </div>
            </div>
          </div>
        )
        : null}
    </li>
  )
}
