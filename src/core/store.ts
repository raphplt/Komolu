import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AppState, Scene, TimerProfile, Workspace } from './model'
import { createWorkspace, uid } from './presets'
import { db, initializeDatabase, mutateState, storageMessage } from './storage'
import { clockMovedBackwards, createTimer, reconcileTimer, transitionTimer, type TimerAction } from './timer'

let onError: ((message: string) => void) | undefined
export function reportError(error: unknown): void { onError?.(error instanceof Error ? error.message : String(error)) }
export async function updateState(mutate: (state: AppState) => void): Promise<void> { try { await mutateState(mutate) } catch (error) { onError?.(storageMessage(error)); throw error } }
export function activeWorkspace(state: AppState): Workspace { return state.workspaces.find(w => w.id === state.activeWorkspaceId) ?? state.workspaces[0] }
export const actions = {
  update: updateState,
  async workspace(mutate: (workspace: Workspace) => void) { await updateState(state => mutate(activeWorkspace(state))) },
  async switchWorkspace(id: string) { await updateState(state => { if (!state.workspaces.some(w => w.id === id)) return; state.activeWorkspaceId = id; if (state.timer.status === 'idle' || state.timer.status === 'completed') state.timer = createTimer(activeWorkspace(state).timerProfile) }) },
  async createWorkspace(scene: Scene, name?: string) { await updateState(state => { const workspace = createWorkspace(scene, name); state.workspaces.push(workspace); state.activeWorkspaceId = workspace.id; if (state.timer.status === 'idle' || state.timer.status === 'completed') state.timer = createTimer(workspace.timerProfile) }) },
  async duplicateWorkspace() { await updateState(state => { const workspace = structuredClone(activeWorkspace(state)); workspace.id = uid(); workspace.name = `${workspace.name} · copie`; workspace.createdAt = Date.now(); state.workspaces.push(workspace); state.activeWorkspaceId = workspace.id }) },
  async deleteWorkspace(id: string) { await updateState(state => { if (state.workspaces.length === 1) throw new Error('Garde au moins un espace.'); state.workspaces = state.workspaces.filter(w => w.id !== id); if (state.activeWorkspaceId === id) state.activeWorkspaceId = state.workspaces[0].id; if (state.timer.status === 'idle' || state.timer.status === 'completed') state.timer = createTimer(activeWorkspace(state).timerProfile) }) },
  async restoreWorkspace() { await updateState(state => { const old = activeWorkspace(state); const fresh = createWorkspace(old.background.scene, old.name); state.workspaces = state.workspaces.map(w => w.id === old.id ? { ...fresh, id: old.id, createdAt: old.createdAt } : w); if (state.timer.status === 'idle' || state.timer.status === 'completed') state.timer = createTimer(fresh.timerProfile) }) },
  async timer(action: TimerAction) { await updateState(state => { if (action === 'stop' || ((action === 'start' || action === 'resume') && state.timer.status === 'completed')) state.timer = { ...createTimer(activeWorkspace(state).timerProfile), revision: state.timer.revision + 1 }; if (action !== 'stop') state.timer = transitionTimer(state.timer, action, Date.now(), state.privateData.activeTaskId) }) },
  async timerProfile(profile: TimerProfile) { await updateState(state => { activeWorkspace(state).timerProfile = structuredClone(profile); if (state.timer.status === 'idle' || state.timer.status === 'completed') state.timer = createTimer(profile) }) },
  async addTask(title: string) { const text = title.trim().slice(0, 500); if (!text) return; await updateState(state => { const task = { id: uid(), title: text, done: false, createdAt: Date.now() }; state.privateData.tasks.push(task); state.privateData.activeTaskId ??= task.id }) },
  async toggleTask(id: string) { await updateState(state => { const task = state.privateData.tasks.find(t => t.id === id); if (task) task.done = !task.done }) },
  async renameTask(id: string, title: string) { if (!title.trim()) return; await updateState(state => { const task = state.privateData.tasks.find(t => t.id === id); if (task) task.title = title.trim().slice(0, 500) }) },
  async deleteTask(id: string) { await updateState(state => { state.privateData.tasks = state.privateData.tasks.filter(t => t.id !== id); if (state.privateData.activeTaskId === id) state.privateData.activeTaskId = null; if (state.timer.taskId === id) state.timer.taskId = null }) },
  async moveTask(id: string, direction: -1 | 1) { await updateState(state => { const tasks = state.privateData.tasks; const index = tasks.findIndex(t => t.id === id); const next = index + direction; if (index >= 0 && next >= 0 && next < tasks.length) [tasks[index], tasks[next]] = [tasks[next], tasks[index]] }) },
  async selectTask(id: string | null) { await updateState(state => { state.privateData.activeTaskId = id; if (state.timer.status !== 'idle') state.timer.taskId = id }) },
  async notes(text: string) { await updateState(state => { state.privateData.notes = text.slice(0, 100_000) }) },
  async addThought(text: string) { if (!text.trim()) return; await updateState(state => { state.privateData.thoughts.unshift({ id: uid(), text: text.trim().slice(0, 5_000), createdAt: Date.now() }) }) },
  async deleteThought(id: string) { await updateState(state => { state.privateData.thoughts = state.privateData.thoughts.filter(t => t.id !== id) }) },
  async thoughtToTask(id: string) { await updateState(state => { const thought = state.privateData.thoughts.find(t => t.id === id); if (!thought) return; state.privateData.tasks.push({ id: uid(), title: thought.text.slice(0, 500), done: false, createdAt: Date.now() }); state.privateData.thoughts = state.privateData.thoughts.filter(t => t.id !== id) }) },
}
/** Dexie liveQuery propagates persisted updates across browser tabs. */
export function useAppState() {
  const state = useLiveQuery(() => db.state.get('app').then(record => record?.data).catch(error => { onError?.(storageMessage(error)); return undefined }), [])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { onError = setError; void initializeDatabase().catch(error => setError(storageMessage(error))); return () => { onError = undefined } }, [])
  useEffect(() => {
    if (!state || state.timer.status !== 'running') return
    let lastWall = Date.now()
    let lastMono = performance.now()
    const sync = () => {
      const now = Date.now()
      const mono = performance.now()
      const backwards = clockMovedBackwards(lastWall, lastMono, now, mono)
      const needsTransition = reconcileTimer(state.timer, now) !== state.timer
      if (backwards || needsTransition) void updateState(latest => {
        if (backwards && latest.timer.status === 'running') latest.timer = { ...transitionTimer(latest.timer, 'pause', lastWall), clockWarning: true, lastObservedAt: now }
        else latest.timer = reconcileTimer(latest.timer, now)
      }).catch(() => undefined)
      lastWall = now; lastMono = mono
    }
    sync()
    const interval = window.setInterval(sync, 1_000)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { clearInterval(interval); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
  }, [state])
  return { state, error, clearError: () => setError(null) }
}
export function useNow(interval = 1_000): number { const [now, setNow] = useState(Date.now); useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), interval); return () => clearInterval(id) }, [interval]); return now }
