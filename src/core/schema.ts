import type { AppState, MediaRecord, TimerProfile, TimerState, Widget, Workspace } from './model'
import { MEDIA_TYPES, MAX_LIBRARY_BYTES, MAX_MEDIA_BYTES } from './media'
import {
  MAX_WORKSPACES,
  MAX_WIDGETS,
  MAX_TRACKS,
  MAX_TASKS,
  MAX_THOUGHTS,
  MAX_MEDIA_COUNT,
  MAX_NAME_LENGTH,
} from './limits'

export const MAX_FILE_BYTES = 220 * 1024 * 1024
export interface EncodedMedia extends Omit<MediaRecord, 'blob'> {
  data: string
}
export interface Backup {
  format: 'komolu-backup'
  version: 1
  exportedAt: number
  state: AppState
  media: EncodedMedia[]
}
export interface SpaceFile {
  format: 'komolu-space'
  version: 1
  exportedAt: number
  workspace: Workspace
}
export type PortableFile = Backup | SpaceFile
function invalid(path: string, detail = 'valeur invalide'): never {
  throw new Error(`Import refusé : ${path} — ${detail}.`)
}
type ObjectValue = Record<string, unknown>
function object(
  value: unknown,
  path: string,
  required: string[],
  optional: string[] = [],
): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, 'objet attendu')
  const obj = value as ObjectValue
  if (Object.keys(obj).some((key) => !required.includes(key) && !optional.includes(key)))
    invalid(path, 'champ inconnu')
  if (required.some((key) => !Object.hasOwn(obj, key))) invalid(path, 'champ manquant')
  return obj
}
function string(value: unknown, path: string, max = 200, min = 0): asserts value is string {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    invalid(path, `texte de ${min} à ${max} caractères attendu`)
}
function id(value: unknown, path: string): asserts value is string {
  string(value, path, 200, 1)
  if (!/^[\w.-]+$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value))
    invalid(path, 'identifiant invalide')
}
function number(
  value: unknown,
  path: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  integer = false,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    invalid(path, 'nombre hors limites')
}
function bool(value: unknown, path: string) {
  if (typeof value !== 'boolean') invalid(path, 'booléen attendu')
}
function choice(value: unknown, options: readonly unknown[], path: string) {
  if (!options.includes(value)) invalid(path, 'option inconnue')
}
function array(value: unknown, path: string, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    invalid(path, `liste de ${min} à ${max} éléments attendue`)
  return value
}
function unique(items: { id: string }[], path: string) {
  if (new Set(items.map((item) => item.id)).size !== items.length)
    invalid(path, 'identifiants dupliqués')
}
function nullableId(value: unknown, path: string) {
  if (value !== null) id(value, path)
}
function profile(value: unknown, path: string): asserts value is TimerProfile {
  const p = object(value, path, ['id', 'name', 'mode', 'phases', 'repeats', 'autoAdvance', 'sound'])
  id(p.id, path)
  string(p.name, path, 200, 1)
  choice(p.mode, ['sequence', 'free'], path)
  number(p.repeats, path, 0, 100, true)
  bool(p.autoAdvance, path)
  bool(p.sound, path)
  for (const item of array(p.phases, path, 20, 1)) {
    const phase = object(item, path, ['id', 'label', 'kind', 'durationMs'])
    id(phase.id, path)
    string(phase.label, path, 200, 1)
    choice(phase.kind, ['work', 'break'], path)
    number(
      phase.durationMs,
      path,
      p.mode === 'free' ? 0 : 1000,
      p.mode === 'free' ? 0 : 86_400_000,
      true,
    )
  }
  unique(p.phases as TimerProfile['phases'], path)
}
function widget(value: unknown, path: string): asserts value is Widget {
  const w = object(value, path, ['id', 'type', 'version', 'visible', 'layout', 'style', 'settings'])
  id(w.id, path)
  choice(w.type, ['clock', 'timer', 'tasks', 'notes', 'audio'], path)
  choice(w.version, [1], path)
  bool(w.visible, path)
  const l = object(w.layout, path, ['x', 'y', 'w', 'h'])
  number(l.x, path, 0, 11, true)
  number(l.y, path, 0, 500, true)
  number(l.w, path, 1, 12, true)
  number(l.h, path, 1, 12, true)
  if (l.x + l.w > 12) invalid(path, 'carte hors grille')
  const s = object(w.style, path, ['opacity'])
  number(s.opacity, path, 0.3, 1)
  const settings = object(
    w.settings,
    path,
    [],
    w.type === 'clock'
      ? [
          'clockFormat',
          'showSeconds',
          'showDate',
          'clockStyle',
          'timezone',
          'alignment',
          'typography',
          'clockSize',
        ]
      : [],
  )
  for (const [key, options] of Object.entries({
    clockFormat: ['12', '24'],
    clockStyle: ['digital', 'analog'],
    alignment: ['left', 'center'],
    typography: ['serif', 'sans'],
    clockSize: ['small', 'large'],
  }))
    if (key in settings) choice(settings[key], options, path)
  for (const key of ['showSeconds', 'showDate']) if (key in settings) bool(settings[key], path)
  if ('timezone' in settings) {
    string(settings.timezone, path, 100)
    try {
      new Intl.DateTimeFormat('fr', { timeZone: settings.timezone || undefined })
    } catch {
      invalid(path, 'fuseau horaire inconnu')
    }
  }
}
export function validateWorkspace(value: unknown, path = 'espace'): asserts value is Workspace {
  const w = object(value, path, [
    'id',
    'version',
    'name',
    'description',
    'background',
    'widgets',
    'timerProfile',
    'audio',
    'createdAt',
  ])
  id(w.id, path)
  choice(w.version, [1], path)
  string(w.name, path, MAX_NAME_LENGTH, 1)
  string(w.description, path, 2000)
  number(w.createdAt, path)
  const b = object(
    w.background,
    `${path}.fond`,
    ['scene', 'type', 'dim', 'blur', 'position', 'color'],
    ['mediaId'],
  )
  choice(b.scene, ['minimal', 'cozy', 'deep'], path)
  choice(b.type, ['scene', 'image', 'video'], path)
  number(b.dim, path, 0, 1)
  number(b.blur, path, 0, 30)
  choice(b.position, ['50% 50%', '0% 50%', '100% 50%', '50% 0%', '50% 100%'], path)
  string(b.color, path, 7, 7)
  if (!/^#[0-9a-f]{6}$/i.test(b.color)) invalid(path, 'couleur invalide')
  if (b.type !== 'scene') id(b.mediaId, path)
  else if ('mediaId' in b) invalid(path, 'référence média inattendue')
  array(w.widgets, path, MAX_WIDGETS).forEach((item, index) =>
    widget(item, `${path}.widgets[${index}]`),
  )
  unique(w.widgets as Widget[], path)
  profile(w.timerProfile, `${path}.minuterie`)
  const a = object(w.audio, path, ['master', 'muted', 'tracks'])
  number(a.master, path, 0, 1)
  bool(a.muted, path)
  for (const item of array(a.tracks, path, MAX_TRACKS)) {
    const t = object(item, path, ['id', 'source', 'name', 'volume', 'enabled'], ['mediaId'])
    id(t.id, path)
    choice(t.source, ['brown', 'rain', 'wind', 'fire', 'waves', 'media'], path)
    string(t.name, path, 200, 1)
    number(t.volume, path, 0, 1)
    bool(t.enabled, path)
    if (t.source === 'media') id(t.mediaId, path)
    else if ('mediaId' in t) invalid(path, 'référence média inattendue')
  }
  unique(a.tracks as Workspace['audio']['tracks'], path)
}
function timer(value: unknown): asserts value is TimerState {
  const path = 'session'
  const t = object(
    value,
    path,
    [
      'status',
      'profile',
      'phaseIndex',
      'cycle',
      'remainingMs',
      'elapsedMs',
      'deadline',
      'startedAt',
      'lastObservedAt',
      'revision',
      'completedPhases',
      'clockWarning',
      'taskId',
    ],
    ['lastSoundKey'],
  )
  profile(t.profile, path)
  choice(t.status, ['idle', 'running', 'paused', 'waiting', 'completed'], path)
  number(t.phaseIndex, path, 0, t.profile.phases.length - 1, true)
  number(t.cycle, path, 0, Number.MAX_SAFE_INTEGER, true)
  number(t.remainingMs, path)
  number(t.elapsedMs, path)
  for (const key of ['revision', 'completedPhases'])
    number(t[key], path, 0, Number.MAX_SAFE_INTEGER, true)
  number(t.lastObservedAt, path)
  bool(t.clockWarning, path)
  nullableId(t.taskId, path)
  if ('lastSoundKey' in t) string(t.lastSoundKey, path, 500)
  for (const key of ['deadline', 'startedAt']) if (t[key] !== null) number(t[key], path)
  if (
    t.status === 'running'
      ? t.startedAt === null ||
        (t.profile.mode === 'sequence' ? t.deadline === null : t.deadline !== null)
      : t.deadline !== null || t.startedAt !== null
  )
    invalid(path, 'échéance incohérente')
  if (t.profile.mode === 'sequence' && t.remainingMs > t.profile.phases[t.phaseIndex].durationMs)
    invalid(path, 'durée incohérente')
  if (
    t.status === 'running' &&
    t.profile.mode === 'sequence' &&
    ((t.deadline as number) < (t.startedAt as number) ||
      (t.deadline as number) - (t.startedAt as number) > t.profile.phases[t.phaseIndex].durationMs)
  )
    invalid(path, 'échéance hors durée de phase')
  if (t.profile.repeats && t.cycle >= t.profile.repeats) invalid(path, 'cycle hors profil')
}
export function validateState(value: unknown): asserts value is AppState {
  const s = object(
    value,
    'données',
    [
      'schemaVersion',
      'workspaces',
      'activeWorkspaceId',
      'privateData',
      'timer',
      'preferences',
      'updatedAt',
    ],
    ['dataEpoch'],
  )
  if ('dataEpoch' in s) id(s.dataEpoch, 'génération des données')
  choice(s.schemaVersion, [1], 'version des données')
  array(s.workspaces, 'espaces', MAX_WORKSPACES, 1).forEach((w, i) =>
    validateWorkspace(w, `espace[${i}]`),
  )
  unique(s.workspaces as Workspace[], 'espaces')
  id(s.activeWorkspaceId, 'espace actif')
  if (!(s.workspaces as Workspace[]).some((w) => w.id === s.activeWorkspaceId))
    invalid('espace actif', 'référence manquante')
  const p = object(s.privateData, 'données personnelles', [
    'tasks',
    'activeTaskId',
    'notes',
    'thoughts',
    'showCompleted',
  ])
  string(p.notes, 'notes', 100_000)
  bool(p.showCompleted, 'tâches')
  nullableId(p.activeTaskId, 'tâche active')
  for (const item of array(p.tasks, 'tâches', MAX_TASKS)) {
    const t = object(item, 'tâche', ['id', 'title', 'done', 'createdAt'])
    id(t.id, 'tâche')
    string(t.title, 'tâche', 500, 1)
    bool(t.done, 'tâche')
    number(t.createdAt, 'tâche')
  }
  for (const item of array(p.thoughts, 'pensées', MAX_THOUGHTS)) {
    const t = object(item, 'pensée', ['id', 'text', 'createdAt'])
    id(t.id, 'pensée')
    string(t.text, 'pensée', 5000, 1)
    number(t.createdAt, 'pensée')
  }
  unique(p.tasks as AppState['privateData']['tasks'], 'tâches')
  unique(p.thoughts as AppState['privateData']['thoughts'], 'pensées')
  timer(s.timer)
  for (const ref of [p.activeTaskId, s.timer.taskId])
    if (ref !== null && !(p.tasks as AppState['privateData']['tasks']).some((t) => t.id === ref))
      invalid('tâche active', 'référence manquante')
  const pref = object(
    s.preferences,
    'préférences',
    ['reducedMotion', 'focusMode', 'endSound'],
    ['shortcuts'],
  )
  for (const [key, value] of Object.entries(pref)) bool(value, key)
  number(s.updatedAt, 'date')
}
export function validatePortable(value: unknown): asserts value is PortableFile {
  if (!value || typeof value !== 'object') invalid('fichier', 'objet attendu')
  const header = value as ObjectValue
  if (header.version !== 1)
    invalid('version', 'version inconnue ; utilise une version compatible de Komolu')
  choice(header.format, ['komolu-backup', 'komolu-space'], 'format')
  const f = object(value, 'fichier', [
    'format',
    'version',
    'exportedAt',
    ...(header.format === 'komolu-backup' ? ['state', 'media'] : ['workspace']),
  ])
  number(f.exportedAt, 'date export')
  if (f.format === 'komolu-space') {
    validateWorkspace(f.workspace)
    if (
      f.workspace.background.type !== 'scene' ||
      f.workspace.audio.tracks.some((t) => t.source === 'media')
    )
      invalid('espace partagé', 'média local interdit')
    return
  }
  validateState(f.state)
  let total = 0
  for (const item of array(f.media, 'médiathèque', MAX_MEDIA_COUNT)) {
    const m = object(item, 'média', ['id', 'name', 'mimeType', 'kind', 'size', 'createdAt', 'data'])
    id(m.id, 'média')
    string(m.name, 'nom média', 200)
    choice(m.kind, ['image', 'audio', 'video'], 'média')
    choice(m.mimeType, MEDIA_TYPES[m.kind as MediaRecord['kind']], 'format média')
    number(m.size, 'taille média', 1, MAX_MEDIA_BYTES, true)
    number(m.createdAt, 'date média')
    string(m.data, 'contenu média', Math.ceil(MAX_MEDIA_BYTES / 3) * 4, 4)
    if (
      m.data.length % 4 ||
      /[^A-Za-z0-9+/=]/.test(m.data) ||
      m.data.slice(0, -2).includes('=') ||
      !/^[A-Za-z0-9+/]{2}$|^[A-Za-z0-9+/]=$|^==$/.test(m.data.slice(-2)) ||
      (m.data.length / 4) * 3 - (m.data.endsWith('==') ? 2 : m.data.endsWith('=') ? 1 : 0) !==
        m.size
    )
      invalid('média', 'base64 ou taille invalide')
    total += m.size
    if (total > MAX_LIBRARY_BYTES) invalid('médiathèque', 'maximum 150 Mo')
  }
  const media = f.media as EncodedMedia[]
  unique(media, 'médiathèque')
  const lookup = new Map(media.map((m) => [m.id, m]))
  for (const w of f.state.workspaces) {
    if (
      w.background.type !== 'scene' &&
      lookup.get(w.background.mediaId!)?.kind !== w.background.type
    )
      invalid('fond', 'média absent ou type incompatible')
    for (const t of w.audio.tracks)
      if (t.source === 'media' && lookup.get(t.mediaId!)?.kind !== 'audio')
        invalid('piste audio', 'média absent ou type incompatible')
  }
}
