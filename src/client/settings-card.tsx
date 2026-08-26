/** The Liquid Glass card inside the Plugins settings section's configurable
 * tab: the theme toggle, the look picker, the wallpaper preset selector, and
 * the custom-image upload, driven through the controller's inject face and
 * its published snapshot. */

import { useRef, useState, type ReactNode } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WallpaperPreset } from '../tokens.ts'
import { GLASS_LOOKS } from '../look.ts'
import type { GlassLookId, NamedGlassLook } from '../look.ts'
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
  /** Scale the custom-image veil (0–100). */
  setVeil(percent: number): void
  /** Scale the glass surface tint clarity (0–100). */
  setClarity(percent: number): void
  /** Apply a named look calibration. */
  setLook(id: NamedGlassLook): void
  /** Persist an uploaded image and make it the active preset. */
  uploadCustom(image: File): Promise<void>
}

/** Full component props assembled by the Settings slot renderer. */
export type LiquidGlassSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.liquidGlass'>
  & InjectFace<LiquidGlassSettingsCardInjected>

/** Built-in presets; the custom entry appears in the menu only when an image
 * has been uploaded on this device. */
const PRESETS: readonly { id: WallpaperPreset; label: LiquidGlassLocaleKey }[] = [
  { id: 'ridge', label: 'presetRidge' },
  { id: 'collage', label: 'presetCollage' },
]

const LOOK_LABEL: Record<GlassLookId, LiquidGlassLocaleKey> = {
  restrained: 'lookRestrained',
  standard: 'lookStandard',
  rich: 'lookRich',
  custom: 'lookCustom',
}

/** Render the Liquid Glass preference card.
 * @param props - locale copy, the state store, and the write paths.
 * @returns the card, or nothing while the namespace has not loaded.
 */
export function LiquidGlassSettingsCard(
  {
    useSnapshot, setEnabled, setPreset, setVeil, setClarity, setLook, uploadCustom, t,
  }: LiquidGlassSettingsCardProps,
): ReactNode {
  const snapshot = useSnapshot(value => value)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lookMenuOpen, setLookMenuOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const presetLabel = (id: WallpaperPreset): LiquidGlassLocaleKey => {
    if (id === 'custom') return 'presetCustom'
    return PRESETS.find(preset => preset.id === id)?.label ?? 'presetRidge'
  }
  const menuItems = [
    ...PRESETS.map(preset => ({ id: preset.id, label: t(preset.label) })),
    ...(snapshot.custom ? [{ id: 'custom' as WallpaperPreset, label: t('presetCustom') }] : []),
  ]
  const lookItems = [
    ...GLASS_LOOKS.map(id => ({ id, label: t(LOOK_LABEL[id]) })),
    ...(snapshot.look === 'custom' ? [{ id: 'custom' as GlassLookId, label: t('lookCustom') }] : []),
  ]

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
            <div className={css.settingsRow}>
              <div className={css.settingsRowText}>
                <div className={css.settingsRowTitle}>{t('clarityTitle')}</div>
                <div className={css.settingsRowDesc}>{t('clarityDescription')}</div>
              </div>
              <span className={css.settingsSliderGroup}>
                <input
                  type="range"
                  className={css.settingsSlider}
                  min={0}
                  max={100}
                  step={5}
                  value={snapshot.clarity}
                  aria-label={t('clarityTitle')}
                  onChange={(event) => { setClarity(Number(event.target.value)) }}
                />
                <span className={css.settingsSliderValue}>{snapshot.clarity}%</span>
              </span>
            </div>
            <div className={css.settingsRow}>
              <div className={css.settingsRowText}>
                <div className={css.settingsRowTitle}>{t('lookTitle')}</div>
                <div className={css.settingsRowDesc}>{t('lookDescription')}</div>
              </div>
              <Menu
                open={lookMenuOpen}
                onClose={() => { setLookMenuOpen(false) }}
                items={lookItems}
                selectedId={snapshot.look}
                onSelect={(id) => {
                  setLookMenuOpen(false)
                  if (id === 'custom') return
                  setLook(id as NamedGlassLook)
                }}
                align="end"
                side="top"
                portal
                anchor={(
                  <button
                    type="button"
                    className={css.settingsSelector}
                    aria-haspopup="menu"
                    aria-expanded={lookMenuOpen}
                    onClick={() => { setLookMenuOpen(value => !value) }}
                  >
                    {t(LOOK_LABEL[snapshot.look])}
                    <IconChevronDownOutline14 size={12} aria-hidden="true" />
                  </button>
                )}
              />
            </div>
            <div className={css.settingsRow}>
              <div className={css.settingsRowText}>
                <div className={css.settingsRowTitle}>{t('presetTitle')}</div>
                <div className={css.settingsRowDesc}>{t('presetDescription')}</div>
              </div>
              <Menu
                open={menuOpen}
                onClose={() => { setMenuOpen(false) }}
                items={menuItems}
                selectedId={snapshot.preset}
                onSelect={(id) => {
                  setMenuOpen(false)
                  setPreset(id as WallpaperPreset)
                }}
                align="end"
                side="top"
                portal
                anchor={(
                  <button
                    type="button"
                    className={css.settingsSelector}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => { setMenuOpen(value => !value) }}
                  >
                    {t(presetLabel(snapshot.preset))}
                    <IconChevronDownOutline14 size={12} aria-hidden="true" />
                  </button>
                )}
              />
            </div>
            <div className={css.settingsRow}>
              <div className={css.settingsRowText}>
                <div className={css.settingsRowTitle}>{t('customTitle')}</div>
                <div className={css.settingsRowDesc}>{t('customDescription')}</div>
              </div>
              <button
                type="button"
                className={css.settingsSelector}
                onClick={() => { fileInput.current?.click() }}
              >
                {t('upload')}
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
            {snapshot.preset === 'custom' && (
              <div className={css.settingsRow}>
                <div className={css.settingsRowText}>
                  <div className={css.settingsRowTitle}>{t('veilTitle')}</div>
                  <div className={css.settingsRowDesc}>{t('veilDescription')}</div>
                </div>
                <span className={css.settingsSliderGroup}>
                  <input
                    type="range"
                    className={css.settingsSlider}
                    min={0}
                    max={100}
                    step={5}
                    value={snapshot.veil}
                    aria-label={t('veilTitle')}
                    onChange={(event) => { setVeil(Number(event.target.value)) }}
                  />
                  <span className={css.settingsSliderValue}>{snapshot.veil}%</span>
                </span>
              </div>
            )}
          </div>
        )
        : null}
    </li>
  )
}
