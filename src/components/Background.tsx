import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { Background as BackgroundModel, Scene, Workspace } from '../core/model'
import { db } from '../core/storage'
import { deleteMedia, importMedia, mediaAccept, MAX_LIBRARY_BYTES } from '../core/media'
import { actions } from '../core/store'
import { Dialog } from './shared'
import { WALLPAPERS, wallpaperById, wallpaperUrl } from '../core/wallpapers'
import './media.css'

function LocalBackground({
  background,
  reducedMotion,
}: {
  background: BackgroundModel
  reducedMotion: boolean
}) {
  const [asset, setAsset] = useState<{ url: string; kind: 'image' | 'video' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let disposed = false,
      url: string | undefined
    void db.media
      .get(background.mediaId ?? '')
      .then((record) => {
        if (disposed) return
        if (!record || record.kind === 'audio' || record.kind !== background.type)
          throw new Error('Le fond local est introuvable. Le décor intégré prend le relais.')
        url = URL.createObjectURL(record.blob)
        setAsset({ url, kind: record.kind })
      })
      .catch(() => {
        if (!disposed) setError('Le fond local est indisponible. Le décor intégré prend le relais.')
      })
    return () => {
      disposed = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [background.mediaId, background.type])
  useEffect(() => {
    const element = video.current
    if (!element) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    let disposed = false
    const sync = () => {
      if (document.hidden || reducedMotion || query.matches) element.pause()
      else
        void element.play().catch((error) => {
          if (!disposed && error instanceof Error && error.name !== 'AbortError')
            setError('La vidéo ne peut pas être lue. Le décor intégré reste disponible.')
        })
    }
    sync()
    element.addEventListener('loadeddata', sync)
    document.addEventListener('visibilitychange', sync)
    query.addEventListener('change', sync)
    return () => {
      disposed = true
      element.pause()
      element.removeEventListener('loadeddata', sync)
      document.removeEventListener('visibilitychange', sync)
      query.removeEventListener('change', sync)
    }
  }, [asset, reducedMotion])
  if (error)
    return (
      <span className="background-error" role="status">
        {error}
      </span>
    )
  if (!asset) return null
  const style: CSSProperties = { objectFit: 'cover', objectPosition: background.position }
  return asset.kind === 'image' ? (
    <img
      className="local-background-media"
      src={asset.url}
      alt=""
      style={style}
      onError={() => setError('Image illisible. Le décor intégré prend le relais.')}
    />
  ) : (
    <video
      ref={video}
      className="local-background-media"
      src={asset.url}
      style={style}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setError('Vidéo illisible. Le décor intégré prend le relais.')}
    />
  )
}
function GalleryBackground({ background }: { background: BackgroundModel }) {
  const [failed, setFailed] = useState(false)
  const wallpaper = wallpaperById(background.wallpaperId)
  if (!wallpaper) return null
  if (failed)
    return (
      <span className="background-error" role="status">
        Fond indisponible. Le décor intégré prend le relais.
      </span>
    )
  return (
    <img
      className="local-background-media"
      src={wallpaperUrl(wallpaper.id)}
      alt=""
      style={{ objectFit: 'cover', objectPosition: background.position }}
      onError={() => setFailed(true)}
    />
  )
}
export function Background({
  workspace,
  reducedMotion,
  children,
}: {
  workspace: Workspace
  reducedMotion: boolean
  children?: ReactNode
}) {
  const background = workspace.background
  return (
    <div className="background-root">
      <div
        className="background-content"
        style={{
          filter: `blur(${background.blur}px)`,
          transform: background.blur ? 'scale(1.04)' : undefined,
        }}
      >
        {background.type === 'solid' ? (
          <div className="generated-background" style={{ background: background.solidColor }} />
        ) : background.type === 'gradient' ? (
          <div
            className="generated-background"
            style={{
              background: `linear-gradient(${background.gradient.angle}deg, ${background.gradient.from}, ${background.gradient.to})`,
            }}
          />
        ) : (
          children
        )}
        {background.type === 'scene' && background.wallpaperId && (
          <GalleryBackground key={background.wallpaperId} background={background} />
        )}
        {(background.type === 'image' || background.type === 'video') && (
          <LocalBackground
            key={`${background.mediaId}:${background.type}`}
            background={background}
            reducedMotion={reducedMotion}
          />
        )}
      </div>
      <div
        className="background-tint"
        aria-hidden="true"
        style={{ background: background.color, opacity: background.tintOpacity }}
      />
      <div className="background-dim" aria-hidden="true" style={{ opacity: background.dim }} />
    </div>
  )
}
export function BackgroundSettings({ workspace }: { workspace: Workspace }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [category, setCategory] = useState<'all' | 'landscapes' | 'interiors' | 'anime'>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const libraryResult = useLiveQuery(
    () =>
      db.media
        .toArray()
        .then((items) => ({ items, error: null as string | null }))
        .catch(() => ({
          items: [],
          error: 'La médiathèque locale est indisponible. Vérifie les autorisations de stockage.',
        })),
    [],
  )
  const library = libraryResult?.items
  const change = async (patch: Partial<BackgroundModel>) => {
    setError(null)
    try {
      await actions.update((state) => {
        const target = state.workspaces.find((item) => item.id === workspace.id)
        if (target) {
          Object.assign(target.background, patch)
          if (target.background.type !== 'scene' || ('scene' in patch && !('wallpaperId' in patch)))
            delete target.background.wallpaperId
          if (target.background.type !== 'image' && target.background.type !== 'video')
            delete target.background.mediaId
        }
      })
      return true
    } catch {
      setError('Impossible de sauvegarder les réglages du fond.')
      return false
    }
  }
  const upload = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const media = await importMedia(file, file.type.startsWith('video/') ? 'video' : 'image')
      await change({ mediaId: media.id, type: media.kind as 'image' | 'video' })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Impossible d’importer ce fond.')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await deleteMedia(id)
      setDeleting(null)
    } catch {
      setError('Impossible de supprimer ce média.')
    } finally {
      setBusy(false)
    }
  }
  const used = library?.reduce((sum, record) => sum + record.size, 0) ?? 0
  return (
    <div className="background-settings">
      <button className="wallpaper-gallery-open" onClick={() => setGalleryOpen(true)}>
        <img
          src={wallpaperUrl(
            wallpaperById(workspace.background.wallpaperId)?.id ?? 'rainy-loft',
            true,
          )}
          alt=""
          loading="lazy"
        />
        <span>
          <strong>Galerie de fonds</strong>
          <small>Paysages · Intérieurs · Anime</small>
        </span>
      </button>
      {galleryOpen && (
        <Dialog title="Galerie de fonds" wide onClose={() => setGalleryOpen(false)}>
          <div className="wallpaper-filters" role="group" aria-label="Catégories de fonds">
            {(
              [
                ['all', 'Tous'],
                ['landscapes', 'Paysages'],
                ['interiors', 'Intérieurs'],
                ['anime', 'Anime'],
              ] as const
            ).map(([id, name]) => (
              <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>
                {name}
              </button>
            ))}
          </div>
          <div className="wallpaper-grid">
            {WALLPAPERS.filter(
              (wallpaper) => category === 'all' || wallpaper.category === category,
            ).map((wallpaper) => (
              <button
                className="wallpaper-card"
                key={wallpaper.id}
                aria-label={`Choisir ${wallpaper.name}`}
                aria-pressed={
                  workspace.background.type === 'scene' &&
                  workspace.background.wallpaperId === wallpaper.id
                }
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void change({ type: 'scene', wallpaperId: wallpaper.id }).then((saved) => {
                    setBusy(false)
                    if (saved) setGalleryOpen(false)
                  })
                }}
              >
                <img
                  src={wallpaperUrl(wallpaper.id, true)}
                  alt=""
                  loading="lazy"
                  width="480"
                  height="270"
                />
                <span>{wallpaper.name}</span>
              </button>
            ))}
          </div>
          {error && (
            <p className="media-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      <label>
        Type de fond
        <select
          aria-label="Type de fond"
          value={
            workspace.background.type === 'image' || workspace.background.type === 'video'
              ? 'media'
              : workspace.background.type
          }
          onChange={(event) => {
            const type = event.target.value as 'scene' | 'solid' | 'gradient'
            if (type !== 'scene' && type !== 'solid' && type !== 'gradient') return
            void change({ type })
          }}
        >
          <option value="scene">Scène illustrée</option>
          <option value="solid">Couleur unie</option>
          <option value="gradient">Dégradé</option>
          {(workspace.background.type === 'image' || workspace.background.type === 'video') && (
            <option value="media">Média personnel</option>
          )}
        </select>
      </label>
      <label>
        {workspace.background.type === 'scene' && !workspace.background.wallpaperId
          ? 'Scène'
          : 'Scène de secours'}
        <select
          aria-label="Scène"
          value={workspace.background.scene}
          onChange={(event) => void change({ scene: event.target.value as Scene })}
        >
          <option value="minimal">Minimal</option>
          <option value="cozy">Cozy</option>
          <option value="deep">Deep Work</option>
        </select>
      </label>
      <label>
        Palette des widgets
        <select
          aria-label="Palette des widgets"
          value={workspace.palette}
          onChange={(event) => {
            const palette = event.target.value as Scene
            void actions
              .update((state) => {
                const target = state.workspaces.find((item) => item.id === workspace.id)
                if (target) target.palette = palette
              })
              .catch(() => setError('Impossible de sauvegarder la palette.'))
          }}
        >
          <option value="minimal">Claire · sauge</option>
          <option value="cozy">Chaude · caramel</option>
          <option value="deep">Sombre · mauve</option>
        </select>
      </label>
      {workspace.background.type === 'solid' && (
        <label className="media-color-label">
          Couleur du fond
          <input
            type="color"
            aria-label="Couleur du fond"
            value={workspace.background.solidColor}
            onChange={(event) => void change({ solidColor: event.target.value })}
          />
        </label>
      )}
      {workspace.background.type === 'gradient' && (
        <fieldset className="gradient-fields">
          <legend>Dégradé</legend>
          <label className="media-color-label">
            Première couleur
            <input
              type="color"
              aria-label="Première couleur du dégradé"
              value={workspace.background.gradient.from}
              onChange={(event) =>
                void change({
                  gradient: { ...workspace.background.gradient, from: event.target.value },
                })
              }
            />
          </label>
          <label className="media-color-label">
            Seconde couleur
            <input
              type="color"
              aria-label="Seconde couleur du dégradé"
              value={workspace.background.gradient.to}
              onChange={(event) =>
                void change({
                  gradient: { ...workspace.background.gradient, to: event.target.value },
                })
              }
            />
          </label>
          <label>
            Angle <output>{workspace.background.gradient.angle}°</output>
            <input
              type="range"
              aria-label="Angle du dégradé"
              min="0"
              max="360"
              step="5"
              value={workspace.background.gradient.angle}
              onChange={(event) =>
                void change({
                  gradient: { ...workspace.background.gradient, angle: Number(event.target.value) },
                })
              }
            />
          </label>
        </fieldset>
      )}
      <label className="media-upload">
        <ImagePlus size={17} /> {busy ? 'Vérification du média…' : 'Importer une image ou vidéo'}
        <input
          aria-label="Importer une image ou vidéo"
          type="file"
          accept={`${mediaAccept('image')},${mediaAccept('video')}`}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.target.value = ''
          }}
        />
      </label>
      <p className="media-hint">
        JPEG, PNG, WebP, AVIF · MP4, WebM, OGG. 50 Mo par fichier, stocké uniquement ici.
      </p>
      {(workspace.background.type === 'image' ||
        workspace.background.type === 'video' ||
        workspace.background.wallpaperId) && (
        <button
          className="text-button"
          onClick={() => void change({ type: 'scene', scene: workspace.background.scene })}
        >
          Revenir au décor intégré
        </button>
      )}
      <label>
        Assombrissement <output>{Math.round(workspace.background.dim * 100)} %</output>
        <input
          aria-label="Assombrissement"
          type="range"
          min="0"
          max="0.8"
          step="0.01"
          value={workspace.background.dim}
          onChange={(event) => void change({ dim: Number(event.target.value) })}
        />
      </label>
      <label>
        Flou <output>{workspace.background.blur} px</output>
        <input
          aria-label="Flou du fond"
          type="range"
          min="0"
          max="12"
          step="1"
          value={workspace.background.blur}
          onChange={(event) => void change({ blur: Number(event.target.value) })}
        />
      </label>
      <label>
        Cadrage
        <select
          aria-label="Cadrage du fond"
          value={workspace.background.position}
          onChange={(event) => void change({ position: event.target.value })}
        >
          <option value="50% 50%">Centré</option>
          <option value="0% 50%">À gauche</option>
          <option value="100% 50%">À droite</option>
          <option value="50% 0%">En haut</option>
          <option value="50% 100%">En bas</option>
        </select>
      </label>
      <label className="media-color-label">
        Voile de couleur
        <input
          aria-label="Voile de couleur"
          type="color"
          value={workspace.background.color}
          onChange={(event) => void change({ color: event.target.value })}
        />
      </label>
      <label>
        Intensité du voile <output>{Math.round(workspace.background.tintOpacity * 100)} %</output>
        <input
          aria-label="Intensité du voile"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={workspace.background.tintOpacity}
          onChange={(event) => void change({ tintOpacity: Number(event.target.value) })}
        />
      </label>
      <details className="media-library">
        <summary>
          Médiathèque locale · {(used / 1024 / 1024).toFixed(1)} / {MAX_LIBRARY_BYTES / 1024 / 1024}{' '}
          Mo
        </summary>
        {!library?.length && <p className="media-hint">Tes futurs imports apparaîtront ici.</p>}
        {library?.map((record) => (
          <div className="media-library-item" key={record.id}>
            <span>
              {record.name}
              <small>
                {record.kind} · {(record.size / 1024 / 1024).toFixed(1)} Mo
              </small>
            </span>
            {record.kind !== 'audio' && (
              <button
                onClick={() =>
                  void change({ type: record.kind as 'image' | 'video', mediaId: record.id })
                }
                aria-label={`Utiliser ${record.name}`}
              >
                Utiliser
              </button>
            )}
            <button
              className="icon-button"
              aria-label={`Supprimer ${record.name}`}
              onClick={() => setDeleting(record.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {deleting && (
          <div className="media-delete-confirm">
            <p>
              Supprimer ce média de tous les espaces ? Les décors concernés retrouveront leur scène
              intégrée.
            </p>
            <button onClick={() => setDeleting(null)}>Annuler</button>
            <button disabled={busy} onClick={() => void remove(deleting)}>
              Supprimer le média
            </button>
          </div>
        )}
      </details>
      {(error || libraryResult?.error) && (
        <p className="media-error" role="alert">
          {error || libraryResult?.error}
        </p>
      )}
    </div>
  )
}
