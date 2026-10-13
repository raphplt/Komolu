import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KomoluDatabase, initializeDatabase, mutateState } from './storage'
import { createInitialState } from './presets'
import {
  exportBackup,
  exportSpace,
  parsePortable,
  prepareImport,
  applyImport,
  resetLocalData,
  shareWorkspace,
} from './portability'
import { validatePortable, type Backup } from './schema'
import { transitionTimer } from './timer'
const databases: KomoluDatabase[] = []
async function database() {
  const db = new KomoluDatabase(`portable-${crypto.randomUUID()}`)
  databases.push(db)
  await initializeDatabase(db)
  return db
}
afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})
function backup(): Backup {
  return {
    format: 'komolu-backup',
    version: 2,
    exportedAt: Date.now(),
    state: createInitialState(),
    media: [],
  }
}
const inspect = async () => undefined
const prep = (file: Backup) => prepareImport(JSON.stringify(file), inspect)
async function seedMedia(db: KomoluDatabase) {
  const blob = new Blob(['image-fixture'], { type: 'image/png' })
  await db.media.add({
    id: 'private-media-id',
    name: 'PRIVATE-MEDIA-NAME',
    kind: 'image',
    mimeType: blob.type,
    size: blob.size,
    blob,
    createdAt: 1,
  })
  await mutateState((s) => {
    s.workspaces[0].background.type = 'image'
    s.workspaces[0].background.mediaId = 'private-media-id'
    s.privateData.notes = 'PRIVATE-NOTES'
    s.privateData.tasks = [{ id: 'task', title: 'PRIVATE-TASK', done: false, createdAt: 1 }]
    s.privateData.activeTaskId = 'task'
    s.privateData.thoughts = [{ id: 'thought', text: 'PRIVATE-THOUGHT', createdAt: 1 }]
    s.timer.taskId = 'task'
  }, db)
}
describe('strict portable schema', () => {
  it('accepts every initial workspace and valid personal state', () => {
    expect(() => validatePortable(backup())).not.toThrow()
  })
  it.each([
    [
      'future format',
      (f: Backup) => {
        ;(f as unknown as { version: number }).version = 3
      },
    ],
    [
      'unknown nested field',
      (f: Backup) => {
        Object.assign(f.state.workspaces[0].widgets[0].settings, { payload: 'secret' })
      },
    ],
    [
      'unsupported widget',
      (f: Backup) => {
        Object.assign(f.state.workspaces[0].widgets[0], { type: 'script' })
      },
    ],
    [
      'infinite opacity',
      (f: Backup) => {
        f.state.workspaces[0].widgets[0].style.opacity = Infinity
      },
    ],
    [
      'negative position',
      (f: Backup) => {
        f.state.workspaces[0].widgets[0].layout.x = -1
      },
    ],
    [
      'outside grid',
      (f: Backup) => {
        f.state.workspaces[0].widgets[0].layout.w = 13
      },
    ],
    [
      'unsafe color URL',
      (f: Backup) => {
        f.state.workspaces[0].background.color = 'url(https://tracking.example)'
      },
    ],
    [
      'invalid timezone',
      (f: Backup) => {
        f.state.workspaces[0].widgets[0].settings.timezone = 'Unknown/Zone'
      },
    ],
    [
      'absent active workspace',
      (f: Backup) => {
        f.state.activeWorkspaceId = 'missing'
      },
    ],
    [
      'duplicate workspace',
      (f: Backup) => {
        f.state.workspaces.push(f.state.workspaces[0])
      },
    ],
    [
      'duplicate widget',
      (f: Backup) => {
        f.state.workspaces[0].widgets.push(f.state.workspaces[0].widgets[0])
      },
    ],
    [
      'too many thoughts',
      (f: Backup) => {
        f.state.privateData.thoughts = Array.from({ length: 10001 }, (_, i) => ({
          id: `t${i}`,
          text: 'a',
          createdAt: 1,
        }))
      },
    ],
    [
      'notes text bound',
      (f: Backup) => {
        f.state.privateData.notes = 'a'.repeat(100001)
      },
    ],
    [
      'task reference',
      (f: Backup) => {
        f.state.timer.taskId = 'missing'
      },
    ],
    [
      'phase index',
      (f: Backup) => {
        f.state.timer.phaseIndex = 100
      },
    ],
    [
      'running without deadline',
      (f: Backup) => {
        f.state.timer.status = 'running'
      },
    ],
    [
      'idle with deadline',
      (f: Backup) => {
        f.state.timer.deadline = Date.now()
      },
    ],
    [
      'media reference',
      (f: Backup) => {
        f.state.workspaces[0].background.type = 'image'
        f.state.workspaces[0].background.mediaId = 'missing'
      },
    ],
    [
      'prototype id',
      (f: Backup) => {
        f.state.workspaces[0].id = '__proto__'
      },
    ],
  ])('rejects %s', (_, corrupt) => {
    const file = backup()
    corrupt(file)
    expect(() => validatePortable(file)).toThrow('Import refusé')
  })
  it('rejects malformed JSON and prototype fields', () => {
    expect(() => parsePortable('{')).toThrow('JSON')
    const f = JSON.stringify(backup()).replace('"preferences":{', '"preferences":{"__proto__":{},')
    expect(() => parsePortable(f)).toThrow('champ inconnu')
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })
  it('checks base64 size, padding, MIME and decoded media', async () => {
    const f = backup()
    f.media = [
      {
        id: 'media',
        name: 'image',
        kind: 'image',
        mimeType: 'image/png',
        size: 1,
        createdAt: 1,
        data: 'YQ==',
      },
    ]
    expect(() => validatePortable(f)).not.toThrow()
    f.media[0].data = '===='
    expect(() => validatePortable(f)).toThrow('base64')
    f.media[0].data = 'YQ=='
    f.media[0].size = 2
    expect(() => validatePortable(f)).toThrow('base64')
    f.media[0].size = 1
    f.media[0].mimeType = 'image/svg+xml'
    expect(() => validatePortable(f)).toThrow()
    f.media[0].mimeType = 'image/png'
    await expect(
      prepareImport(JSON.stringify(f), async () => {
        throw new Error('codec incompatible')
      }),
    ).rejects.toThrow('codec incompatible')
  })
  it('rejects per-media limits, collection limits and wrong media reference kinds', () => {
    const f = backup()
    f.media = [
      {
        id: 'media',
        name: 'file',
        kind: 'audio',
        mimeType: 'audio/wav',
        size: 50 * 1024 * 1024 + 1,
        createdAt: 1,
        data: 'YQ==',
      },
    ]
    expect(() => validatePortable(f)).toThrow('hors limites')
    f.media[0].size = 1
    f.state.workspaces[0].background.type = 'image'
    f.state.workspaces[0].background.mediaId = 'media'
    expect(() => validatePortable(f)).toThrow('type incompatible')
    f.state.workspaces[0].background.type = 'scene'
    delete f.state.workspaces[0].background.mediaId
    f.media = Array.from({ length: 501 }, (_, i) => ({ ...f.media[0], id: `media${i}` }))
    expect(() => validatePortable(f)).toThrow('500')
  })
  it('rejects total decoded media size beyond library limit', () => {
    const f = backup()
    const data = 'A'.repeat(52 * 1024 * 1024)
    f.media = Array.from({ length: 4 }, (_, i) => ({
      id: `media${i}`,
      name: 'file',
      kind: 'image' as const,
      mimeType: 'image/png',
      size: (data.length / 4) * 3,
      createdAt: 1,
      data,
    }))
    expect(() => validatePortable(f)).toThrow('150 Mo')
  })
  it('validates large allowed base64 without regex stack overflow', () => {
    const f = backup()
    f.media = [
      {
        id: 'media',
        name: 'large',
        kind: 'image',
        mimeType: 'image/png',
        size: 12 * 1024 * 1024,
        createdAt: 1,
        data: 'A'.repeat(16 * 1024 * 1024),
      },
    ]
    expect(() => validatePortable(f)).not.toThrow()
  })
})
describe('atomic portability', () => {
  it('roundtrips full personal data and blob bytes', async () => {
    const source = await database()
    await seedMedia(source)
    const exported = await exportBackup(source)
    const target = await database()
    const inspected = vi.fn(inspect)
    const prepared = await prepareImport(JSON.stringify(exported), inspected)
    await applyImport(prepared, 'replace', target)
    expect(inspected).toHaveBeenCalledOnce()
    const restored = (await target.state.get('app'))!.data
    expect(restored.privateData).toEqual(exported.state.privateData)
    expect(restored.workspaces).toEqual(exported.state.workspaces)
    expect(restored.dataEpoch).toBeTruthy()
    expect(await (await target.media.get('private-media-id'))!.blob.text()).toBe('image-fixture')
  })
  it('never leaks private contents, local names, IDs, media tracks or live session in shareable export', async () => {
    const source = await database()
    await seedMedia(source)
    await mutateState((s) => {
      s.workspaces[0].audio.tracks.push({
        id: 'PRIVATE-TRACK-ID',
        source: 'media',
        mediaId: 'PRIVATE-AUDIO-ID',
        name: 'PRIVATE-AUDIO-NAME',
        volume: 1,
        enabled: true,
      })
      s.timer.lastSoundKey = 'PRIVATE-SESSION'
    }, source)
    await mutateState((s) => {
      s.workspaces[0].timerProfile.name = 'Profil partagé'
      s.workspaces[0].timerProfile.phases[0].durationMs = 42_000
    }, source)
    const file = await exportSpace(source)
    const text = JSON.stringify(file)
    expect(text).not.toMatch(/PRIVATE|private-media-id|privateData|taskId|lastSoundKey|mediaId/)
    expect(file.workspace.background.type).toBe('scene')
    expect(file.workspace.audio.tracks).toHaveLength(9)
    const target = await database()
    await mutateState((s) => {
      s.privateData.notes = 'keep'
    }, target)
    await applyImport(await prepareImport(text, inspect), 'replace', target)
    const state = (await target.state.get('app'))!.data
    expect(state.workspaces).toHaveLength(4)
    expect(state.privateData.notes).toBe('keep')
    expect(state.timer.profile.phases[0].durationMs).toBe(42_000)
  })
  it('rejects private or unknown fields embedded in shared settings', () => {
    const w = createInitialState().workspaces[0]
    Object.assign(w.widgets[0].settings, { privateData: 'secret' })
    const f = { format: 'komolu-space', version: 2, exportedAt: 0, workspace: shareWorkspace(w) }
    expect(() => validatePortable(f)).toThrow()
  })
  it('remaps collisions and all media refs, appends notes and keeps local session/preferences', async () => {
    const db = await database()
    await seedMedia(db)
    const exported = await exportBackup(db)
    const before = (await db.state.get('app'))!.data
    await applyImport(await prep(exported), 'merge', db)
    const merged = (await db.state.get('app'))!.data
    expect(merged.workspaces).toHaveLength(6)
    expect(new Set(merged.workspaces.map((w) => w.id)).size).toBe(6)
    expect(merged.privateData.tasks).toHaveLength(2)
    expect(merged.privateData.tasks[0].id).not.toBe(merged.privateData.tasks[1].id)
    expect(merged.privateData.thoughts[0].id).not.toBe(merged.privateData.thoughts[1].id)
    expect(merged.privateData.notes).toBe('PRIVATE-NOTES\n\n— Notes importées —\n\nPRIVATE-NOTES')
    expect(merged.timer).toEqual(before.timer)
    expect(merged.preferences).toEqual(before.preferences)
    expect(merged.workspaces[3].background.mediaId).not.toBe('private-media-id')
    expect(await db.media.get(merged.workspaces[3].background.mediaId!)).toBeTruthy()
    expect(() =>
      validatePortable({
        ...exported,
        state: merged,
        media: [
          ...exported.media,
          { ...exported.media[0], id: merged.workspaces[3].background.mediaId! },
        ],
      }),
    ).not.toThrow()
  })
  it('pauses a restored running session at exported time, not current time', async () => {
    const db = await database()
    const f = backup()
    f.exportedAt = 2000
    f.state.timer = transitionTimer(f.state.timer, 'start', 1000)
    await applyImport(await prep(f), 'replace', db)
    const t = (await db.state.get('app'))!.data.timer
    expect(t.status).toBe('paused')
    expect(t.deadline).toBeNull()
    expect(t.remainingMs).toBe(f.state.timer.remainingMs - 1000)
  })
  it('rejects invalid imports without any write', async () => {
    const db = await database()
    await seedMedia(db)
    const before = await exportBackup(db)
    const f = backup()
    f.state.timer.phaseIndex = -1
    await expect(prep(f)).rejects.toThrow()
    expect((await exportBackup(db)).state).toEqual(before.state)
    expect(await db.media.count()).toBe(1)
  })
  it('rolls back media and state when merged notes exceed limit', async () => {
    const db = await database()
    await seedMedia(db)
    await mutateState((s) => {
      s.privateData.notes = 'a'.repeat(100000)
    }, db)
    const before = (await db.state.get('app'))!.data
    const file = await exportBackup(db)
    await expect(applyImport(await prep(file), 'merge', db)).rejects.toThrow('notes')
    expect((await db.state.get('app'))!.data).toEqual(before)
    expect(await db.media.count()).toBe(1)
  })
  it('refuses merging more than 500 media without touching data', async () => {
    const db = await database()
    const blob = new Blob(['a'], { type: 'image/png' })
    await db.media.bulkAdd(
      Array.from({ length: 500 }, (_, i) => ({
        id: `m${i}`,
        name: 'fixture',
        kind: 'image' as const,
        mimeType: blob.type,
        size: 1,
        blob,
        createdAt: 1,
      })),
    )
    const before = (await db.state.get('app'))!.data
    const f = backup()
    f.media = [
      {
        id: 'new-media',
        name: 'fixture',
        kind: 'image',
        mimeType: blob.type,
        size: 1,
        createdAt: 1,
        data: 'YQ==',
      },
    ]
    await expect(applyImport(await prep(f), 'merge', db)).rejects.toThrow('500 médias')
    expect((await db.state.get('app'))!.data).toEqual(before)
    expect(await db.media.count()).toBe(500)
  })
  it('rolls back media deletion on failed replacement write', async () => {
    const db = await database()
    await seedMedia(db)
    const before = (await db.state.get('app'))!.data
    const ready = await prep(backup())
    vi.spyOn(db.state, 'put').mockRejectedValueOnce(
      new DOMException('quota exceeded', 'QuotaExceededError'),
    )
    await expect(applyImport(ready, 'replace', db)).rejects.toThrow('stockage est plein')
    expect((await db.state.get('app'))!.data).toEqual(before)
    expect(await db.media.count()).toBe(1)
  })
  it('ignores preview mutations and rejects forged preparation tokens', async () => {
    const db = await database()
    const f = backup()
    const ready = await prep(f)
    if (ready.file.format === 'komolu-backup')
      ready.file.state.privateData.notes = 'unverified mutation'
    await applyImport(ready, 'replace', db)
    expect((await db.state.get('app'))!.data.privateData.notes).toBe('')
    await expect(applyImport({ file: f, media: [] }, 'replace', db)).rejects.toThrow('validé')
  })
  it('exports optional undefined fields like their JSON representation', async () => {
    const db = await database()
    await mutateState((s) => {
      s.workspaces[0].background.mediaId = undefined
      s.workspaces[0].widgets[0].settings.timezone = undefined
    }, db)
    expect((await exportBackup(db)).state.workspaces[0].background.mediaId).toBeUndefined()
    await expect(exportSpace(db)).resolves.toMatchObject({ format: 'komolu-space' })
  })
  it('atomically resets all data and changes epoch', async () => {
    const db = await database()
    await seedMedia(db)
    const before = (await db.state.get('app'))!.data
    await resetLocalData(db)
    const after = (await db.state.get('app'))!.data
    expect(after.privateData.notes).toBe('')
    expect(after.workspaces).toHaveLength(3)
    expect(after.dataEpoch).toBeTruthy()
    expect(after.dataEpoch).not.toBe(before.dataEpoch)
    expect(await db.media.count()).toBe(0)
  })
})
