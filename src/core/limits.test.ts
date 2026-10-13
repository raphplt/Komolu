import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_MEDIA_COUNT,
  MAX_TASKS,
  MAX_THOUGHTS,
  MAX_TRACKS,
  MAX_WIDGETS,
  MAX_WORKSPACES,
} from './limits'
import { createInitialState, createWorkspace } from './presets'
import { initializeDatabase, KomoluDatabase, mutateState } from './storage'
import { saveMedia } from './media'
import type { AppState, MediaRecord } from './model'
const databases: KomoluDatabase[] = []
function database() {
  const db = new KomoluDatabase(`limits-${crypto.randomUUID()}`)
  databases.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})
describe('local admission and export bounds', () => {
  it.each([
    [
      'espaces',
      (state: AppState) => {
        state.workspaces = Array.from({ length: MAX_WORKSPACES + 1 }, () =>
          createWorkspace('minimal'),
        )
      },
    ],
    [
      'widgets',
      (state: AppState) => {
        state.workspaces[0].widgets = Array.from({ length: MAX_WIDGETS + 1 }, () => ({
          ...state.workspaces[0].widgets[0],
          id: crypto.randomUUID(),
        }))
      },
    ],
    [
      'pistes',
      (state: AppState) => {
        state.workspaces[0].audio.tracks = Array.from({ length: MAX_TRACKS + 1 }, () => ({
          ...state.workspaces[0].audio.tracks[0],
          id: crypto.randomUUID(),
        }))
      },
    ],
    [
      'tâches',
      (state: AppState) => {
        state.privateData.tasks = Array.from({ length: MAX_TASKS + 1 }, () => ({
          id: crypto.randomUUID(),
          title: 'Tâche',
          done: false,
          createdAt: 0,
        }))
      },
    ],
    [
      'pensées',
      (state: AppState) => {
        state.privateData.thoughts = Array.from({ length: MAX_THOUGHTS + 1 }, () => ({
          id: crypto.randomUUID(),
          text: 'Pensée',
          createdAt: 0,
        }))
      },
    ],
    [
      'caractères',
      (state: AppState) => {
        state.workspaces[0].name = 'x'.repeat(201)
      },
    ],
  ] as const)('rejects excess %s without partially saving other changes', async (label, modify) => {
    const db = database()
    await initializeDatabase(db)
    const initial = (await db.state.get('app'))!.data
    await expect(
      mutateState((state) => {
        state.privateData.notes = 'Ne pas écrire'
        modify(state)
      }, db),
    ).rejects.toThrow(label)
    expect((await db.state.get('app'))!.data).toEqual(initial)
  })
  it('accepts a full workspace list but prevents concurrent additions from exceeding its bound', async () => {
    const db = database(),
      initial = createInitialState()
    initial.workspaces = Array.from({ length: MAX_WORKSPACES - 1 }, () =>
      createWorkspace('minimal'),
    )
    initial.activeWorkspaceId = initial.workspaces[0].id
    await db.state.put({ id: 'app', data: initial })
    const results = await Promise.allSettled([
      mutateState((state) => {
        state.workspaces.push(createWorkspace('cozy'))
      }, db),
      mutateState((state) => {
        state.workspaces.push(createWorkspace('deep'))
      }, db),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await db.state.get('app'))!.data.workspaces).toHaveLength(MAX_WORKSPACES)
  })
  it('caps media count transactionally while allowing an existing asset to be replaced', async () => {
    const db = database(),
      blob = new Blob(['x'], { type: 'image/png' })
    const media = (id: string): MediaRecord => ({
      id,
      name: 'Image',
      mimeType: blob.type,
      kind: 'image',
      size: blob.size,
      blob,
      createdAt: 0,
    })
    await db.media.bulkAdd(
      Array.from({ length: MAX_MEDIA_COUNT - 1 }, (_, i) => media(`media-${i}`)),
    )
    const results = await Promise.allSettled([
      saveMedia(media('last-a'), db),
      saveMedia(media('last-b'), db),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await db.media.count()).toBe(MAX_MEDIA_COUNT)
    await expect(saveMedia(media('media-0'), db)).resolves.toBeUndefined()
    expect(await db.media.count()).toBe(MAX_MEDIA_COUNT)
  })
})
