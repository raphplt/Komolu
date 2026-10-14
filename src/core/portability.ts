import type { AppState, MediaRecord, Workspace } from './model'
import { createInitialState, uid } from './presets'
import { createTimer } from './timer'
import { MAX_MEDIA_COUNT } from './limits'
import { inspectMedia, MAX_LIBRARY_BYTES, validateMediaFile } from './media'
import { db, type KomoluDatabase, storageMessage } from './storage'
import { cancelNoteDrafts, flushNotes } from './notes'
import { migratePortable } from './migrations'
import {
  MAX_FILE_BYTES,
  validatePortable,
  validateState,
  type Backup,
  type PortableFile,
  type SpaceFile,
} from './schema'
export { MAX_FILE_BYTES } from './schema'
export type { PortableFile } from './schema'
export interface PreparedImport {
  file: PortableFile
  media: MediaRecord[]
}
export type ImportMode = 'merge' | 'replace'
const prepared = new WeakMap<PreparedImport, PreparedImport>()
const clone = <T>(value: T): T => structuredClone(value)
// Base64 strings are immutable; keep them shared instead of duplicating hundreds of MB.
function cloneFile(file: PortableFile): PortableFile {
  return file.format === 'komolu-backup'
    ? { ...file, state: clone(file.state), media: file.media.map((m) => ({ ...m })) }
    : { ...file, workspace: clone(file.workspace) }
}
function mediaBytes(media: MediaRecord[]): number {
  return media.reduce((sum, item) => sum + item.size, 0)
}
async function snapshot(database: KomoluDatabase) {
  await flushNotes()
  return database.transaction('r', database.state, database.media, async () => {
    const record = await database.state.get('app')
    if (!record) throw new Error('Aucune donnée locale à exporter.')
    return {
      state: JSON.parse(JSON.stringify(record.data)) as AppState,
      media: await database.media.toArray(),
    }
  })
}
async function encode(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 24_576)
    parts.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24_576))))
  return parts.join('')
}
export async function exportBackup(database = db): Promise<Backup> {
  const value = await snapshot(database)
  const file: Backup = {
    format: 'komolu-backup',
    version: 2,
    exportedAt: Date.now(),
    state: value.state,
    media: [],
  }
  for (const record of value.media) {
    const { blob, ...meta } = record
    validateMediaFile(blob, record.kind)
    if (record.size !== blob.size || record.mimeType !== blob.type)
      throw new Error('Média local incohérent : réimporte ce média avant de sauvegarder.')
    file.media.push({ ...meta, data: await encode(blob) })
  }
  validatePortable(file)
  return file
}
/** Explicit field projection: personal data and local media never enter the shareable object. */
export function shareWorkspace(w: Workspace): Workspace {
  return {
    id: uid(),
    version: 2,
    palette: w.palette,
    focusMode: w.focusMode,
    name: w.name,
    description: w.description,
    createdAt: Date.now(),
    background: {
      scene: w.background.scene,
      type:
        w.background.type === 'image' || w.background.type === 'video'
          ? 'scene'
          : w.background.type,
      ...(w.background.type === 'scene' && w.background.wallpaperId
        ? { wallpaperId: w.background.wallpaperId }
        : {}),
      solidColor: w.background.solidColor,
      gradient: { ...w.background.gradient },
      tintOpacity: w.background.tintOpacity,
      dim: w.background.dim,
      blur: w.background.blur,
      position: w.background.position,
      color: w.background.color,
    },
    widgets: w.widgets.map((v) => ({
      id: uid(),
      type: v.type,
      version: 1,
      visible: v.visible,
      layout: { x: v.layout.x, y: v.layout.y, w: v.layout.w, h: v.layout.h },
      style: { opacity: v.style.opacity },
      settings: clone(v.settings),
    })),
    timerProfile: {
      id: uid(),
      name: w.timerProfile.name,
      mode: w.timerProfile.mode,
      phases: w.timerProfile.phases.map((p) => ({
        id: uid(),
        label: p.label,
        kind: p.kind,
        durationMs: p.durationMs,
      })),
      repeats: w.timerProfile.repeats,
      autoAdvance: w.timerProfile.autoAdvance,
      sound: w.timerProfile.sound,
    },
    audio: {
      master: w.audio.master,
      muted: w.audio.muted,
      tracks: w.audio.tracks
        .filter((t) => t.source !== 'media')
        .map((t) => ({
          id: uid(),
          source: t.source,
          name: t.name,
          volume: t.volume,
          enabled: t.enabled,
        })),
    },
  }
}
export async function exportSpace(database = db): Promise<SpaceFile> {
  const { state } = await snapshot(database)
  const w = state.workspaces.find((w) => w.id === state.activeWorkspaceId)!
  const file: SpaceFile = {
    format: 'komolu-space',
    version: 2,
    exportedAt: Date.now(),
    workspace: shareWorkspace(w),
  }
  validatePortable(file)
  return file
}
export function parsePortable(text: string): PortableFile {
  if (text.length > MAX_FILE_BYTES || new Blob([text]).size > MAX_FILE_BYTES)
    throw new Error('Fichier trop volumineux : maximum 220 Mo.')
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('Ce fichier n’est pas un document JSON valide.')
  }
  return migratePortable(file)
}
export async function prepareImport(text: string, inspect = inspectMedia): Promise<PreparedImport> {
  const file = parsePortable(text)
  const media: MediaRecord[] = []
  if (file.format === 'komolu-backup')
    for (const encoded of file.media) {
      const { data, ...meta } = encoded
      const bytes = new Uint8Array(meta.size)
      for (let offset = 0, cursor = 0; offset < data.length; offset += 32768) {
        const chunk = atob(data.slice(offset, offset + 32768))
        for (let i = 0; i < chunk.length; i++) bytes[cursor++] = chunk.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: meta.mimeType })
      validateMediaFile(blob, meta.kind)
      try {
        await inspect(blob, meta.kind)
      } catch (error) {
        throw new Error(
          `Média « ${meta.name} » : ${error instanceof Error ? error.message : 'lecture impossible'}`,
        )
      }
      media.push({ ...meta, blob })
    }
  const result = { file, media }
  prepared.set(result, { file: cloneFile(file), media: media.map((m) => ({ ...m })) })
  return result
}
export async function readImport(file: File): Promise<PreparedImport> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Fichier trop volumineux : maximum 220 Mo.')
  return prepareImport(await file.text())
}
function remapWorkspace(workspace: Workspace, mediaIds: Map<string, string>): Workspace {
  const w = clone(workspace)
  w.id = uid()
  for (const v of w.widgets) v.id = uid()
  for (const track of w.audio.tracks) {
    track.id = uid()
    if (track.mediaId) track.mediaId = mediaIds.get(track.mediaId)!
  }
  if (w.background.mediaId) w.background.mediaId = mediaIds.get(w.background.mediaId)!
  w.timerProfile.id = uid()
  for (const p of w.timerProfile.phases) p.id = uid()
  return w
}
function pausedAtExport(state: AppState, exportedAt: number): AppState {
  const timer = state.timer
  if (timer.status === 'running') {
    if (timer.profile.mode === 'free') timer.elapsedMs += Math.max(0, exportedAt - timer.startedAt!)
    else
      timer.remainingMs = Math.min(
        timer.profile.phases[timer.phaseIndex].durationMs,
        Math.max(0, timer.deadline! - exportedAt),
      )
    timer.status = 'paused'
    timer.deadline = null
    timer.startedAt = null
    timer.lastObservedAt = Date.now()
    timer.revision++
  }
  delete timer.lastSoundKey
  return state
}
export async function applyImport(
  input: PreparedImport,
  mode: ImportMode,
  database = db,
): Promise<void> {
  const verified = prepared.get(input)
  if (!verified) throw new Error('Ce fichier doit d’abord être validé.')
  const file = cloneFile(verified.file)
  const imported = verified.media.map((m) => ({ ...m }))
  await flushNotes()
  try {
    await database.transaction('rw', database.state, database.media, async () => {
      const current = (await database.state.get('app'))?.data ?? createInitialState()
      let next: AppState
      if (file.format === 'komolu-space') {
        next = current
        next.workspaces.push(remapWorkspace(file.workspace, new Map()))
        next.activeWorkspaceId = next.workspaces.at(-1)!.id
        if (next.timer.status === 'idle' || next.timer.status === 'completed')
          next.timer = createTimer(file.workspace.timerProfile)
      } else if (mode === 'replace') {
        next = pausedAtExport(clone(file.state), file.exportedAt)
        await database.media.clear()
        await database.media.bulkAdd(imported)
      } else {
        if ((await database.media.count()) + imported.length > MAX_MEDIA_COUNT)
          throw new Error(
            `La fusion dépasserait ${MAX_MEDIA_COUNT} médias. Supprime des médias ou choisis le remplacement.`,
          )
        if (mediaBytes(await database.media.toArray()) + mediaBytes(imported) > MAX_LIBRARY_BYTES)
          throw new Error(
            'La fusion dépasserait 150 Mo de médias. Choisis le remplacement ou allège ta médiathèque.',
          )
        next = current
        const ids = new Map(imported.map((m) => [m.id, uid()]))
        const taskIds = new Map(file.state.privateData.tasks.map((t) => [t.id, uid()]))
        next.workspaces.push(...file.state.workspaces.map((w) => remapWorkspace(w, ids)))
        next.privateData.tasks.push(
          ...file.state.privateData.tasks.map((t) => ({ ...t, id: taskIds.get(t.id)! })),
        )
        next.privateData.thoughts.push(
          ...file.state.privateData.thoughts.map((t) => ({ ...t, id: uid() })),
        )
        if (file.state.privateData.notes)
          next.privateData.notes +=
            (next.privateData.notes ? '\n\n— Notes importées —\n\n' : '') +
            file.state.privateData.notes
        await database.media.bulkAdd(imported.map((m) => ({ ...m, id: ids.get(m.id)! })))
      }
      if (file.format === 'komolu-backup') next.dataEpoch = uid()
      next.updatedAt = Date.now()
      validateState(next)
      await database.state.put({ id: 'app', data: next })
    })
    if (file.format === 'komolu-backup') {
      cancelNoteDrafts()
      if (mode === 'replace' && typeof window !== 'undefined')
        window.dispatchEvent(new Event('komolu-personal-data-replaced'))
    }
  } catch (error) {
    if (error instanceof Error && /quota/i.test(error.name)) throw new Error(storageMessage(error))
    throw error
  }
}
export async function resetLocalData(database = db): Promise<void> {
  await database.transaction('rw', database.state, database.media, async () => {
    const state = createInitialState()
    state.dataEpoch = uid()
    await database.media.clear()
    await database.state.put({ id: 'app', data: state })
  })
  cancelNoteDrafts()
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('komolu-personal-data-replaced'))
}
export function downloadPortable(file: PortableFile): void {
  const slug =
    file.format === 'komolu-space'
      ? file.workspace.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9-]/g, '-')
          .slice(0, 80) || 'espace'
      : new Date(file.exportedAt).toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  if (blob.size > MAX_FILE_BYTES)
    throw new Error(
      'Cette sauvegarde dépasse 220 Mo. Réduis les médias ou le volume de texte avant de l’exporter.',
    )
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${file.format}-${slug}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
