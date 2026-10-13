import type { MediaRecord } from './model'
import { MAX_MEDIA_COUNT } from './limits'
import { db, storageMessage, type KomoluDatabase } from './storage'

export const MAX_MEDIA_BYTES = 50 * 1024 * 1024
export const MAX_LIBRARY_BYTES = 150 * 1024 * 1024
export const MAX_AUDIO_SECONDS = 120
export const MAX_DECODED_AUDIO_BYTES = 64 * 1024 * 1024
export const MEDIA_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/flac',
  ],
} as const
export const mediaAccept = (kind: MediaRecord['kind']) => MEDIA_TYPES[kind].join(',')
export function validateMediaFile(
  file: Pick<Blob, 'size' | 'type'>,
  kind: MediaRecord['kind'],
): void {
  if (!(MEDIA_TYPES[kind] as readonly string[]).includes(file.type))
    throw new Error('Format non pris en charge. Choisis un fichier dans les formats indiqués.')
  if (!file.size) throw new Error('Ce fichier est vide.')
  if (file.size > MAX_MEDIA_BYTES)
    throw new Error('Ce fichier dépasse 50 Mo. Choisis une version plus légère.')
}
export function validateMediaMetadata(
  kind: MediaRecord['kind'],
  metadata: { width?: number; height?: number; duration?: number },
): void {
  if (kind === 'audio') {
    if (
      !Number.isFinite(metadata.duration) ||
      metadata.duration! <= 0 ||
      metadata.duration! > MAX_AUDIO_SECONDS
    )
      throw new Error('Choisis une boucle audio de 2 minutes maximum.')
  } else {
    const pixels = (metadata.width ?? 0) * (metadata.height ?? 0)
    if (pixels <= 0 || pixels > (kind === 'image' ? 20_000_000 : 8_500_000))
      throw new Error(
        kind === 'image'
          ? 'Image trop grande : 20 mégapixels maximum.'
          : 'Vidéo trop grande : définition 4K maximum.',
      )
    if (kind === 'video' && (!Number.isFinite(metadata.duration) || metadata.duration! <= 0))
      throw new Error('La durée de cette vidéo est invalide.')
  }
}
/** Metadata is inspected before allocating decoded audio; URLs always have a bounded lifetime. */
export async function inspectMedia(blob: Blob, kind: MediaRecord['kind']): Promise<void> {
  validateMediaFile(blob, kind)
  const url = URL.createObjectURL(blob)
  try {
    await new Promise<void>((resolve, reject) => {
      const element =
        kind === 'image'
          ? new Image()
          : document.createElement(kind === 'video' ? 'video' : 'audio')
      let done = false
      const finish = (error?: Error) => {
        if (done) return
        done = true
        clearTimeout(timeout)
        element.onerror = null
        if (element instanceof HTMLMediaElement) {
          element.onloadedmetadata = null
          element.pause()
          element.removeAttribute('src')
          element.load()
        } else {
          element.onload = null
          element.removeAttribute('src')
        }
        if (error) reject(error)
        else resolve()
      }
      const timeout = setTimeout(
        () => finish(new Error('Impossible de lire ce média. Essaie un autre format.')),
        15_000,
      )
      element.onerror = () =>
        finish(new Error('Ce média est corrompu ou son codec est incompatible avec ce navigateur.'))
      const ready = () => {
        try {
          if (element instanceof HTMLImageElement)
            validateMediaMetadata(kind, {
              width: element.naturalWidth,
              height: element.naturalHeight,
            })
          else
            validateMediaMetadata(kind, {
              width: element instanceof HTMLVideoElement ? element.videoWidth : undefined,
              height: element instanceof HTMLVideoElement ? element.videoHeight : undefined,
              duration: element.duration,
            })
          finish()
        } catch (error) {
          finish(error as Error)
        }
      }
      if (element instanceof HTMLImageElement) element.onload = ready
      else {
        element.preload = 'metadata'
        element.onloadedmetadata = ready
      }
      element.src = url
    })
    if (kind === 'audio') {
      // MDN: decodeAudioData consumes complete encoded data and returns decoded PCM.
      const decoder = new OfflineAudioContext(2, 1, 44_100)
      const decoded = await decoder.decodeAudioData(await blob.arrayBuffer()).catch(() => {
        throw new Error('Ce fichier audio ne peut pas être décodé par ce navigateur.')
      })
      validateDecodedAudio(decoded)
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
export function validateDecodedAudio(
  buffer: Pick<AudioBuffer, 'length' | 'numberOfChannels' | 'duration'>,
): void {
  if (
    buffer.numberOfChannels > 2 ||
    buffer.length * buffer.numberOfChannels * 4 > MAX_DECODED_AUDIO_BYTES ||
    buffer.duration > MAX_AUDIO_SECONDS
  )
    throw new Error('Audio trop volumineux après décodage. Choisis une boucle stéréo plus courte.')
}
export async function saveMedia(record: MediaRecord, database = db): Promise<void> {
  validateMediaFile(record.blob, record.kind)
  if (record.size !== record.blob.size || record.mimeType !== record.blob.type)
    throw new Error('Les informations du média ne correspondent pas au fichier.')
  try {
    await database.transaction('rw', database.media, async () => {
      let size = 0,
        count = 0
      await database.media.each((item) => {
        if (item.id !== record.id) {
          size += item.size
          count++
        }
      })
      if (count >= MAX_MEDIA_COUNT)
        throw new Error(
          `La médiathèque est limitée à ${MAX_MEDIA_COUNT} fichiers. Supprime un média avant de continuer.`,
        )
      if (size + record.size > MAX_LIBRARY_BYTES)
        throw new Error('Ta médiathèque dépasse 150 Mo. Supprime un média avant de continuer.')
      await database.media.put(record)
    })
  } catch (error) {
    if (error instanceof Error && /quota/i.test(error.name)) throw new Error(storageMessage(error))
    throw error
  }
}
export async function importMedia(file: File, kind: MediaRecord['kind']): Promise<MediaRecord> {
  await inspectMedia(file, kind)
  const record: MediaRecord = {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 200),
    kind,
    mimeType: file.type,
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  }
  await saveMedia(record)
  return record
}
/** Removing a library asset detaches every reference atomically, so no space breaks. */
export async function deleteMedia(id: string, database: KomoluDatabase = db): Promise<void> {
  await database.transaction('rw', database.media, database.state, async () => {
    const record = await database.state.get('app')
    if (record) {
      for (const workspace of record.data.workspaces) {
        if (workspace.background.mediaId === id) {
          workspace.background.type = 'scene'
          delete workspace.background.mediaId
        }
        workspace.audio.tracks = workspace.audio.tracks.filter((track) => track.mediaId !== id)
      }
      record.data.updatedAt = Date.now()
      await database.state.put(record)
    }
    await database.media.delete(id)
  })
}
