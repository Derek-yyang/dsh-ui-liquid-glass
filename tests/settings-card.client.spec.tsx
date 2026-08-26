/** The Settings card component: collapse header, the toggle, and the preset
 * selector render the published snapshot and drive the write paths. */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import {
  createSnapshotStore,
  type SessionListState,
  type WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { LiquidGlassSettingsCard } from '../src/client/settings-card.tsx'
import type { LiquidGlassSettingsCardProps } from '../src/client/settings-card.tsx'
import type { LiquidGlassSnapshot } from '../src/client/controller.ts'
import { en } from '../src/client/locales.ts'
import { DEFAULT_LOOK, GLASS_LOOK_PRESETS } from '../src/look.ts'

const RICH = GLASS_LOOK_PRESETS[DEFAULT_LOOK]

function cardState(partial: Partial<LiquidGlassSnapshot> & Pick<LiquidGlassSnapshot, 'enabled' | 'preset'>): LiquidGlassSnapshot {
  return {
    custom: false, veil: 100, clarity: 0, look: DEFAULT_LOOK, lookValues: { ...RICH }, ...partial,
  }
}

afterEach(() => { cleanup() })

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

function mount(snapshot: LiquidGlassSnapshot) {
  const store = createSnapshotStore<LiquidGlassSnapshot>(snapshot)
  const setEnabled = vi.fn()
  const setPreset = vi.fn()
  const setVeil = vi.fn()
  const setClarity = vi.fn()
  const setLook = vi.fn()
  const setLookValues = vi.fn()
  const uploadCustom = vi.fn(async (_image: File) => {})
  const props: LiquidGlassSettingsCardProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useSnapshot: bindSnapshotSelector(store),
    setEnabled,
    setPreset,
    setVeil,
    setClarity,
    setLook,
    setLookValues,
    uploadCustom,
    t: makeTranslate(en),
  }
  render(<LiquidGlassSettingsCard {...props} />)
  return { store, setEnabled, setPreset, setVeil, setClarity, setLook, setLookValues, uploadCustom }
}

function openBody(): void {
  fireEvent.click(screen.getByRole('button', { name: /Liquid Glass/ }))
}

describe('LiquidGlassSettingsCard', () => {
  it('the collapsed header carries the title; expanding reveals the toggle and preset selector', () => {
    mount(cardState({ enabled: false, preset: 'ridge' }))
    expect(screen.queryByRole('button', { name: 'Off' })).toBeNull()
    openBody()
    const toggle = screen.getByRole('button', { name: 'Off' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Ridge line art' })).toBeDefined()
  })

  it('the toggle routes clicks to setEnabled and re-renders from published snapshots', () => {
    const { store, setEnabled } = mount(cardState({ enabled: false, preset: 'ridge' }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: 'Off' }))
    expect(setEnabled).toHaveBeenCalledWith(true)

    // Dock clicks and long-press cycles publish through the same store.
    act(() => { store.set(cardState({ enabled: true, preset: 'ridge' })) })
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the preset selector shows the active preset and routes the menu pick to setPreset', () => {
    const { setPreset } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: 'Ridge line art' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Gradient collage' }))
    expect(setPreset).toHaveBeenCalledWith('collage')
  })

  it('the upload button routes the chosen file to uploadCustom', () => {
    const { uploadCustom } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const image = new File(['png'], 'wall.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [image] } })
    expect(uploadCustom).toHaveBeenCalledWith(image)
  })

  it('the custom preset appears in the menu only after an upload exists', () => {
    mount(cardState({ enabled: true, preset: 'custom', custom: true, veil: 60 }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: 'Custom image' }))
    expect(screen.getByRole('menuitem', { name: 'Custom image' })).toBeDefined()
  })

  it('the veil slider renders only for the custom preset, shows the percent, and routes changes to setVeil', () => {
    // The veil paints only the custom image; other presets hide the row.
    mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    expect(screen.queryByRole('slider', { name: 'Veil strength' })).toBeNull()

    cleanup()
    const { setVeil } = mount(cardState({ enabled: true, preset: 'custom', custom: true, veil: 60 }))
    openBody()
    const slider = screen.getByRole('slider', { name: 'Veil strength' }) as HTMLInputElement
    expect(slider.value).toBe('60')
    expect(screen.getByText('60%')).toBeDefined()
    fireEvent.change(slider, { target: { value: '30' } })
    expect(setVeil).toHaveBeenCalledWith(30)
  })

  it('the clarity slider renders for every preset and routes changes to setClarity', () => {
    const { setClarity } = mount(cardState({ enabled: true, preset: 'ridge', clarity: 40 }))
    openBody()
    const slider = screen.getByRole('slider', { name: 'Clarity' }) as HTMLInputElement
    expect(slider.value).toBe('40')
    expect(screen.getByText('40%')).toBeDefined()
    fireEvent.change(slider, { target: { value: '100' } })
    expect(setClarity).toHaveBeenCalledWith(100)
  })

  it('the look picker shows the active look and routes a named pick to setLook', () => {
    const { setLook } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: 'Rich' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restrained' }))
    expect(setLook).toHaveBeenCalledWith('restrained')
  })

  it('advanced knobs stay collapsed until opened, then route a refraction drag to setLookValues', () => {
    const { setLookValues } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    expect(screen.queryByRole('slider', { name: 'Refraction' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    const slider = screen.getByRole('slider', { name: 'Refraction' }) as HTMLInputElement
    expect(slider.value).toBe(String(RICH.refraction))
    fireEvent.change(slider, { target: { value: '0.09' } })
    expect(setLookValues).toHaveBeenCalledWith({ ...RICH, refraction: 0.09 })
  })
})
