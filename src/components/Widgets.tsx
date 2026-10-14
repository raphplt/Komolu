import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
} from 'lucide-react'
import type { AppState, Widget } from '../core/model'
import { actions, useNow } from '../core/store'
import { formatDuration, timerValue } from '../core/timer'
import { act } from '../core/ui'
import { NoteDraft, notesEpoch, registerNoteDraft } from '../core/notes'
import { reportError } from '../core/store'
import { storageMessage } from '../core/storage'
export function ClockWidget({ widget }: { widget: Widget }) {
  const now = useNow(widget.settings.showSeconds ? 1_000 : 10_000)
  const date = new Date(now)
  const { timezone, showSeconds, clockFormat, showDate, clockStyle } = widget.settings
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone || undefined,
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: clockFormat === '12',
  }
  let time: string
  let day: string
  let parts: Intl.DateTimeFormatPart[]
  try {
    time = date.toLocaleTimeString('fr-FR', options)
    day = date.toLocaleDateString('fr-FR', {
      timeZone: timezone || undefined,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    parts = new Intl.DateTimeFormat('en-GB', {
      ...options,
      hour12: false,
      second: '2-digit',
    }).formatToParts(date)
  } catch {
    time = date.toLocaleTimeString('fr-FR')
    day = date.toLocaleDateString('fr-FR')
    parts = []
  }
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (
    <div
      className={`clock-content clock-${widget.settings.typography ?? 'sans'} clock-${widget.settings.clockSize ?? 'large'} clock-shadow-${widget.settings.shadow ?? 'none'}`}
      style={{
        textAlign: widget.settings.alignment ?? 'left',
        color: widget.settings.color,
        ...(widget.settings.color ? { '--ink': widget.settings.color } : {}),
      }}
    >
      {clockStyle === 'analog' ? (
        <div className="analog-clock" role="img" aria-label={time}>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
          <i
            className="hour-hand"
            style={{ transform: `rotate(${(value('hour') % 12) * 30 + value('minute') / 2}deg)` }}
          />
          <i className="minute-hand" style={{ transform: `rotate(${value('minute') * 6}deg)` }} />
          {showSeconds && (
            <i className="second-hand" style={{ transform: `rotate(${value('second') * 6}deg)` }} />
          )}
          <b />
        </div>
      ) : (
        <time className="clock-time">{time}</time>
      )}
      {showDate !== false && <p className="clock-date">{day}</p>}
      {timezone && <span className="tiny muted">{timezone.replaceAll('_', ' ')}</span>}
    </div>
  )
}
export function TimerWidget({
  state,
  onSettings,
  onToggle,
}: {
  state: AppState
  onSettings: () => void
  onToggle: () => void
}) {
  const now = useNow()
  const timer = state.timer
  const phase = timer.profile.phases[timer.phaseIndex]
  const value = timerValue(timer, now)
  const running = timer.status === 'running'
  const task = state.privateData.tasks.find(
    (t) => t.id === (timer.taskId ?? state.privateData.activeTaskId),
  )
  const ratio =
    timer.profile.mode === 'free' ? 1 : Math.max(0, Math.min(1, value / phase.durationMs))
  return (
    <div className="timer-content">
      <div className="timer-top">
        <span className="eyebrow">Minuterie</span>
        <button className="icon-button" aria-label="Régler la minuterie" onClick={onSettings}>
          <MoreHorizontal size={20} />
        </button>
      </div>
      <div className="timer-face">
        <svg className="timer-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle className="ring-track" cx="150" cy="150" r="137" />
          <circle
            className="ring-progress"
            cx="150"
            cy="150"
            r="137"
            pathLength="100"
            strokeDasharray={`${ratio * 100} 100`}
          />
        </svg>
        <div>
          <p className="timer-phase">
            {timer.status === 'completed' ? 'Session terminée' : phase.label}
          </p>
          <div className="timer-digits" role="timer" aria-label="Temps de session">
            {formatDuration(value)}
          </div>
          <p className="timer-state">
            {timer.status === 'paused'
              ? 'En pause'
              : timer.status === 'waiting'
                ? 'Phase suivante prête'
                : timer.status === 'completed'
                  ? 'Terminée'
                  : running
                    ? 'En cours'
                    : 'Prêt'}
          </p>
        </div>
      </div>
      <div className="timer-controls">
        <button
          className="icon-button"
          aria-label="Réinitialiser la session"
          disabled={timer.status === 'idle'}
          onClick={() => act(actions.timer('stop'))}
        >
          <RotateCcw size={17} />
        </button>
        <button className="primary" onClick={onToggle}>
          {running ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
          {running
            ? 'Pause'
            : timer.status === 'paused'
              ? 'Reprendre'
              : timer.status === 'waiting'
                ? 'Continuer'
                : 'Démarrer'}
        </button>
        <button
          className="icon-button"
          aria-label="Passer à la phase suivante"
          disabled={timer.status === 'idle' || timer.status === 'completed'}
          onClick={() => act(actions.timer('skip'))}
        >
          <SkipForward size={18} />
        </button>
      </div>
      <button className="timer-cycle text-button" onClick={onSettings}>
        {timer.profile.mode === 'free' ? (
          'Session libre'
        ) : (
          <>
            Cycle {timer.cycle + 1} / {timer.profile.repeats || '∞'}
            <span className="cycle-dots">
              {Array.from({ length: Math.min(timer.profile.repeats || 4, 6) }, (_, i) => (
                <i key={i} className={i <= timer.cycle ? 'filled' : ''} />
              ))}
            </span>
          </>
        )}
      </button>
      {task && (
        <p className="active-task">
          <span>TÂCHE ACTIVE</span> {task.title}
        </p>
      )}
      {timer.clockWarning && (
        <p role="status" className="tiny">
          L’heure système a changé. Reprends quand tu es prêt·e.
        </p>
      )}
    </div>
  )
}
export function TasksWidget({ state }: { state: AppState }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [renamed, setRenamed] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const data = state.privateData
  return (
    <div className="tasks-content">
      <h2>
        Tâches{' '}
        <span className="count">
          {data.tasks.filter((t) => t.done).length}/{data.tasks.length}
        </span>
      </h2>
      <form
        className="task-add"
        onSubmit={(e) => {
          e.preventDefault()
          const submitted = draft
          act(
            actions
              .addTask(submitted)
              .then(() => setDraft((current) => (current === submitted ? '' : current))),
          )
        }}
      >
        <input
          aria-label="Nouvelle tâche"
          placeholder="Ajouter une tâche"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
        />
        <button className="icon-button" aria-label="Ajouter la tâche" disabled={!draft.trim()}>
          <Plus size={19} />
        </button>
      </form>
      <ul className="task-list">
        {data.tasks
          .filter((t) => data.showCompleted || !t.done)
          .map((item) => (
            <li
              key={item.id}
              className={`${item.done ? 'task-done' : ''} ${item.id === data.activeTaskId ? 'task-active' : ''}`}
            >
              <div className="task-row">
                <button
                  className="icon-button task-check"
                  aria-label={item.done ? `Rouvrir ${item.title}` : `Terminer ${item.title}`}
                  onClick={() => act(actions.toggleTask(item.id))}
                >
                  {item.done ? <Check size={17} /> : <Circle size={18} />}
                </button>
                {editing === item.id ? (
                  <form
                    className="task-rename"
                    onSubmit={(e) => {
                      e.preventDefault()
                      act(actions.renameTask(item.id, renamed).then(() => setEditing(null)))
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="Renommer la tâche"
                      value={renamed}
                      maxLength={500}
                      onChange={(e) => setRenamed(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                    <button className="icon-button" aria-label="Enregistrer la tâche">
                      <Check size={16} />
                    </button>
                  </form>
                ) : (
                  <button
                    className="task-title"
                    aria-pressed={item.id === data.activeTaskId}
                    onClick={() =>
                      act(actions.selectTask(item.id === data.activeTaskId ? null : item.id))
                    }
                  >
                    {item.title}
                  </button>
                )}
                <button
                  className="icon-button task-more"
                  aria-label={`Options de ${item.title}`}
                  aria-expanded={expanded === item.id}
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
              {expanded === item.id && (
                <div className="task-actions">
                  <button
                    aria-label={`Renommer ${item.title}`}
                    onClick={() => {
                      setRenamed(item.title)
                      setEditing(item.id)
                      setExpanded(null)
                    }}
                  >
                    <Pencil size={14} /> Renommer
                  </button>
                  <button
                    aria-label={`Monter ${item.title}`}
                    disabled={data.tasks[0].id === item.id}
                    onClick={() => act(actions.moveTask(item.id, -1))}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label={`Descendre ${item.title}`}
                    disabled={data.tasks.at(-1)?.id === item.id}
                    onClick={() => act(actions.moveTask(item.id, 1))}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    aria-label={`Supprimer ${item.title}`}
                    onClick={() => act(actions.deleteTask(item.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
      </ul>
      {data.tasks.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 100 80" aria-hidden="true">
            <path d="M24 66C23 41 40 17 58 15C64 34 55 60 24 66Z" />
            <path d="M26 66L55 22M41 46L33 32M40 47L57 44M22 68H78" />
          </svg>
          <p>Aucune tâche.</p>
        </div>
      )}
      <label className="check-field task-completed">
        <input
          type="checkbox"
          checked={data.showCompleted}
          onChange={(e) => {
            const checked = e.currentTarget.checked
            act(
              actions.update((s) => {
                s.privateData.showCompleted = checked
              }),
            )
          }}
        />{' '}
        Voir les tâches terminées
      </label>
    </div>
  )
}
export function NotesWidget({ notes, dataEpoch }: { notes: string; dataEpoch?: string }) {
  const [controller] = useState(() => new NoteDraft(notes, notesEpoch(dataEpoch)))
  const draft = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [dismissed, setDismissed] = useState<typeof draft | null>(null)
  useEffect(() => {
    if (draft.status !== 'Enregistré ici') return
    const timeout = window.setTimeout(() => setDismissed(draft), 1_500)
    return () => window.clearTimeout(timeout)
  }, [draft])
  const save = () =>
    controller.flush().catch((error) => reportError(new Error(storageMessage(error))))
  useEffect(() => {
    controller.receive(notes, notesEpoch(dataEpoch))
  }, [controller, notes, dataEpoch])
  useEffect(() => {
    const unregister = registerNoteDraft(controller)
    return () => {
      void controller.flush().catch((error) => reportError(new Error(storageMessage(error))))
      unregister()
    }
  }, [controller])
  return (
    <div className="notes-content">
      <div className="widget-heading">
        <p className="eyebrow">Bloc-notes</p>
        <Pencil size={15} />
      </div>
      <textarea
        aria-label="Bloc-notes"
        placeholder="Écrire une note…"
        value={draft.text}
        maxLength={100_000}
        onChange={(event) => controller.edit(event.target.value)}
        onBlur={() => {
          void save()
        }}
      />
      <span className="tiny muted" role="status">
        {dismissed === draft ? '' : draft.status}
      </span>
      {draft.status.startsWith('Non') && (
        <button
          onClick={() => {
            void save()
          }}
        >
          Réessayer l’enregistrement
        </button>
      )}
    </div>
  )
}
