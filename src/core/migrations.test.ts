import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import legacyFixture from './fixtures/v1-backup.json'
import { migratePortable, migrateState } from './migrations'
import { validatePortable, validateState } from './schema'
import {
  validatePortable as validateLegacyPortable,
  type Backup as LegacyBackup,
} from './schema-v1'
import { KomoluDatabase, initializeDatabase } from './storage'
import { applyImport, exportBackup, prepareImport, shareWorkspace } from './portability'
import { createInitialState } from './presets'
import type { AppState } from './model'

const names: string[] = []
afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)))
})
function legacy(): LegacyBackup {
  const file: unknown = structuredClone(legacyFixture)
  validateLegacyPortable(file)
  if (file.format !== 'komolu-backup') throw new Error('Fixture must be a backup')
  return file
}
function name() {
  const value = `migrations-${crypto.randomUUID()}`
  names.push(value)
  return value
}

describe('v1 to v2 migration', () => {
  it('preserves private data, live session, media references and all pre-existing workspace settings', () => {
    const before = legacy()
    const other = structuredClone(before.state.workspaces[0])
    other.id = 'other-space'
    before.state.workspaces.push(other)
    const migrated = migratePortable(before)
    expect(() => validatePortable(migrated)).not.toThrow()
    if (migrated.format !== 'komolu-backup') throw new Error('Unexpected format')
    expect(migrated.version).toBe(2)
    expect(migrated.state.schemaVersion).toBe(2)
    expect(migrated.state.privateData).toEqual(before.state.privateData)
    expect(migrated.state.timer).toEqual(before.state.timer)
    expect(migrated.state.dataEpoch).toBe(before.state.dataEpoch)
    expect(migrated.media).toEqual(before.media)
    expect(migrated.state.workspaces[0].focusMode).toBe(true)
    expect(migrated.state.workspaces[1].focusMode).toBe(false)
    expect(migrated.state.preferences).not.toHaveProperty('focusMode')
    for (const [index, workspace] of migrated.state.workspaces.entries()) {
      const original = before.state.workspaces[index]
      expect(workspace.palette).toBe('cozy')
      expect(workspace.widgets).toEqual(original.widgets)
      expect(workspace.background).toMatchObject(original.background)
      expect(workspace.timerProfile).toEqual(original.timerProfile)
      expect(workspace.audio.master).toBe(original.audio.master)
      expect(workspace.audio.muted).toBe(original.audio.muted)
      expect(workspace.audio.tracks.slice(0, original.audio.tracks.length)).toEqual(
        original.audio.tracks,
      )
      expect(
        workspace.audio.tracks.slice(original.audio.tracks.length).every((track) => !track.enabled),
      ).toBe(true)
      expect(new Set(workspace.audio.tracks.map((track) => track.id)).size).toBe(
        workspace.audio.tracks.length,
      )
    }
    expect(before).toEqual({
      ...legacy(),
      state: { ...legacy().state, workspaces: before.state.workspaces },
    })
  })

  it('upgrades a real version-one database atomically and retains Blob bytes', async () => {
    const databaseName = name()
    const old = new Dexie(databaseName)
    old.version(1).stores({ state: 'id', media: 'id, kind, createdAt' })
    const before = legacy()
    await old.table('state').put({ id: 'app', data: before.state })
    for (const media of before.media) {
      const { data, ...record } = media
      await old.table('media').put({
        ...record,
        blob: new Blob([Uint8Array.from(atob(data), (char) => char.charCodeAt(0))], {
          type: media.mimeType,
        }),
      })
    }
    old.close()
    const db = new KomoluDatabase(databaseName)
    try {
      await initializeDatabase(db)
      expect(db.verno).toBe(2)
      const state = (await db.state.get('app'))!.data
      expect(() => validateState(state)).not.toThrow()
      expect(state.privateData).toEqual(before.state.privateData)
      expect(state.timer).toEqual(before.state.timer)
      expect(state.dataEpoch).toBe('retained-epoch')
      for (const original of before.media) {
        const stored = (await db.media.get(original.id))!
        expect(stored.name).toBe(original.name)
        expect(stored.blob.type).toBe(original.mimeType)
        expect(new Uint8Array(await stored.blob.arrayBuffer())).toEqual(
          Uint8Array.from(atob(original.data), (char) => char.charCodeAt(0)),
        )
      }
    } finally {
      db.close()
    }
  })

  it('imports a legacy backup through validation and exports v2 without dropping data', async () => {
    const db = new KomoluDatabase(name())
    try {
      await initializeDatabase(db)
      // Content-decoder behavior is independently covered by media/browser tests.
      const prepared = await prepareImport(JSON.stringify(legacy()), async () => undefined)
      await applyImport(prepared, 'replace', db)
      const result = await exportBackup(db)
      expect(result.version).toBe(2)
      expect(result.state.privateData).toEqual(legacy().state.privateData)
      expect(result.media.map((media) => media.data)).toEqual(
        legacy()
          .media.sort((a, b) => a.id.localeCompare(b.id))
          .map((media) => media.data),
      )
      expect(result.state.timer.status).toBe('paused')
      expect(result.state.timer.remainingMs).toBe(1_200_000)
    } finally {
      db.close()
    }
  })

  it('does not overwrite a full legacy track library or its imported media tracks', () => {
    const before = legacy().state
    const workspace = before.workspaces[0]
    workspace.audio.tracks = Array.from({ length: 50 }, (_, i) => ({
      id: `custom-${i}`,
      source: 'brown',
      name: `Piste ${i}`,
      enabled: false,
      volume: 0.2,
    }))
    const after = migrateState(before)
    expect(after.workspaces[0].audio.tracks).toEqual(workspace.audio.tracks)
  })

  it('allocates bounded native IDs when imported track identifiers already collide', () => {
    const before = legacy().state
    before.workspaces[0].audio.tracks = Array.from({ length: 32 }, (_, index) => ({
      id: index === 0 ? 'white' : `native-white-${index}`,
      source: 'brown',
      name: `Piste ${index}`,
      enabled: false,
      volume: 0.2,
    }))
    const after = migrateState(before)
    const tracks = after.workspaces[0].audio.tracks
    expect(tracks.find((track) => track.source === 'white')?.id).toBe('native-white-32')
    expect(tracks.every((track) => track.id.length <= 200)).toBe(true)
    expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length)
    expect(() => validateState(after)).not.toThrow()
  })

  it('removes only the three known generated descriptions, preserving personal text', () => {
    for (const description of [
      'De l’espace pour tes idées.',
      'Un refuge, juste pour toi.',
      'Le calme des heures bleues.',
    ]) {
      const before = legacy().state
      before.workspaces[0].description = description
      expect(migrateState(before).workspaces[0].description).toBe('')
    }
    expect(migrateState(legacy().state).workspaces[0].description).toBe('Description personnelle')
  })

  it('migrates legacy shared presets with fresh defaults and no private data', () => {
    const before = legacy().state.workspaces[0]
    before.background.type = 'scene'
    delete before.background.mediaId
    before.audio.tracks = before.audio.tracks.filter((track) => track.source !== 'media')
    const result = migratePortable({
      format: 'komolu-space',
      version: 1,
      exportedAt: 1,
      workspace: before,
    })
    if (result.format !== 'komolu-space') throw new Error('Unexpected format')
    expect(result.workspace.focusMode).toBe(false)
    expect(result.workspace.palette).toBe('cozy')
    expect(result.workspace.audio.tracks).toHaveLength(9)
    expect(result).not.toHaveProperty('state')
  })

  it('rolls back an unsupported old database upgrade instead of replacing its contents', async () => {
    const databaseName = name()
    const old = new Dexie(databaseName)
    old.version(1).stores({ state: 'id', media: 'id, kind, createdAt' })
    const original = { ...legacy().state, schemaVersion: 99 }
    await old.table('state').put({ id: 'app', data: original })
    old.close()
    const db = new KomoluDatabase(databaseName)
    await expect(db.open()).rejects.toThrow()
    db.close()
    const reopened = new Dexie(databaseName)
    try {
      await reopened.open()
      expect(reopened.verno).toBe(1)
      expect((await reopened.table('state').get('app')).data).toEqual(original)
    } finally {
      reopened.close()
    }
  })

  it('validates the old contract before conversion and refuses unsafe, hybrid and future files', () => {
    for (const mutation of [
      (file: ReturnType<typeof legacy>) => {
        Object.assign(file.state.workspaces[0].widgets[0].settings, {
          color: 'url(https://example.com)',
        })
      },
      (file: ReturnType<typeof legacy>) => {
        Object.assign(file.state.workspaces[0], { palette: 'deep' })
      },
      (file: ReturnType<typeof legacy>) => {
        Object.assign(file, { version: 99 })
      },
      (file: ReturnType<typeof legacy>) => {
        Object.assign(file.state, { schemaVersion: 99 })
      },
    ]) {
      const file = legacy()
      mutation(file)
      expect(() => migratePortable(file)).toThrow(/Import refusé/)
    }
  })

  it('is idempotent for v2 and shares gradient/palette/clock settings without private data', () => {
    const state = createInitialState()
    const workspace = state.workspaces[0]
    workspace.background.type = 'gradient'
    workspace.background.gradient = { from: '#345678', to: '#abcdef', angle: 35 }
    workspace.palette = 'deep'
    workspace.focusMode = true
    workspace.widgets[0].settings.color = '#abc123'
    workspace.widgets[0].settings.shadow = 'soft'
    state.privateData.notes = 'Never shared'
    expect(migrateState(state)).toEqual(state)
    const shared = shareWorkspace(workspace)
    expect(shared.background.gradient).toEqual(workspace.background.gradient)
    expect(shared.background.type).toBe('gradient')
    expect(shared.palette).toBe('deep')
    expect(shared.focusMode).toBe(true)
    expect(shared.widgets[0].settings).toEqual(workspace.widgets[0].settings)
    expect(JSON.stringify(shared)).not.toContain('Never shared')
    expect(() =>
      validatePortable({
        format: 'komolu-space',
        version: 2,
        exportedAt: Date.now(),
        workspace: shared,
      }),
    ).not.toThrow()
  })

  it.each([
    [
      'solid CSS injection',
      (state: AppState) => {
        state.workspaces[0].background.solidColor = 'url(https://example.com)'
      },
    ],
    [
      'gradient CSS injection',
      (state: AppState) => {
        state.workspaces[0].background.gradient.from = 'red;display:none'
      },
    ],
    [
      'unbounded gradient angle',
      (state: AppState) => {
        state.workspaces[0].background.gradient.angle = Infinity
      },
    ],
    [
      'out-of-range tint',
      (state: AppState) => {
        state.workspaces[0].background.tintOpacity = 2
      },
    ],
    [
      'clock CSS injection',
      (state: AppState) => {
        state.workspaces[0].widgets[0].settings.color = 'var(--untrusted)'
      },
    ],
    [
      'unknown shadow',
      (state: AppState) => {
        Object.assign(state.workspaces[0].widgets[0].settings, { shadow: 'custom-css' })
      },
    ],
    [
      'unknown palette',
      (state: AppState) => {
        Object.assign(state.workspaces[0], { palette: 'external-theme' })
      },
    ],
    [
      'non-boolean Focus',
      (state: AppState) => {
        Object.assign(state.workspaces[0], { focusMode: 'yes' })
      },
    ],
  ] as const)('rejects unsafe v2 settings: %s', (_name, mutate) => {
    const state = createInitialState()
    mutate(state)
    expect(() => validateState(state)).toThrow(/Import refusé/)
  })
})
