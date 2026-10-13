import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteMedia,
  MAX_LIBRARY_BYTES,
  MAX_MEDIA_BYTES,
  saveMedia,
  validateDecodedAudio,
  validateMediaFile,
  validateMediaMetadata,
} from './media'
import { initializeDatabase, KomoluDatabase, mutateState } from './storage'
import type { MediaRecord } from './model'
const databases: KomoluDatabase[] = []
function database() {
  const db = new KomoluDatabase(`media-${crypto.randomUUID()}`)
  databases.push(db)
  return db
}
function record(id: string = crypto.randomUUID(), bytes = 5): MediaRecord {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
  return {
    id,
    name: 'fond.png',
    kind: 'image',
    mimeType: blob.type,
    size: blob.size,
    blob,
    createdAt: 0,
  }
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})
describe('media admission', () => {
  it('rejects executable/unknown types, empty blobs and files above the limit', () => {
    for (const type of ['image/svg+xml', 'text/html', '', 'application/octet-stream'])
      expect(() => validateMediaFile({ type, size: 100 }, 'image')).toThrow('Format')
    expect(() => validateMediaFile({ type: 'image/png', size: 0 }, 'image')).toThrow('vide')
    expect(() =>
      validateMediaFile({ type: 'video/webm', size: MAX_MEDIA_BYTES + 1 }, 'video'),
    ).toThrow('50 Mo')
    expect(() =>
      validateMediaFile({ type: 'video/webm', size: MAX_MEDIA_BYTES }, 'video'),
    ).not.toThrow()
  })
  it('bounds decoded images and audiovisual duration', () => {
    expect(() => validateMediaMetadata('image', { width: 100_000, height: 100_000 })).toThrow(
      '20 mégapixels',
    )
    expect(() =>
      validateMediaMetadata('video', { width: 3840, height: 2160, duration: 12 }),
    ).not.toThrow()
    expect(() =>
      validateMediaMetadata('video', { width: 7680, height: 4320, duration: 12 }),
    ).toThrow('4K')
    for (const duration of [NaN, Infinity, 0, -1, 121])
      expect(() => validateMediaMetadata('audio', { duration })).toThrow()
    expect(() =>
      validateDecodedAudio({ length: 120 * 44_100, numberOfChannels: 2, duration: 120 }),
    ).not.toThrow()
    expect(() =>
      validateDecodedAudio({ length: 120 * 44_100, numberOfChannels: 8, duration: 120 }),
    ).toThrow()
  })
  it('rejects inconsistent metadata and enforces aggregate quota inside the transaction', async () => {
    const db = database(),
      valid = record()
    await expect(saveMedia({ ...valid, size: 999 }, db)).rejects.toThrow('correspondent')
    // Existing byte totals suffice here; no allocation of 150 MB needed.
    await db.media.put({ ...record('large'), size: MAX_LIBRARY_BYTES - 5 })
    await Promise.allSettled([saveMedia(record('one'), db), saveMedia(record('two'), db)])
    expect(await db.media.count()).toBe(2)
    expect((await db.media.toArray()).reduce((sum, media) => sum + media.size, 0)).toBe(
      MAX_LIBRARY_BYTES,
    )
  })
  it('deleting a shared asset atomically detaches every background and track without touching notes', async () => {
    const db = database(),
      media = record('shared')
    await initializeDatabase(db)
    await saveMedia(media, db)
    await mutateState((state) => {
      state.privateData.notes = 'À conserver'
      for (const workspace of state.workspaces) {
        workspace.background.type = 'image'
        workspace.background.mediaId = media.id
        workspace.audio.tracks.push({
          id: 'personal',
          source: 'media',
          mediaId: media.id,
          name: 'Son',
          volume: 0.5,
          enabled: true,
        })
      }
    }, db)
    await deleteMedia(media.id, db)
    const state = (await db.state.get('app'))!.data
    expect(await db.media.count()).toBe(0)
    expect(state.privateData.notes).toBe('À conserver')
    expect(
      state.workspaces.every(
        (workspace) =>
          workspace.background.type === 'scene' &&
          workspace.background.mediaId === undefined &&
          !workspace.audio.tracks.some((track) => track.mediaId === media.id),
      ),
    ).toBe(true)
  })
})
