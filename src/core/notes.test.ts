import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelNoteDrafts, flushNotes, NoteDraft, persistNotes, registerNoteDraft } from './notes'
import { initializeDatabase, KomoluDatabase, mutateState } from './storage'
const databases: KomoluDatabase[] = []
const unregisters: (() => void)[] = []
function database() {
  const db = new KomoluDatabase(`notes-${crypto.randomUUID()}`)
  databases.push(db)
  return db
}
function register(draft: NoteDraft) {
  const unregister = registerNoteDraft(draft)
  unregisters.push(unregister)
  return unregister
}
afterEach(async () => {
  cancelNoteDrafts()
  unregisters.splice(0).forEach((unregister) => unregister())
  vi.useRealTimers()
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
describe('note draft barriers', () => {
  it('flushes the newest draft before an export without waiting for its debounce', async () => {
    vi.useFakeTimers()
    const writer = vi.fn(async () => true),
      draft = new NoteDraft('', '', writer)
    register(draft)
    draft.edit('À exporter tout de suite')
    await flushNotes()
    expect(writer).toHaveBeenCalledExactlyOnceWith('À exporter tout de suite', '')
    expect(draft.getSnapshot().status).toBe('Enregistré ici')
    await vi.advanceTimersByTimeAsync(450)
    expect(writer).toHaveBeenCalledTimes(1)
  })
  it('waits for an in-flight save then flushes edits made during that save', async () => {
    const first = deferred<boolean>(),
      writer = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(true)
    const draft = new NoteDraft('', 'epoch', writer)
    register(draft)
    draft.edit('Première version')
    const saving = draft.flush()
    draft.edit('Dernière version')
    let exported = false
    const exporting = flushNotes().then(() => {
      exported = true
    })
    await Promise.resolve()
    expect(exported).toBe(false)
    first.resolve(true)
    await saving
    await exporting
    expect(writer.mock.calls.map((call) => call[0])).toEqual([
      'Première version',
      'Dernière version',
    ])
    expect(draft.getSnapshot()).toEqual({ text: 'Dernière version', status: 'Enregistré ici' })
  })
  it('includes an unmounted widget’s outstanding write in the export barrier', async () => {
    const pending = deferred<boolean>(),
      draft = new NoteDraft('', '', () => pending.promise)
    const unregister = register(draft)
    draft.edit('Widget masqué')
    const saving = draft.flush()
    unregister()
    let exported = false
    const exporting = flushNotes().then(() => {
      exported = true
    })
    await Promise.resolve()
    expect(exported).toBe(false)
    pending.resolve(true)
    await saving
    await exporting
    expect(exported).toBe(true)
  })
  it('cancels a discarded debounce and never flushes it on subsequent unmount', async () => {
    vi.useFakeTimers()
    const writer = vi.fn(async () => true),
      draft = new NoteDraft('Ancien', 'a', writer)
    register(draft)
    draft.edit('Brouillon supprimé')
    cancelNoteDrafts()
    draft.receive('Importé', 'b')
    await vi.advanceTimersByTimeAsync(1000)
    await draft.flush()
    expect(writer).not.toHaveBeenCalled()
    expect(draft.getSnapshot().text).toBe('Importé')
  })
  it('does not replace newly imported UI text when an old write completes late', async () => {
    const pending = deferred<boolean>(),
      draft = new NoteDraft('', 'old', () => pending.promise)
    register(draft)
    draft.edit('Obsolète')
    const saving = draft.flush()
    draft.receive('Contenu importé', 'new')
    pending.resolve(true)
    await saving
    expect(draft.getSnapshot()).toEqual({ text: 'Contenu importé', status: '' })
  })
  it('exposes persistence failure, rejects export, and retries the retained draft', async () => {
    const writer = vi.fn().mockRejectedValueOnce(new Error('Quota')).mockResolvedValue(true),
      draft = new NoteDraft('', '', writer)
    register(draft)
    draft.edit('Ne pas perdre')
    await expect(flushNotes()).rejects.toThrow('Quota')
    expect(draft.getSnapshot().status).toContain('Non enregistré')
    await flushNotes()
    expect(writer).toHaveBeenCalledTimes(2)
    expect(draft.getSnapshot().text).toBe('Ne pas perdre')
  })
})
describe('persisted data epoch', () => {
  it('rejects a stale draft from another tab after a reset and accepts the new epoch', async () => {
    const db = database()
    await initializeDatabase(db)
    await persistNotes('Avant', '', db)
    await mutateState((state) => {
      state.dataEpoch = 'new-epoch'
      state.privateData.notes = 'Importé'
    }, db)
    expect(await persistNotes('Ancien onglet', '', db)).toBe(false)
    expect((await db.state.get('app'))!.data.privateData.notes).toBe('Importé')
    expect(await persistNotes('Nouveau carnet', 'new-epoch', db)).toBe(true)
    expect((await db.state.get('app'))!.data.privateData.notes).toBe('Nouveau carnet')
  })
  it('serializes a replacement between old and stale writes without resurrecting text', async () => {
    const db = database()
    await initializeDatabase(db)
    const before = persistNotes('Avant reset', '', db)
    const reset = mutateState((state) => {
      state.dataEpoch = 'reset'
      state.privateData.notes = ''
    }, db)
    const stale = persistNotes('Après reset depuis ancien onglet', '', db)
    await Promise.all([before, reset, stale])
    expect(await stale).toBe(false)
    expect((await db.state.get('app'))!.data.privateData.notes).toBe('')
  })
})
