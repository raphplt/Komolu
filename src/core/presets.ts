import { SCHEMA_VERSION, type AppState, type Scene, type Widget, type Workspace } from './model'
import { createTimer, TIMER_PROFILES } from './timer'
export const uid = () => crypto.randomUUID()
export function defaultWidgets(scene: Scene = 'minimal'): Widget[] {
  const widgets: Widget[] = [
    {
      id: 'clock',
      type: 'clock',
      version: 1,
      visible: true,
      layout: { x: 0, y: 0, w: 4, h: 2 },
      style: { opacity: 1 },
      settings: { clockFormat: '24', showDate: true, showSeconds: false, clockStyle: 'digital' },
    },
    {
      id: 'timer',
      type: 'timer',
      version: 1,
      visible: true,
      layout: { x: 4, y: 0, w: 4, h: 4 },
      style: { opacity: 1 },
      settings: {},
    },
    {
      id: 'tasks',
      type: 'tasks',
      version: 1,
      visible: true,
      layout: { x: 8, y: 0, w: 4, h: 4 },
      style: { opacity: 1 },
      settings: {},
    },
    {
      id: 'notes',
      type: 'notes',
      version: 1,
      visible: false,
      layout: { x: 0, y: 4, w: 4, h: 3 },
      style: { opacity: 1 },
      settings: {},
    },
    {
      id: 'audio',
      type: 'audio',
      version: 1,
      visible: true,
      layout: { x: 4, y: 4, w: 4, h: 2 },
      style: { opacity: 1 },
      settings: {},
    },
  ]
  widgets[0].layout = { x: 0, y: 0, w: 3, h: 3 }
  widgets[1].layout = { x: 3, y: 0, w: 5, h: 6 }
  widgets[2].layout = { x: 8, y: 0, w: 4, h: 6 }
  widgets[3].layout = { x: 0, y: 3, w: 3, h: 3 }
  widgets[3].visible = true
  widgets[4].visible = false
  if (scene === 'cozy') {
    widgets[0].layout = { x: 0, y: 0, w: 4, h: 3 }
    widgets[1].layout = { x: 4, y: 0, w: 5, h: 6 }
    widgets[2].visible = false
    widgets[3].layout = { x: 0, y: 3, w: 4, h: 3 }
  }
  if (scene === 'deep') {
    widgets[0].visible = false
    widgets[1].layout = { x: 2, y: 0, w: 5, h: 6 }
    widgets[2].layout = { x: 7, y: 0, w: 4, h: 6 }
    widgets[3].visible = false
  }
  return widgets
}
export function createWorkspace(scene: Scene, name?: string): Workspace {
  const names = { minimal: 'Minimal', cozy: 'Cozy', deep: 'Deep Work' }
  const descriptions = {
    minimal: 'De l’espace pour tes idées.',
    cozy: 'Un refuge, juste pour toi.',
    deep: 'Le calme des heures bleues.',
  }
  return {
    id: uid(),
    version: 1,
    name: name ?? names[scene],
    description: descriptions[scene],
    createdAt: Date.now(),
    background: {
      scene,
      type: 'scene',
      dim: scene === 'minimal' ? 0 : 0.1,
      blur: 0,
      position: '50% 50%',
      color: scene === 'deep' ? '#172b32' : '#e7ddca',
    },
    widgets: defaultWidgets(scene),
    timerProfile: structuredClone(TIMER_PROFILES[scene === 'deep' ? 1 : 0]),
    audio: {
      master: 0.4,
      muted: false,
      tracks: [
        { id: 'brown', source: 'brown', name: 'Bruit brun', volume: 0.4, enabled: true },
        { id: 'rain', source: 'rain', name: 'Pluie douce', volume: 0.35, enabled: false },
        { id: 'wind', source: 'wind', name: 'Vent dans les arbres', volume: 0.25, enabled: false },
        { id: 'fire', source: 'fire', name: 'Feu de cheminée', volume: 0.3, enabled: false },
        { id: 'waves', source: 'waves', name: 'Vagues', volume: 0.3, enabled: false },
      ],
    },
  }
}
export function createInitialState(): AppState {
  const workspaces = [createWorkspace('minimal'), createWorkspace('cozy'), createWorkspace('deep')]
  return {
    schemaVersion: SCHEMA_VERSION,
    workspaces,
    activeWorkspaceId: workspaces[0].id,
    privateData: { tasks: [], activeTaskId: null, notes: '', thoughts: [], showCompleted: true },
    timer: createTimer(workspaces[0].timerProfile),
    preferences: { reducedMotion: false, focusMode: false, endSound: false },
    updatedAt: Date.now(),
  }
}
