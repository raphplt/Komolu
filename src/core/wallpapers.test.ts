import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createInitialState } from './presets'
import { WALLPAPERS } from './wallpapers'
import { validateWorkspace } from './schema'
import { shareWorkspace, parsePortable } from './portability'
import { KomoluDatabase, initializeDatabase, mutateState } from './storage'

describe('wallpaper gallery portability', () => {
  it('keeps legacy v2 scenes valid', () => {
    expect(() => validateWorkspace(createInitialState().workspaces[0])).not.toThrow()
  })
  it.each(WALLPAPERS)('shares $id without media blobs or remote URLs', (wallpaper) => {
    const workspace = createInitialState().workspaces[0]
    workspace.background.wallpaperId = wallpaper.id
    const shared = shareWorkspace(workspace)
    expect(shared.background.wallpaperId).toBe(wallpaper.id)
    const parsed = parsePortable(
      JSON.stringify({
        format: 'komolu-space',
        version: 2,
        exportedAt: Date.now(),
        workspace: shared,
      }),
    )
    expect(parsed.format).toBe('komolu-space')
    expect(() => validateWorkspace(shared)).not.toThrow()
  })
  it('rejects arbitrary asset paths and incompatible gallery references', () => {
    const workspace = createInitialState().workspaces[0]
    Object.assign(workspace.background, { wallpaperId: '../../private' })
    expect(() => validateWorkspace(workspace)).toThrow()
    Object.assign(workspace.background, { wallpaperId: WALLPAPERS[0].id, type: 'solid' })
    expect(() => validateWorkspace(workspace)).toThrow()
  })
  it('persists the selected wallpaper with unchanged reading adjustments', async () => {
    const db = new KomoluDatabase(`gallery-${crypto.randomUUID()}`)
    try {
      await initializeDatabase(db)
      await mutateState((state) => {
        state.workspaces[0].background.wallpaperId = 'rainy-loft'
        state.workspaces[0].background.dim = 0.3
      }, db)
      db.close()
      await db.open()
      const saved = await db.state.get('app')
      expect(saved?.data.workspaces[0].background.wallpaperId).toBe('rainy-loft')
      expect(saved?.data.workspaces[0].background.dim).toBe(0.3)
    } finally {
      await db.delete()
    }
  })
})
