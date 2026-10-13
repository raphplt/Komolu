import { useState } from 'react'
import { Leaf, Play, Pause, RotateCcw, Volume2, VolumeX, Plus, Check, Circle } from 'lucide-react'
import { actions, activeWorkspace, useAppState, useNow } from './core/store'
import { formatDuration, timerValue } from './core/timer'
import { ambientAudio } from './core/audio'
export default function App() {
  const { state, error, clearError } = useAppState()
  const now = useNow()
  const [task, setTask] = useState('')
  const [audio, setAudio] = useState(false)
  if (!state) return <main className="loading">Ton petit coin se prépare…{error && <p role="alert">{error}</p>}</main>
  const workspace = activeWorkspace(state)
  const running = state.timer.status === 'running'
  const act = (promise: Promise<unknown>) => { void promise.catch(() => undefined) }
  return <main className={`app scene-${workspace.background.scene}`}>
    <div className="landscape" aria-hidden="true"><div className="sun" /><div className="hill hill-one" /><div className="hill hill-two" /><div className="hill hill-three" /></div>
    <header><a className="brand" href="#"><Leaf size={25} /> komolu<span>TON PETIT COIN POUR TE CONCENTRER</span></a><nav aria-label="Espaces">{state.workspaces.map(space => <button key={space.id} aria-pressed={space.id === workspace.id} onClick={() => act(actions.switchWorkspace(space.id))}>{space.name}</button>)}</nav><span className="local-status">● Tout reste ici</span></header>
    {error && <div role="alert" className="error">{error}<button onClick={clearError}>Fermer</button></div>}
    <section className="welcome"><p>FAIS UN PEU DE PLACE À L’ESSENTIEL</p><h1>Un moment pour toi.</h1><p>{workspace.description}</p></section>
    <section className="desk" aria-label="Mon espace de concentration"><aside className="clock card"><p className="eyebrow">ICI, MAINTENANT</p><time>{new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time><p>{new Date(now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><div className="clock-quote">Une chose<br />à la fois.</div></aside>
      <article className="timer card"><p className="eyebrow">{state.timer.profile.phases[state.timer.phaseIndex].label}</p><div className="timer-digits" role="timer" aria-label="Temps de session">{formatDuration(timerValue(state.timer, now))}</div><p>{state.timer.status === 'waiting' ? 'Une pause bien méritée. Prêt·e ?' : state.timer.status === 'completed' ? 'C’est tout pour cette session. Bien joué.' : 'À ton rythme. Sans pression.'}</p><div className="timer-controls"><button className="primary" onClick={() => act(actions.timer(running ? 'pause' : 'start'))}>{running ? <Pause size={18} /> : <Play size={18} />}{running ? 'Pause' : state.timer.status === 'paused' ? 'Reprendre' : 'Démarrer'}</button><button className="icon-button" aria-label="Réinitialiser la session" onClick={() => act(actions.timer('stop'))}><RotateCcw size={18} /></button></div><p className="timer-cycle">Cycle {state.timer.cycle + 1} / {state.timer.profile.repeats || '∞'} · {state.timer.profile.name}</p>{state.timer.clockWarning && <p role="status">L’heure système a changé. Reprends quand tu es prêt·e.</p>}</article>
      <article className="tasks card"><p className="eyebrow">UN PETIT PAS</p><h2>L’essentiel du jour <span>{state.privateData.tasks.filter(t => t.done).length}/{state.privateData.tasks.length}</span></h2><form onSubmit={e => { e.preventDefault(); const submitted = task; act(actions.addTask(submitted).then(() => setTask(current => current === submitted ? '' : current))) }}><input aria-label="Nouvelle tâche" placeholder="Qu’as-tu en tête ?" value={task} onChange={e => setTask(e.target.value)} maxLength={500} /><button className="icon-button" aria-label="Ajouter la tâche"><Plus size={18} /></button></form>{state.privateData.tasks.length === 0 && <p className="empty">Une petite intention suffit.<br />Le reste peut attendre.</p>}<ul>{state.privateData.tasks.map(item => <li key={item.id}><button aria-label={item.done ? `Rouvrir ${item.title}` : `Terminer ${item.title}`} onClick={() => act(actions.toggleTask(item.id))}>{item.done ? <Check size={18} /> : <Circle size={18} />}</button><button className={item.done ? 'done task-title' : 'task-title'} onClick={() => act(actions.selectTask(item.id))}>{item.title}</button>{item.id === state.privateData.activeTaskId && <span aria-label="Tâche active">•</span>}</li>)}</ul></article>
    </section><footer><button className="audio-button" onClick={() => { if (audio) { ambientAudio.pause(); setAudio(false) } else void ambientAudio.start(workspace.audio.master).then(() => setAudio(true)).catch(() => undefined) }}>{audio ? <Volume2 size={18} /> : <VolumeX size={18} />} Bruit brun <span>{audio ? 'Activé' : 'Écouter'}</span></button><p>Ton espace. Ton rythme. Ta concentration.</p><span>Komolu · 0.1</span></footer>
  </main>
}
