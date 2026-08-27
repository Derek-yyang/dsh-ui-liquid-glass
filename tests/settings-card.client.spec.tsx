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
    gallery: [], clarity: 0, look: DEFAULT_LOOK, lookValues: { ...RICH }, ...partial,
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
  const uploadCustom = vi.fn(async (_image: File) => {})
  const removeCustom = vi.fn(async (_id: string) => {})
  const props: LiquidGlassSettingsCardProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useSnapshot: bindSnapshotSelector(store),
    setEnabled,
    setPreset,
    uploadCustom,
    removeCustom,
    t: makeTranslate(en),
  }
  render(<LiquidGlassSettingsCard {...props} />)
  return { store, setEnabled, setPreset, uploadCustom, removeCustom }
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

  it('the gallery tiles the built-in scenes and routes a pick to setPreset', () => {
    const { setPreset } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: 'Coast line art' }))
    expect(setPreset).toHaveBeenCalledWith('coast')
  })

  it('the upload button routes the chosen file to uploadCustom', () => {
    const { uploadCustom } = mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const image = new File(['png'], 'wall.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [image] } })
    expect(uploadCustom).toHaveBeenCalledWith(image)
  })

  it('custom gallery tiles appear after an upload and can be deleted', () => {
    const { setPreset, removeCustom } = mount(cardState({
      enabled: true,
      preset: 'c_one',
      gallery: [{ id: 'one', url: 'blob:one' }],
    }))
    openBody()
    fireEvent.click(screen.getByRole('button', { name: /Custom image 1/ }))
    expect(setPreset).toHaveBeenCalledWith('c_one')
    fireEvent.click(screen.getByRole('button', { name: 'Delete this image' }))
    expect(removeCustom).toHaveBeenCalledWith('one')
  })

  it('the settings card does not host veil or clarity sliders', () => {
    mount(cardState({
      enabled: true, preset: 'c_one', gallery: [{ id: 'one', url: 'blob:one' }],
    }))
    openBody()
    expect(screen.queryByRole('slider', { name: 'Veil strength' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Clarity' })).toBeNull()
  })

  it('the settings card does not host the look picker or advanced knobs', () => {
    mount(cardState({ enabled: true, preset: 'ridge' }))
    openBody()
    expect(screen.queryByRole('button', { name: 'Rich' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Restrained' })).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Refraction' })).toBeNull()
  })
})
