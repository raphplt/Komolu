import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown, Expand, Leaf, Lightbulb, Maximize2, Minimize2, PanelRight, Settings2, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react'
import type { AppState } from './core/model'
import { actions, activeWorkspace, reportError, useAppState } from './core/store'
import { armCompletionSound } from './core/audio'
import { useAudio, useCompletionSound } from './hooks/useAudio'
import { Background } from './components/Background'
import { AudioPanel } from './components/AudioPanel'
import { ClockWidget, NotesWidget, TasksWidget, TimerWidget } from './components/Widgets'
import { Studio, WidgetFrame } from './components/Studio'
import { TimerSettings } from './components/TimerSettings'
import { PreferencesDialog, ThoughtDialog, WorkspaceDialog } from './components/WorkspaceDialogs'
import { DataPanel } from './components/DataPanel'
import { Scene } from './components/Scene'
import { Dialog } from './components/shared'
import { act } from './core/ui'
type Panel = 'workspaces' | 'timer' | 'thoughts' | 'preferences' | 'data' | 'audio' | null
export default function App() {
  const { state, error, clearError } = useAppState()
  if (!state) return <main className="loading"><Leaf size={32} /><h1>Ton petit coin se prépare…</h1>{error && <p role="alert">{error}</p>}</main>
  return <Experience state={state} error={error} clearError={clearError} />
}
function Experience({ state, error, clearError }: { state: AppState; error: string | null; clearError: () => void }) {
  const workspace = activeWorkspace(state)
  const audio = useAudio(workspace.audio)
  useCompletionSound(state.timer, true)
  const [panel, setPanel] = useState<Panel>(null)
  const [studio, setStudio] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [systemMotion, setSystemMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const focus = state.preferences.focusMode
  const reducedMotion = systemMotion || state.preferences.reducedMotion
  const toggleTimer = () => { if (state.timer.status !== 'running') void armCompletionSound().catch(reportError); act(actions.timer(state.timer.status === 'running' ? 'pause' : 'start')) }
  const toggleFocus = () => { setStudio(false); act(actions.update(s => { s.preferences.focusMode = !s.preferences.focusMode })) }
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const handler = () => setSystemMotion(query.matches); query.addEventListener('change', handler); const full = () => setFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', full); return () => { query.removeEventListener('change', handler); document.removeEventListener('fullscreenchange', full) } }, [])
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (!panel) setStudio(false); return } if (state.preferences.shortcuts === false || panel || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return; const target = event.target as HTMLElement; if (target.closest('input, textarea, select, [contenteditable="true"], dialog')) return; if (event.code === 'Space' && !target.closest('button, a')) { event.preventDefault(); toggleTimer() } if (event.key.toLowerCase() === 'n') { event.preventDefault(); setPanel('thoughts') } if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFocus() } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) })
  const close = () => setPanel(null)
  return <main className={`app scene-${workspace.background.scene} ${focus ? 'focus-mode' : ''} ${studio ? 'studio-open' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}>
    <Background workspace={workspace} reducedMotion={reducedMotion}><Scene scene={workspace.background.scene} /></Background>
    <header className="app-header"><a href="#" className="brand" aria-label="Komolu, accueil" onClick={e => { e.preventDefault(); setStudio(false); act(actions.update(s => { s.preferences.focusMode = false })) }}><span className="brand-mark"><Leaf size={23} strokeWidth={1.5} /></span>komolu<span className="brand-tagline">TON PETIT COIN DE CALME</span></a><div className="header-actions"><button className="workspace-switch" onClick={() => setPanel('workspaces')}><span className={`scene-dot ${workspace.background.scene}`} />{workspace.name}<ChevronDown size={15} /></button><button className={`studio-button ${studio ? 'active' : ''}`} aria-pressed={studio} onClick={() => { setStudio(!studio); if (focus) act(actions.update(s => { s.preferences.focusMode = false })) }}><SlidersHorizontal size={16} /> Studio</button></div></header>
    {error && <div role="alert" className="error global-error"><span>{error}</span><button onClick={clearError}>Fermer</button></div>}
    <div className="workspace-body"><section className="welcome"><div className="welcome-kicker"><span /> TON ESPACE. TON RYTHME.</div><h1>{workspace.background.scene === 'cozy' ? 'Un refuge pour tes idées.' : workspace.background.scene === 'deep' ? 'Le calme. Et rien d’autre.' : <>Fais de la place<br className="mobile-break" /> à l’essentiel.</>}</h1><p>{workspace.description} Une chose à la fois.</p><div className="welcome-doodle" aria-hidden="true">✳</div></section>
    {studio && <p className="studio-hint"><SlidersHorizontal size={14} /> Tout est à sa place. Ou presque : à toi de composer.</p>}
    <section className="widget-grid" aria-label="Mon espace de concentration">{workspace.widgets.filter(w => w.visible).map(widget => <WidgetFrame key={`${workspace.id}-${widget.id}`} widget={widget} studio={studio} selected={selected === widget.id} onSelect={setSelected}>{widget.type === 'clock' ? <ClockWidget widget={widget} /> : widget.type === 'timer' ? <TimerWidget state={state} onSettings={() => setPanel('timer')} onToggle={toggleTimer} /> : widget.type === 'tasks' ? <TasksWidget state={state} /> : widget.type === 'notes' ? <NotesWidget notes={state.privateData.notes} /> : <AudioPanel workspace={workspace} audio={audio} />}</WidgetFrame>)}</section>
    {workspace.widgets.every(w => !w.visible) && <div className="empty-canvas"><Leaf size={40} /><p>Un espace vide, plein de possibles.</p><button onClick={() => setStudio(true)}>Ajouter un widget <PlusIcon /></button></div>}
    <div className="desk-caption"><span><Check size={12} /> Enregistré dans ce navigateur</span><span>Un peu moins de bruit. Un peu plus de toi.</span></div></div>
    <footer className="bottom-bar"><div className="dock" aria-label="Commandes de l’espace"><button className="dock-audio" onClick={() => setPanel('audio')} aria-label="Ouvrir les ambiances">{audio.playing ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>Ambiances<small>{audio.playing ? 'Le calme s’écoute' : 'Un fond de douceur'}</small></span>{audio.playing && <span className="sound-bars" aria-hidden="true"><i /><i /><i /></span>}</button><span className="dock-divider" /><button className="icon-button" aria-label="Capturer une pensée" title="Pensée · N" onClick={() => setPanel('thoughts')}><Lightbulb size={20} />{state.privateData.thoughts.length > 0 && <span className="notification-dot" />}</button><button className="icon-button" aria-label={focus ? 'Quitter le mode Focus' : 'Activer le mode Focus'} aria-pressed={focus} title="Focus · F" onClick={toggleFocus}>{focus ? <Minimize2 size={19} /> : <Maximize2 size={19} />}</button><button className="icon-button fullscreen-button" aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'} onClick={() => { const operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); if (operation) void operation.catch(() => reportError(new Error('Le plein écran n’est pas disponible dans ce navigateur.'))) }}><Expand size={18} /></button><button className="icon-button" aria-label="Préférences" onClick={() => setPanel('preferences')}><Settings2 size={19} /></button></div><div className="footer-note"><Leaf size={12} /> Libre, local, et juste pour toi.</div></footer>
    {studio && <Studio workspace={workspace} selected={selected} onSelect={setSelected} onClose={() => setStudio(false)} />}
    {focus && <button className="focus-exit" onClick={toggleFocus}><PanelRight size={15} /> Retrouver l’espace</button>}
    {panel === 'workspaces' && <WorkspaceDialog state={state} onClose={close} />}{panel === 'timer' && <TimerSettings profile={workspace.timerProfile} onClose={close} />}{panel === 'thoughts' && <ThoughtDialog state={state} onClose={close} />}{panel === 'preferences' && <PreferencesDialog state={state} onClose={close} onData={() => setPanel('data')} />}{panel === 'data' && <DataPanel onClose={close} />}{panel === 'audio' && <Dialog title="Le son de ton petit coin" onClose={close}><AudioPanel workspace={workspace} audio={audio} /></Dialog>}
  </main>
}
function PlusIcon() { return <ArrowUpRight size={16} /> }
