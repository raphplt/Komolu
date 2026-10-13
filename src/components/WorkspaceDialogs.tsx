import { useState } from 'react'
import { Check, Copy, Plus, Trash2, ArrowRight, Sprout, Moon, Coffee } from 'lucide-react'
import type { AppState, Scene } from '../core/model'
import { actions, activeWorkspace } from '../core/store'
import { Dialog } from './shared'
import { act } from '../core/ui'
export function WorkspaceDialog({ state, onClose }: { state: AppState; onClose: () => void }) {
  const workspace = activeWorkspace(state)
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [confirm, setConfirm] = useState<'delete' | 'restore' | null>(null)
  return (
    <Dialog title="Espaces" onClose={onClose}>
      <p className="muted">Les tâches, notes et pensées sont communes à tous les espaces.</p>
      <div className="workspace-list">
        {state.workspaces.map((w) => (
          <button
            key={w.id}
            className={`workspace-choice scene-thumb-${w.background.scene}`}
            aria-pressed={w.id === workspace.id}
            onClick={() => act(actions.switchWorkspace(w.id).then(onClose))}
          >
            <span>
              {w.background.scene === 'minimal' ? (
                <Sprout />
              ) : w.background.scene === 'cozy' ? (
                <Coffee />
              ) : (
                <Moon />
              )}
            </span>
            <strong>{w.name}</strong>
            {w.description && <small>{w.description}</small>}
            {w.id === workspace.id && <Check size={17} />}
          </button>
        ))}
      </div>
      <h3>Créer un espace</h3>
      <div className="profile-options">
        {(['minimal', 'cozy', 'deep'] as Scene[]).map((scene) => (
          <button
            key={scene}
            aria-label={`Créer un espace ${scene === 'minimal' ? 'Minimal' : scene === 'cozy' ? 'Cozy' : 'Deep Work'}`}
            onClick={() => act(actions.createWorkspace(scene).then(onClose))}
          >
            <Plus size={15} />
            {scene === 'minimal' ? 'Minimal' : scene === 'cozy' ? 'Cozy' : 'Deep Work'}
          </button>
        ))}
      </div>
      <hr />
      <h3>Gérer « {workspace.name} »</h3>
      <form
        className="workspace-details"
        onSubmit={(e) => {
          e.preventDefault()
          act(
            actions
              .workspace((w) => {
                w.name = name.trim().slice(0, 80)
                w.description = description.trim()
              })
              .then(onClose),
          )
        }}
      >
        <label className="field">
          Nom
          <input
            aria-label="Nom de l’espace"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          Description (facultative)
          <textarea
            aria-label="Description de l’espace"
            value={description}
            maxLength={2000}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button disabled={!name.trim()}>Enregistrer l’espace</button>
      </form>
      <div className="row wrap">
        <button onClick={() => act(actions.duplicateWorkspace().then(onClose))}>
          <Copy size={16} /> Dupliquer
        </button>
        <button onClick={() => setConfirm('restore')}>Restaurer le modèle</button>
        <button
          className="danger-text"
          disabled={state.workspaces.length === 1}
          onClick={() => setConfirm('delete')}
        >
          <Trash2 size={16} /> Supprimer
        </button>
      </div>
      {confirm && (
        <div className="confirmation" role="alert">
          <p>
            {confirm === 'delete'
              ? `Supprimer l’espace « ${workspace.name} » ?`
              : 'Restaurer le décor, les widgets et les réglages du modèle ?'}{' '}
            Tes tâches, notes et pensées seront conservées.
          </p>
          <div className="row">
            <button onClick={() => setConfirm(null)}>Annuler</button>
            <button
              className="primary"
              onClick={() =>
                act(
                  (confirm === 'delete'
                    ? actions.deleteWorkspace(workspace.id)
                    : actions.restoreWorkspace()
                  ).then(onClose),
                )
              }
            >
              Confirmer {confirm === 'delete' ? 'la suppression' : 'la restauration'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
export function ThoughtDialog({ state, onClose }: { state: AppState; onClose: () => void }) {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  return (
    <Dialog title="Pensées" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          act(actions.addThought(text).then(onClose))
        }}
      >
        <textarea
          autoFocus
          className="thought-input"
          aria-label="Nouvelle pensée"
          placeholder="Ne pas oublier…"
          maxLength={5_000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="primary full" disabled={!text.trim()}>
          Enregistrer et fermer <ArrowRight size={16} />
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <h3>
        Pensées enregistrées <span className="count">{state.privateData.thoughts.length}</span>
      </h3>
      {state.privateData.thoughts.length === 0 && (
        <p className="muted">Aucune pensée enregistrée.</p>
      )}
      <ul className="thought-list">
        {state.privateData.thoughts.map((thought) => (
          <li key={thought.id}>
            <p>{thought.text}</p>
            <time>
              {new Date(thought.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })}
            </time>
            <div className="row">
              <button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(thought.text)
                    .then(() => setCopied(thought.id))
                    .catch(() =>
                      setError('Copie indisponible. Tu peux sélectionner le texte et le copier.'),
                    )
                }}
              >
                <Copy size={14} />
                {copied === thought.id ? 'Copié' : 'Copier'}
              </button>
              <button onClick={() => act(actions.thoughtToTask(thought.id))}>
                <Plus size={14} /> En tâche
              </button>
              <button
                className="icon-button"
                aria-label={`Supprimer la pensée ${thought.text.slice(0, 30)}`}
                onClick={() => act(actions.deleteThought(thought.id))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
export function PreferencesDialog({
  state,
  onClose,
  onData,
}: {
  state: AppState
  onClose: () => void
  onData: () => void
}) {
  return (
    <Dialog title="Préférences" onClose={onClose}>
      <label className="check-field">
        <input
          type="checkbox"
          checked={state.preferences.reducedMotion}
          onChange={(e) => {
            const checked = e.currentTarget.checked
            act(
              actions.update((s) => {
                s.preferences.reducedMotion = checked
              }),
            )
          }}
        />{' '}
        Réduire les mouvements
      </label>
      <p className="tiny muted">La préférence de ton système est toujours respectée.</p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={state.preferences.shortcuts !== false}
          onChange={(e) => {
            const checked = e.currentTarget.checked
            act(
              actions.update((s) => {
                s.preferences.shortcuts = checked
              }),
            )
          }}
        />{' '}
        Activer les raccourcis clavier
      </label>
      <dl className="shortcuts">
        <div>
          <dt>
            <kbd>Espace</kbd>
          </dt>
          <dd>Démarrer ou suspendre la session</dd>
        </div>
        <div>
          <dt>
            <kbd>N</kbd>
          </dt>
          <dd>Capturer une pensée</dd>
        </div>
        <div>
          <dt>
            <kbd>F</kbd>
          </dt>
          <dd>Entrer ou sortir du mode Focus</dd>
        </div>
        <div>
          <dt>
            <kbd>Échap</kbd>
          </dt>
          <dd>Fermer un panneau</dd>
        </div>
      </dl>
      <p className="tiny muted">
        Les raccourcis restent inactifs quand tu écris ou qu’une boîte de dialogue est ouverte.
      </p>
      <hr />
      <button onClick={onData}>
        Sauvegarde et données <ArrowRight size={16} />
      </button>
      <p className="privacy-note">
        Ton espace reste dans ce navigateur. Aucun compte, aucune mesure d’audience, aucun envoi de
        tes notes. Pense à exporter une sauvegarde.
      </p>
    </Dialog>
  )
}
