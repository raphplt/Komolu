import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, initializeDatabase, mutateState } from './storage'
import { actions, activeWorkspace } from './store'
import { TIMER_PROFILES } from './timer'
beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await db.delete()
})
describe('workspace profiles and global session', () => {
  it('keeps running snapshot across workspace switches then uses current profile on reset', async () => {
    await initializeDatabase()
    await actions.timer('start')
    const before = (await db.state.get('app'))!.data
    const deep = before.workspaces.find((w) => w.background.scene === 'deep')!
    await actions.switchWorkspace(deep.id)
    expect((await db.state.get('app'))!.data.timer.profile.id).toBe('pomodoro')
    await actions.timer('stop')
    const state = (await db.state.get('app'))!.data
    expect(state.timer.status).toBe('idle')
    expect(state.timer.profile).toEqual(activeWorkspace(state).timerProfile)
    expect(state.timer.remainingMs).toBe(50 * 60_000)
  })
  it('adopts pending profile changes when starting after completion', async () => {
    await initializeDatabase()
    await actions.timer('start')
    await actions.timerProfile(TIMER_PROFILES[2])
    expect((await db.state.get('app'))!.data.timer.profile.mode).toBe('sequence')
    await mutateState((state) => {
      state.timer.status = 'completed'
      state.timer.deadline = null
    })
    await actions.timer('start')
    expect((await db.state.get('app'))!.data.timer.profile.mode).toBe('free')
  })
})
