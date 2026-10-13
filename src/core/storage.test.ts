import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeDatabase, KomoluDatabase, mutateState } from './storage'
import { createTimer, TIMER_PROFILES } from './timer'
const databases: KomoluDatabase[] = []
function database() {
  const db = new KomoluDatabase(`test-${crypto.randomUUID()}`)
  databases.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()))
})
describe('private local storage', () => {
  it('seeds only once with three spaces', async () => {
    const db = database()
    await initializeDatabase(db)
    const first = await db.state.get('app')
    await initializeDatabase(db)
    expect((await db.state.get('app'))?.data.workspaces).toEqual(first?.data.workspaces)
    expect(first?.data.workspaces).toHaveLength(3)
  })
  it('keeps private content and active timer untouched when workspace changes', async () => {
    const db = database()
    await initializeDatabase(db)
    await mutateState((state) => {
      state.privateData.notes = 'Private note'
      state.privateData.tasks.push({ id: 'task', title: 'Private task', done: false, createdAt: 0 })
      state.privateData.thoughts.push({ id: 'thought', text: 'Private thought', createdAt: 0 })
      state.timer = createTimer(TIMER_PROFILES[2], 0)
    }, db)
    const before = (await db.state.get('app'))!.data
    await mutateState((state) => {
      state.activeWorkspaceId = state.workspaces[1].id
      state.workspaces[0].name = 'Renamed'
    }, db)
    const after = (await db.state.get('app'))!.data
    expect(after.privateData).toEqual(before.privateData)
    expect(after.timer).toEqual(before.timer)
    expect(JSON.stringify(after.workspaces)).not.toContain('Private')
  })
  it('serializes concurrent updates without losing independent edits', async () => {
    const db = database()
    await initializeDatabase(db)
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        mutateState((state) => {
          state.privateData.tasks.push({
            id: String(index),
            title: String(index),
            done: false,
            createdAt: 0,
          })
        }, db),
      ),
    )
    expect((await db.state.get('app'))!.data.privateData.tasks).toHaveLength(20)
  })
  it('rolls back failed updates atomically', async () => {
    const db = database()
    await initializeDatabase(db)
    await expect(
      mutateState((state) => {
        state.privateData.notes = 'Do not commit'
        throw new Error('abort')
      }, db),
    ).rejects.toThrow('abort')
    expect((await db.state.get('app'))!.data.privateData.notes).toBe('')
  })
})
