import {
  SCHEMA_VERSION,
  type AppState,
  type Scene,
  type Widget,
  type Workspace,
  type AudioTrack,
  type SoundId,
} from './model'
import { createTimer, TIMER_PROFILES } from './timer'
import { SOUND_CATALOG } from './sounds'
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
      layout: { x: 4, y: 6, w: 4, h: 4 },
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
  return {
    id: uid(),
    version: 2,
    palette: scene,
    focusMode: false,
    name: name ?? names[scene],
    description: '',
    createdAt: Date.now(),
    background: {
      scene,
      type: 'scene',
      solidColor: scene === 'deep' ? '#18242c' : '#e9ede4',
      gradient: { from: '#ebe7dd', to: '#b9cbbf', angle: 135 },
      tintOpacity: 0.09,
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
      tracks: defaultAudioTracks(scene),
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
    preferences: { reducedMotion: false, endSound: false },
    updatedAt: Date.now(),
  }
}

/** Names and gains are part of the portable preset, not an external service. */
export const NATIVE_SOUNDS = SOUND_CATALOG.map(({ id, name, volume }) => ({
  source: id,
  name,
  volume,
}))
export function defaultAudioTracks(scene: Scene): AudioTrack[] {
  const enabled: SoundId[] =
    scene === 'cozy' ? ['rain', 'fire'] : scene === 'deep' ? ['brown', 'wind'] : ['brown']
  return NATIVE_SOUNDS.map(({ source, name, volume }) => ({
    id: source,
    source,
    name,
    volume,
    enabled: enabled.includes(source),
  }))
}
