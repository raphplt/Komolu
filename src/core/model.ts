export const SCHEMA_VERSION = 1 as const
export type Scene = 'minimal' | 'cozy' | 'deep'
export type WidgetType = 'clock' | 'timer' | 'tasks' | 'notes' | 'audio'
export interface Widget {
  id: string
  type: WidgetType
  version: 1
  visible: boolean
  layout: { x: number; y: number; w: number; h: number }
  style: { opacity: number }
  settings: {
    clockFormat?: '12' | '24'
    showSeconds?: boolean
    showDate?: boolean
    clockStyle?: 'digital' | 'analog'
    timezone?: string
    alignment?: 'left' | 'center'
    typography?: 'serif' | 'sans'
    clockSize?: 'small' | 'large'
  }
}
export interface TimerPhase {
  id: string
  label: string
  kind: 'work' | 'break'
  durationMs: number
}
export interface TimerProfile {
  id: string
  name: string
  mode: 'sequence' | 'free'
  phases: TimerPhase[]
  repeats: number
  autoAdvance: boolean
  sound: boolean
}
export interface TimerState {
  lastSoundKey?: string
  status: 'idle' | 'running' | 'paused' | 'waiting' | 'completed'
  profile: TimerProfile
  phaseIndex: number
  cycle: number
  remainingMs: number
  elapsedMs: number
  deadline: number | null
  startedAt: number | null
  lastObservedAt: number
  revision: number
  completedPhases: number
  clockWarning: boolean
  taskId: string | null
}
export type SoundId = 'brown' | 'rain' | 'wind' | 'fire' | 'waves'
export interface AudioTrack {
  id: string
  source: SoundId | 'media'
  mediaId?: string
  name: string
  volume: number
  enabled: boolean
}
export interface AudioProfile {
  master: number
  muted: boolean
  tracks: AudioTrack[]
}
export interface Background {
  scene: Scene
  type: 'scene' | 'image' | 'video'
  mediaId?: string
  dim: number
  blur: number
  position: string
  color: string
}
export interface Workspace {
  id: string
  version: 1
  name: string
  description: string
  background: Background
  widgets: Widget[]
  timerProfile: TimerProfile
  audio: AudioProfile
  createdAt: number
}
export interface Task {
  id: string
  title: string
  done: boolean
  createdAt: number
}
export interface Thought {
  id: string
  text: string
  createdAt: number
}
export interface PrivateData {
  tasks: Task[]
  activeTaskId: string | null
  notes: string
  thoughts: Thought[]
  showCompleted: boolean
}
export interface Preferences {
  reducedMotion: boolean
  focusMode: boolean
  endSound: boolean
  shortcuts?: boolean
}
export interface AppState {
  dataEpoch?: string
  schemaVersion: typeof SCHEMA_VERSION
  workspaces: Workspace[]
  activeWorkspaceId: string
  privateData: PrivateData
  timer: TimerState
  preferences: Preferences
  updatedAt: number
}
export interface MediaRecord {
  id: string
  name: string
  mimeType: string
  kind: 'image' | 'video' | 'audio'
  size: number
  blob: Blob
  createdAt: number
}
export interface StateRecord {
  id: 'app'
  data: AppState
}
