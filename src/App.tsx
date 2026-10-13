import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Expand,
  Leaf,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  PanelsTopLeft,
  Settings2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { AppState } from './core/model'
import { actions, activeWorkspace, reportError, useAppState, useNow } from './core/store'
import { formatDuration, timerValue } from './core/timer'
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
  if (!state)
    return (
      <main className="loading">
        <Leaf size={32} />
        <h1>Chargement de Komolu…</h1>
        {error && <p role="alert">{error}</p>}
      </main>
    )
  return <Experience state={state} error={error} clearError={clearError} />
}
function Experience({
  state,
  error,
  clearError,
}: {
  state: AppState
  error: string | null
  clearError: () => void
}) {
  const workspace = activeWorkspace(state)
  const audio = useAudio(workspace.audio)
  useCompletionSound(state.timer, true, state.dataEpoch)
  const [panel, setPanel] = useState<Panel>(null)
  const [studio, setStudio] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement)
  const [systemMotion, setSystemMotion] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const focus = workspace.focusMode
  const reducedMotion = systemMotion || state.preferences.reducedMotion
  const toggleTimer = () => {
    if (state.timer.status !== 'running' && state.timer.profile.sound)
      void armCompletionSound().catch(reportError)
    act(actions.timer(state.timer.status === 'running' ? 'pause' : 'start'))
  }
  const toggleFocus = () => {
    setStudio(false)
    act(
      actions.workspace((space) => {
        space.focusMode = !space.focusMode
      }),
    )
  }
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setSystemMotion(query.matches)
    query.addEventListener('change', handler)
    const full = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', full)
    return () => {
      query.removeEventListener('change', handler)
      document.removeEventListener('fullscreenchange', full)
    }
  }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!panel) setStudio(false)
        return
      }
      if (
        state.preferences.shortcuts === false ||
        panel ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"], dialog')) return
      if (event.code === 'Space' && !target.closest('button, a')) {
        event.preventDefault()
        toggleTimer()
      }
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setPanel('thoughts')
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        toggleFocus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
  const close = () => setPanel(null)
  return (
    <main
      className={`app scene-${workspace.palette} ${focus ? 'focus-mode' : ''} ${studio ? 'studio-open' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}
    >
      <Background workspace={workspace} reducedMotion={reducedMotion}>
        <Scene scene={workspace.background.scene} />
      </Background>
      <header className="app-header">
        <a
          href="#"
          className="brand"
          aria-label="Komolu, accueil"
          onClick={(e) => {
            e.preventDefault()
            setStudio(false)
            act(
              actions.workspace((space) => {
                space.focusMode = false
              }),
            )
          }}
        >
          <span className="brand-mark">
            <Leaf size={23} strokeWidth={1.5} />
          </span>
          komolu
        </a>
        <div className="header-actions">
          <button className="workspace-switch" onClick={() => setPanel('workspaces')}>
            <span className={`scene-dot ${workspace.background.scene}`} />
            {workspace.name}
            <ChevronDown size={15} />
          </button>
          <button
            className={`studio-button ${studio ? 'active' : ''}`}
            aria-pressed={studio}
            onClick={() => {
              setStudio(!studio)
              if (focus)
                act(
                  actions.workspace((space) => {
                    space.focusMode = false
                  }),
                )
            }}
          >
            <SlidersHorizontal size={16} /> Studio
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="error global-error">
          <span>{error}</span>
          <button onClick={clearError}>Fermer</button>
        </div>
      )}
      <div className="workspace-body">
        <section className="workspace-heading">
          <h1>{workspace.name}</h1>
          {workspace.description && <p>{workspace.description}</p>}
        </section>
        <section className="widget-grid" aria-label="Mon espace de concentration">
          {workspace.widgets
            .filter((w) => w.visible)
            .map((widget) => (
              <WidgetFrame
                key={`${workspace.id}-${widget.id}`}
                widget={widget}
                studio={studio}
                selected={selected === widget.id}
                onSelect={setSelected}
              >
                {widget.type === 'clock' ? (
                  <ClockWidget widget={widget} />
                ) : widget.type === 'timer' ? (
                  <TimerWidget
                    state={state}
                    onSettings={() => setPanel('timer')}
                    onToggle={toggleTimer}
                  />
                ) : widget.type === 'tasks' ? (
                  <TasksWidget state={state} />
                ) : widget.type === 'notes' ? (
                  <NotesWidget notes={state.privateData.notes} dataEpoch={state.dataEpoch} />
                ) : (
                  <AudioPanel
                    workspace={workspace}
                    audio={audio}
                    compact
                    onOpenMixer={() => setPanel('audio')}
                  />
                )}
              </WidgetFrame>
            ))}
        </section>
        {workspace.widgets.every((w) => !w.visible) && (
          <div className="empty-canvas">
            <Leaf size={40} />
            <p>Aucun widget affiché.</p>
            <button onClick={() => setStudio(true)}>
              Ajouter un widget <PlusIcon />
            </button>
          </div>
        )}
        <div className="desk-caption">
          <span>
            <Check size={12} /> Enregistré dans ce navigateur
          </span>
        </div>
      </div>
      {!focus && (
        <footer className="bottom-bar">
          <div className="dock" aria-label="Commandes de l’espace">
            <button
              className="dock-audio"
              onClick={() => setPanel('audio')}
              aria-label="Ouvrir les ambiances"
            >
              {audio.playing ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span>Ambiances</span>
              {audio.playing && (
                <span className="sound-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </button>
            <span className="dock-divider" />
            <button
              className="icon-button"
              aria-label="Capturer une pensée"
              title="Pensée · N"
              onClick={() => setPanel('thoughts')}
            >
              <Lightbulb size={20} />
              {state.privateData.thoughts.length > 0 && <span className="notification-dot" />}
            </button>
            <button
              className="icon-button"
              aria-label={focus ? 'Quitter le mode Focus' : 'Activer le mode Focus'}
              aria-pressed={focus}
              title="Focus · F"
              onClick={toggleFocus}
            >
              {focus ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
            </button>
            <button
              className="icon-button fullscreen-button"
              aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
              onClick={() => {
                const operation = document.fullscreenElement
                  ? document.exitFullscreen()
                  : document.documentElement.requestFullscreen?.()
                if (operation)
                  void operation.catch(() =>
                    reportError(
                      new Error('Le plein écran n’est pas disponible dans ce navigateur.'),
                    ),
                  )
              }}
            >
              <Expand size={18} />
            </button>
            <button
              className="icon-button"
              aria-label="Préférences"
              onClick={() => setPanel('preferences')}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </footer>
      )}
      {studio && (
        <Studio
          workspace={workspace}
          selected={selected}
          onSelect={setSelected}
          onClose={() => setStudio(false)}
        />
      )}
      {focus && (
        <FocusToolbar
          state={state}
          playing={audio.playing}
          onToggle={toggleTimer}
          onAudio={() => setPanel('audio')}
          onThought={() => setPanel('thoughts')}
          onExit={toggleFocus}
          onWorkspace={() => setPanel('workspaces')}
        />
      )}
      {panel === 'workspaces' && <WorkspaceDialog state={state} onClose={close} />}
      {panel === 'timer' && <TimerSettings profile={workspace.timerProfile} onClose={close} />}
      {panel === 'thoughts' && <ThoughtDialog state={state} onClose={close} />}
      {panel === 'preferences' && (
        <PreferencesDialog state={state} onClose={close} onData={() => setPanel('data')} />
      )}
      {panel === 'data' && <DataPanel onClose={close} />}
      {panel === 'audio' && (
        <Dialog title="Ambiances" onClose={close}>
          <AudioPanel workspace={workspace} audio={audio} />
        </Dialog>
      )}
    </main>
  )
}
function PlusIcon() {
  return <ArrowUpRight size={16} />
}

function FocusToolbar({
  state,
  playing,
  onToggle,
  onAudio,
  onThought,
  onExit,
  onWorkspace,
}: {
  state: AppState
  playing: boolean
  onToggle: () => void
  onAudio: () => void
  onThought: () => void
  onExit: () => void
  onWorkspace: () => void
}) {
  const now = useNow()
  const running = state.timer.status === 'running'
  return (
    <nav className="focus-toolbar" aria-label="Commandes du mode Focus">
      <button
        onClick={onToggle}
        aria-label={running ? 'Suspendre la session' : 'Démarrer ou reprendre la session'}
      >
        {running ? <Pause size={17} /> : <Play size={17} />}
        <span className="focus-time">{formatDuration(timerValue(state.timer, now))}</span>
      </button>
      <span className="dock-divider" />
      <button
        className="icon-button"
        aria-label="Ouvrir les ambiances"
        title="Ambiances"
        onClick={onAudio}
      >
        {playing ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <button
        className="icon-button"
        aria-label="Capturer une pensée"
        title="Pensée · N"
        onClick={onThought}
      >
        <Lightbulb size={18} />
      </button>
      <button
        className="icon-button"
        aria-label="Changer d’espace"
        title="Espaces"
        onClick={onWorkspace}
      >
        <PanelsTopLeft size={18} />
      </button>
      <button
        className="focus-leave"
        aria-label="Quitter le mode Focus"
        title="Quitter Focus · F"
        onClick={onExit}
      >
        <Minimize2 size={17} />
        <span>Quitter Focus</span>
      </button>
    </nav>
  )
}
