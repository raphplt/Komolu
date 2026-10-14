import { Select } from './Select'
import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../core/storage'
import {
  CloudRain,
  CloudLightning,
  Trees,
  Coffee,
  Flame,
  Headphones,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  Trash2,
  Upload,
} from 'lucide-react'
import { SOUND_CATALOG, SOUND_NAMES } from '../core/sounds'
import { importMedia, mediaAccept } from '../core/media'
import type { AudioTrack, Workspace } from '../core/model'
import { actions } from '../core/store'
import type { AudioController } from '../hooks/useAudio'
import './media.css'

const soundIcons = {
  brown: Headphones,
  white: Headphones,
  rain: CloudRain,
  thunder: CloudLightning,
  wind: Wind,
  fire: Flame,
  forest: Trees,
  cafe: Coffee,
  waves: Waves,
}
export function AudioPanel({
  workspace,
  audio,
  compact = false,
  onOpenMixer,
}: {
  workspace: Workspace
  audio: AudioController
  compact?: boolean
  onOpenMixer?: () => void
}) {
  const [importing, setImporting] = useState(false)
  const library = useLiveQuery(
    () =>
      db.media
        .where('kind')
        .equals('audio')
        .toArray()
        .then((items) => ({ items, error: null as string | null }))
        .catch(() => ({ items: [], error: 'La médiathèque audio est indisponible.' })),
    [],
  )
  const [error, setError] = useState<string | null>(null)
  const change = async (update: (workspace: Workspace) => void) => {
    try {
      await actions.update((state) => {
        const target = state.workspaces.find((item) => item.id === workspace.id)
        if (target) update(target)
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Impossible de sauvegarder le mix.')
    }
  }
  const updateTrack = (id: string, patch: Partial<AudioTrack>) =>
    void change((target) => {
      const track = target.audio.tracks.find((item) => item.id === id)
      if (track) Object.assign(track, patch)
    })
  type DisplayTrack = AudioTrack & { missing?: boolean }
  const tracks: DisplayTrack[] = [
    ...workspace.audio.tracks
      .filter((track) => track.source !== 'media')
      .sort(
        (a, b) =>
          SOUND_CATALOG.findIndex((sound) => sound.id === a.source) -
          SOUND_CATALOG.findIndex((sound) => sound.id === b.source),
      ),
    ...SOUND_CATALOG.filter(
      (sound) => !workspace.audio.tracks.some((track) => track.source === sound.id),
    ).map((sound) => ({
      id: sound.id,
      source: sound.id,
      name: sound.name,
      volume: sound.volume,
      enabled: false,
      missing: true,
    })),
    ...workspace.audio.tracks.filter((track) => track.source === 'media'),
  ]
  const toggle = (track: DisplayTrack) =>
    void change((target) => {
      if (track.missing) {
        const { source, name, volume } = track
        target.audio.tracks.push({ id: crypto.randomUUID(), source, name, volume, enabled: true })
      } else {
        const existing = target.audio.tracks.find((item) => item.id === track.id)
        if (existing) existing.enabled = !existing.enabled
      }
    })
  const upload = async (file: File) => {
    setImporting(true)
    setError(null)
    try {
      if (workspace.audio.tracks.filter((track) => track.source === 'media').length >= 3)
        throw new Error('Garde au maximum 3 pistes personnelles par mix.')
      const media = await importMedia(file, 'audio')
      await change((target) => {
        target.audio.tracks.push({
          id: crypto.randomUUID(),
          source: 'media',
          mediaId: media.id,
          name: media.name,
          enabled: true,
          volume: 0.4,
        })
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Impossible d’importer ce son.')
    } finally {
      setImporting(false)
    }
  }
  return (
    <div className={`audio-panel ${compact ? 'audio-panel-compact' : ''}`}>
      <div className="audio-transport">
        <button
          className="primary"
          onClick={() => void (audio.playing ? audio.pause() : audio.play())}
          disabled={audio.loading}
        >
          {audio.playing ? <Pause size={16} /> : <Play size={16} />}
          {audio.loading ? 'Préparation…' : audio.playing ? 'Pause audio' : 'Écouter'}
        </button>
        <button
          className="icon-button"
          aria-label="Arrêter les sons"
          title="Arrêter les sons"
          onClick={() => void audio.stop()}
        >
          <Square size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={workspace.audio.muted ? 'Rétablir le son' : 'Couper le son'}
          aria-pressed={workspace.audio.muted}
          onClick={() =>
            void change((target) => {
              target.audio.muted = !target.audio.muted
            })
          }
        >
          {workspace.audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
      <label className="audio-master">
        Volume maître <output>{Math.round(workspace.audio.master * 100)} %</output>
        <input
          aria-label="Volume maître"
          type="range"
          min="0"
          max="1"
          step="0.01"
          style={{ '--range-fill': `${workspace.audio.master * 100}%` } as CSSProperties}
          value={workspace.audio.master}
          onChange={(event) => {
            const value = Number(event.target.value)
            void change((target) => {
              target.audio.master = value
            })
          }}
        />
      </label>
      {compact ? (
        <>
          <p className="media-hint">
            {tracks
              .filter((track) => track.enabled)
              .map(
                (track) =>
                  `${track.source === 'media' ? track.name : SOUND_NAMES[track.source]} ${Math.round(track.volume * 100)} %`,
              )
              .join(' · ') || 'Aucune piste activée'}
          </p>
          {onOpenMixer && <button onClick={onOpenMixer}>Ouvrir le mixeur</button>}
        </>
      ) : (
        <>
          <div className="audio-tracks">
            {tracks.map((storedTrack) => {
              const track = {
                ...storedTrack,
                name:
                  storedTrack.source === 'media'
                    ? storedTrack.name
                    : SOUND_NAMES[storedTrack.source],
              }
              const Icon = track.source === 'media' ? Headphones : soundIcons[track.source]
              return (
                <div
                  className={`audio-track ${track.enabled ? 'is-enabled' : ''}`}
                  key={`${track.missing ? 'missing' : 'stored'}:${track.id}`}
                >
                  <button
                    className="audio-track-toggle"
                    aria-pressed={track.enabled}
                    onClick={() => toggle(track)}
                  >
                    <Icon size={18} />
                    <span>{track.name}</span>
                    <span className="audio-track-dot" aria-hidden="true" />
                  </button>
                  <div className="audio-track-level">
                    <input
                      aria-label={`Volume ${track.name}`}
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      style={{ '--range-fill': `${track.volume * 100}%` } as CSSProperties}
                      value={track.volume}
                      disabled={!track.enabled}
                      onChange={(event) =>
                        updateTrack(track.id, { volume: Number(event.target.value) })
                      }
                    />
                    <output>{Math.round(track.volume * 100)} %</output>
                    {track.source === 'media' && (
                      <button
                        className="icon-button"
                        aria-label={`Retirer ${track.name} du mix`}
                        onClick={() =>
                          void change((target) => {
                            target.audio.tracks = target.audio.tracks.filter(
                              (item) => item.id !== track.id,
                            )
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <label className="media-upload">
            <Upload size={15} />{' '}
            {importing ? 'Vérification du fichier…' : 'Ajouter un son personnel'}
            <input
              aria-label="Ajouter un son personnel"
              type="file"
              accept={mediaAccept('audio')}
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }}
            />
          </label>
          {Boolean(library?.items.length) && (
            <label className="audio-library-select">
              Mes sons importés
              <Select
                aria-label="Choisir un son importé"
                value=""
                onChange={(value) => {
                  const media = library?.items.find((item) => item.id === value)
                  if (!media) return
                  void change((target) => {
                    if (target.audio.tracks.some((track) => track.mediaId === media.id))
                      throw new Error('Ce son est déjà dans le mix.')
                    if (target.audio.tracks.filter((track) => track.source === 'media').length >= 3)
                      throw new Error('Garde au maximum 3 pistes personnelles par mix.')
                    target.audio.tracks.push({
                      id: crypto.randomUUID(),
                      source: 'media',
                      mediaId: media.id,
                      name: media.name,
                      enabled: true,
                      volume: 0.4,
                    })
                  })
                }}
              >
                <option value="">Ajouter depuis la médiathèque…</option>
                {library?.items.map((media) => (
                  <option key={media.id} value={media.id}>
                    {media.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <a
            className="media-hint"
            href={`${import.meta.env.BASE_URL}audio/CREDITS.txt`}
            target="_blank"
            rel="noreferrer"
          >
            Sources et licences des sons
          </a>
        </>
      )}
      {(error || audio.error || library?.error) && (
        <p className="media-error" role="alert">
          {error || audio.error || library?.error}
          {audio.error && (
            <button onClick={() => void audio.play()} disabled={audio.loading}>
              Réessayer les sons
            </button>
          )}
        </p>
      )}
    </div>
  )
}
