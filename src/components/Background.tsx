import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Trash2 } from 'lucide-react'
import type { Background as BackgroundModel, Workspace } from '../core/model'
import { db } from '../core/storage'
import { deleteMedia, importMedia, mediaAccept, MAX_LIBRARY_BYTES } from '../core/media'
import { actions } from '../core/store'
import './media.css'

function LocalBackground({ background, reducedMotion }: { background: BackgroundModel; reducedMotion: boolean }) {
  const [asset, setAsset] = useState<{ url: string; kind: 'image' | 'video' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let disposed = false, url: string | undefined
    void db.media.get(background.mediaId ?? '').then(record => {
      if (disposed) return
      if (!record || record.kind === 'audio' || record.kind !== background.type) throw new Error('Le fond local est introuvable. Le décor intégré prend le relais.')
      url = URL.createObjectURL(record.blob)
      setAsset({ url, kind: record.kind })
    }).catch(() => { if (!disposed) setError('Le fond local est indisponible. Le décor intégré prend le relais.') })
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [background.mediaId, background.type])
  useEffect(() => {
    const element = video.current
    if (!element) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    let disposed = false
    const sync = () => {
      if (document.hidden || reducedMotion || query.matches) element.pause()
      else void element.play().catch(error => {
        if (!disposed && error instanceof Error && error.name !== 'AbortError') setError('La vidéo ne peut pas être lue. Le décor intégré reste disponible.')
      })
    }
    sync()
    element.addEventListener('loadeddata', sync)
    document.addEventListener('visibilitychange', sync); query.addEventListener('change', sync)
    return () => { disposed = true; element.pause(); element.removeEventListener('loadeddata', sync); document.removeEventListener('visibilitychange', sync); query.removeEventListener('change', sync) }
  }, [asset, reducedMotion])
  if (error) return <span className="background-error" role="status">{error}</span>
  if (!asset) return null
  const style: CSSProperties = { objectFit: 'cover', objectPosition: background.position }
  return asset.kind === 'image' ? <img className="local-background-media" src={asset.url} alt="" style={style} onError={() => setError('Image illisible. Le décor intégré prend le relais.')} /> : <video ref={video} className="local-background-media" src={asset.url} style={style} muted loop playsInline preload="auto" aria-hidden="true" onError={() => setError('Vidéo illisible. Le décor intégré prend le relais.')} />
}
export function Background({ workspace, reducedMotion, children }: { workspace: Workspace; reducedMotion: boolean; children?: ReactNode }) {
  const background = workspace.background
  return <div className="background-root">
    <div className="background-content" style={{ filter: `blur(${background.blur}px)`, transform: background.blur ? 'scale(1.04)' : undefined }}>
      {children}
      {background.type !== 'scene' && <LocalBackground key={`${background.mediaId}:${background.type}`} background={background} reducedMotion={reducedMotion} />}
    </div>
    <div className="background-tint" aria-hidden="true" style={{ background: background.color }} />
    <div className="background-dim" aria-hidden="true" style={{ opacity: background.dim }} />
  </div>
}
export function BackgroundSettings({ workspace }: { workspace: Workspace }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const libraryResult = useLiveQuery(() => db.media.toArray().then(items => ({ items, error: null as string | null })).catch(() => ({ items: [], error: 'La médiathèque locale est indisponible. Vérifie les autorisations de stockage.' })), [])
  const library = libraryResult?.items
  const change = async (patch: Partial<BackgroundModel>) => {
    try { await actions.update(state => { const target = state.workspaces.find(item => item.id === workspace.id); if (target) { Object.assign(target.background, patch); if (target.background.type === 'scene') delete target.background.mediaId } }) }
    catch { setError('Impossible de sauvegarder les réglages du fond.') }
  }
  const upload = async (file: File) => {
    setBusy(true); setError(null)
    try {
      const media = await importMedia(file, file.type.startsWith('video/') ? 'video' : 'image')
      await change({ mediaId: media.id, type: media.kind as 'image' | 'video' })
    } catch (error) { setError(error instanceof Error ? error.message : 'Impossible d’importer ce fond.') } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true); setError(null)
    try { await deleteMedia(id); setDeleting(null) } catch { setError('Impossible de supprimer ce média.') } finally { setBusy(false) }
  }
  const used = library?.reduce((sum, record) => sum + record.size, 0) ?? 0
  return <div className="background-settings">
    <label className="media-upload"><ImagePlus size={17} /> {busy ? 'Vérification du média…' : 'Importer une image ou vidéo'}<input aria-label="Importer une image ou vidéo" type="file" accept={`${mediaAccept('image')},${mediaAccept('video')}`} disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = '' }} /></label>
    <p className="media-hint">JPEG, PNG, WebP, AVIF · MP4, WebM, OGG. 50 Mo par fichier, stocké uniquement ici.</p>
    {workspace.background.type !== 'scene' && <button className="text-button" onClick={() => void change({ type: 'scene', mediaId: undefined })}>Revenir au décor intégré</button>}
    <label>Assombrissement <output>{Math.round(workspace.background.dim * 100)} %</output><input aria-label="Assombrissement" type="range" min="0" max="0.8" step="0.01" value={workspace.background.dim} onChange={event => void change({ dim: Number(event.target.value) })} /></label>
    <label>Flou <output>{workspace.background.blur} px</output><input aria-label="Flou du fond" type="range" min="0" max="12" step="1" value={workspace.background.blur} onChange={event => void change({ blur: Number(event.target.value) })} /></label>
    <label>Cadrage<select aria-label="Cadrage du fond" value={workspace.background.position} onChange={event => void change({ position: event.target.value })}><option value="50% 50%">Centré</option><option value="0% 50%">À gauche</option><option value="100% 50%">À droite</option><option value="50% 0%">En haut</option><option value="50% 100%">En bas</option></select></label>
    <label className="media-color-label">Voile de couleur<input aria-label="Voile de couleur" type="color" value={workspace.background.color} onChange={event => void change({ color: event.target.value })} /></label>
    <details className="media-library"><summary>Médiathèque locale · {(used / 1024 / 1024).toFixed(1)} / {MAX_LIBRARY_BYTES / 1024 / 1024} Mo</summary>
      {!library?.length && <p className="media-hint">Tes futurs imports apparaîtront ici.</p>}
      {library?.map(record => <div className="media-library-item" key={record.id}><span>{record.name}<small>{record.kind} · {(record.size / 1024 / 1024).toFixed(1)} Mo</small></span>{record.kind !== 'audio' && <button onClick={() => void change({ type: record.kind as 'image' | 'video', mediaId: record.id })} aria-label={`Utiliser ${record.name}`}>Utiliser</button>}<button className="icon-button" aria-label={`Supprimer ${record.name}`} onClick={() => setDeleting(record.id)}><Trash2 size={14} /></button></div>)}
      {deleting && <div className="media-delete-confirm"><p>Supprimer ce média de tous les espaces ? Les décors concernés retrouveront leur scène intégrée.</p><button onClick={() => setDeleting(null)}>Annuler</button><button disabled={busy} onClick={() => void remove(deleting)}>Supprimer le média</button></div>}
    </details>
    {(error || libraryResult?.error) && <p className="media-error" role="alert">{error || libraryResult?.error}</p>}
  </div>
}
