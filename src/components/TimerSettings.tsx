import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { TimerProfile } from '../core/model'
import { TIMER_PROFILES, validateProfile } from '../core/timer'
import { uid } from '../core/presets'
import { actions } from '../core/store'
import { Dialog } from './shared'
import { act } from '../core/ui'
export function TimerSettings({
  profile,
  onClose,
}: {
  profile: TimerProfile
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => structuredClone(profile))
  const valid = validateProfile(draft)
  return (
    <Dialog title="Ton rythme" onClose={onClose}>
      <p className="muted">
        Les changements s’appliquent à la prochaine session. La session en cours garde son rythme.
      </p>
      <div className="profile-options">
        {TIMER_PROFILES.map((p) => (
          <button
            key={p.id}
            aria-pressed={draft.id === p.id}
            onClick={() => setDraft(structuredClone(p))}
          >
            {p.mode === 'free' ? 'Libre' : p.id === 'deep' ? '50 / 10' : '25 / 5'}
          </button>
        ))}
      </div>
      <label className="field">
        Nom du rythme
        <input
          value={draft.name}
          maxLength={100}
          onChange={(e) => setDraft({ ...draft, name: e.target.value, id: 'custom' })}
        />
      </label>
      <label className="field">
        Mode
        <select
          value={draft.mode}
          onChange={(e) =>
            setDraft({
              ...draft,
              mode: e.target.value as TimerProfile['mode'],
              phases: [
                {
                  id: uid(),
                  label: 'Concentration',
                  kind: 'work',
                  durationMs: e.target.value === 'free' ? 0 : 25 * 60_000,
                },
              ],
            })
          }
        >
          <option value="sequence">Séquence</option>
          <option value="free">Session libre</option>
        </select>
      </label>
      {draft.mode === 'sequence' && (
        <>
          <div className="phase-list">
            {draft.phases.map((phase, i) => (
              <div className="phase" key={phase.id}>
                <input
                  aria-label={`Nom de la phase ${i + 1}`}
                  value={phase.label}
                  maxLength={100}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      id: 'custom',
                      phases: draft.phases.map((p, j) =>
                        j === i ? { ...p, label: e.target.value } : p,
                      ),
                    })
                  }
                />
                <select
                  aria-label={`Type de la phase ${i + 1}`}
                  value={phase.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      id: 'custom',
                      phases: draft.phases.map((p, j) =>
                        j === i ? { ...p, kind: e.target.value as 'work' | 'break' } : p,
                      ),
                    })
                  }
                >
                  <option value="work">Travail</option>
                  <option value="break">Pause</option>
                </select>
                <label>
                  <input
                    aria-label={`Minutes de la phase ${i + 1}`}
                    type="number"
                    min="0.05"
                    max="1440"
                    step="0.05"
                    value={phase.durationMs / 60_000}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        id: 'custom',
                        phases: draft.phases.map((p, j) =>
                          j === i ? { ...p, durationMs: Number(e.target.value) * 60_000 } : p,
                        ),
                      })
                    }
                  />{' '}
                  min
                </label>
                <button
                  className="icon-button"
                  aria-label={`Supprimer la phase ${i + 1}`}
                  disabled={draft.phases.length === 1}
                  onClick={() =>
                    setDraft({ ...draft, phases: draft.phases.filter((_, j) => i !== j) })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-button"
            disabled={draft.phases.length >= 20}
            onClick={() =>
              setDraft({
                ...draft,
                id: 'custom',
                phases: [
                  ...draft.phases,
                  { id: uid(), label: 'Respirer', kind: 'break', durationMs: 5 * 60_000 },
                ],
              })
            }
          >
            <Plus size={16} /> Ajouter une phase
          </button>
          <label className="field">
            Répétitions · 0 = à l’infini
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={draft.repeats}
              onChange={(e) => setDraft({ ...draft, repeats: Number(e.target.value) })}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={draft.autoAdvance}
              onChange={(e) => setDraft({ ...draft, autoAdvance: e.target.checked })}
            />{' '}
            Enchaîner les phases automatiquement
          </label>
        </>
      )}
      <label className="check-field">
        <input
          type="checkbox"
          checked={draft.sound}
          onChange={(e) => setDraft({ ...draft, sound: e.target.checked })}
        />{' '}
        Son doux en fin de phase
      </label>
      {!valid && (
        <p role="alert">
          Vérifie les durées (de 3 secondes à 24 heures) et les répétitions (0 à 100).
        </p>
      )}
      <button
        className="primary full"
        disabled={!valid}
        onClick={() => act(actions.timerProfile(draft).then(onClose))}
      >
        Enregistrer ce rythme
      </button>
    </Dialog>
  )
}
