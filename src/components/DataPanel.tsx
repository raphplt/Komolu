import { useEffect, useRef, useState } from 'react'
import { Download, FolderInput, Share2, Trash2 } from 'lucide-react'
import { Dialog } from './shared'
import {
  applyImport,
  downloadPortable,
  exportBackup,
  exportSpace,
  readImport,
  resetLocalData,
  type PreparedImport,
} from '../core/portability'
import './data.css'
const size = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString('fr', { maximumFractionDigits: 1 })} Mo`
export function DataPanel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [preview, setPreview] = useState<PreparedImport | null>(null)
  const [filename, setFilename] = useState('')
  const [confirm, setConfirm] = useState<'replace' | 'reset' | null>(null)
  const [phrase, setPhrase] = useState('')
  const [usage, setUsage] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    void navigator.storage
      ?.estimate?.()
      .then((value) => setUsage(`Environ ${size(value.usage ?? 0)} utilisés dans ce navigateur.`))
      .catch(() => undefined)
  }, [])
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await fn()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'L’opération a échoué. Aucune donnée n’a été importée.',
      )
    } finally {
      setBusy(false)
    }
  }
  const finishImport = (mode: 'merge' | 'replace') => {
    if (preview)
      void run(async () => {
        await applyImport(preview, mode)
        setPreview(null)
        setConfirm(null)
        setSuccess('Import terminé. Tes données sont enregistrées ici.')
      })
  }
  const backup = preview?.file.format === 'komolu-backup' ? preview.file : null
  return (
    <Dialog
      title="Sauvegarde et données"
      onClose={() => {
        if (!busy) onClose()
      }}
      wide
    >
      <div className="data-panel">
        <p>
          Tes données restent dans ce navigateur, sans synchronisation. Un nettoyage du navigateur
          peut les effacer : télécharge régulièrement une sauvegarde et conserve-la en lieu sûr.
        </p>
        {usage && <p className="tiny muted">{usage}</p>}
        {error && (
          <p role="alert" className="data-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="data-success">
            {success}
          </p>
        )}
        {busy && <p role="status">Vérification et sauvegarde en cours…</p>}
        {preview ? (
          <section aria-label="Vérifier l’import" className="data-preview">
            <h3>Vérifier l’import</h3>
            <p className="data-filename">{filename}</p>
            <p>
              <strong>{backup ? 'Sauvegarde personnelle complète' : 'Espace partageable'}</strong>
            </p>
            <dl className="data-counts">
              <div>
                <dt>Espaces</dt>
                <dd>{backup ? backup.state.workspaces.length : 1}</dd>
              </div>
              <div>
                <dt>Tâches</dt>
                <dd>{backup?.state.privateData.tasks.length ?? 0}</dd>
              </div>
              <div>
                <dt>Pensées</dt>
                <dd>{backup?.state.privateData.thoughts.length ?? 0}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{backup?.state.privateData.notes.length ?? 0} caractères</dd>
              </div>
              <div>
                <dt>Médias</dt>
                <dd>
                  {backup?.media.length ?? 0} ·{' '}
                  {size(backup?.media.reduce((n, m) => n + m.size, 0) ?? 0)}
                </dd>
              </div>
            </dl>
            {backup ? (
              <>
                <p className="tiny">
                  Ajouter conserve tes données, ta session et tes réglages actuels. Les espaces,
                  tâches, pensées et médias importés deviennent de nouvelles copies. Les notes
                  importées sont ajoutées après tes notes actuelles.
                </p>
                <p className="tiny">
                  Remplacer efface les données actuelles. Une session importée en cours sera mise en
                  pause au temps de l’export. Aucun son ne démarre automatiquement.
                </p>
              </>
            ) : (
              <p>
                L’espace sera ajouté à ta collection. Il ne contient ni notes, ni tâches, ni
                pensées, ni médias locaux.
              </p>
            )}
            {confirm === 'replace' ? (
              <div className="data-confirm">
                <p>
                  <strong>Remplacer toutes tes données locales ?</strong> Les espaces, notes,
                  tâches, pensées, réglages et médias actuels seront supprimés. Exporte d’abord une
                  sauvegarde si tu souhaites les conserver.
                </p>
                <div className="row wrap">
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => finishImport('replace')}
                  >
                    Confirmer le remplacement
                  </button>
                  <button disabled={busy} onClick={() => setConfirm(null)}>
                    Garder mes données
                  </button>
                </div>
              </div>
            ) : (
              <div className="row wrap">
                <button className="primary" disabled={busy} onClick={() => finishImport('merge')}>
                  {backup ? 'Ajouter à mes données' : 'Ajouter cet espace'}
                </button>
                {backup && (
                  <button disabled={busy} onClick={() => setConfirm('replace')}>
                    Remplacer mes données
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => {
                    setPreview(null)
                    setError('')
                  }}
                >
                  Annuler l’import
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="data-action">
              <div>
                <h3>Tout emporter</h3>
                <p>
                  Une sauvegarde personnelle complète : espaces, notes, tâches, pensées, session,
                  réglages et médias. Ce fichier contient tes informations privées.
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    downloadPortable(await exportBackup())
                    setSuccess('Sauvegarde téléchargée. Conserve ce fichier en lieu sûr.')
                  })
                }
              >
                <Download size={17} />
                Exporter une sauvegarde
              </button>
            </section>
            <section className="data-action">
              <div>
                <h3>Partager une ambiance</h3>
                <p>
                  Exporte la configuration de l’espace actuel. Les notes, tâches, pensées et médias
                  locaux sont exclus. Son nom, sa description et les libellés de minuterie restent
                  visibles.
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    downloadPortable(await exportSpace())
                    setSuccess('Espace téléchargé, sans données personnelles ni médias locaux.')
                  })
                }
              >
                <Share2 size={17} />
                Partager cet espace
              </button>
            </section>
            <section className="data-action">
              <div>
                <h3>Retrouver ses affaires</h3>
                <p>
                  Choisis un fichier JSON Komolu. Tu verras son contenu avant de l’ajouter ou de
                  remplacer tes données. Maximum 220 Mo, dont 150 Mo de médias.
                </p>
              </div>
              <input
                ref={input}
                className="data-file"
                type="file"
                accept=".json,application/json"
                aria-label="Importer un fichier"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file)
                    void run(async () => {
                      setPreview(await readImport(file))
                      setFilename(file.name)
                    })
                }}
              />
              <button disabled={busy} onClick={() => input.current?.click()}>
                <FolderInput size={17} />
                Importer un fichier
              </button>
            </section>
            <section className="data-action data-reset">
              <div>
                <h3>Repartir à zéro</h3>
                <p>
                  Supprime toutes tes données locales et retrouve les trois ambiances de départ.
                </p>
              </div>
              {confirm === 'reset' ? (
                <div className="data-confirm">
                  <label className="field">
                    Pour confirmer, saisis EFFACER
                    <input
                      aria-label="Confirmation de suppression"
                      value={phrase}
                      onChange={(event) => setPhrase(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <div className="row wrap">
                    <button
                      className="danger"
                      disabled={busy || phrase !== 'EFFACER'}
                      onClick={() =>
                        void run(async () => {
                          await resetLocalData()
                          setConfirm(null)
                          setPhrase('')
                          setSuccess('Données locales effacées. Un nouvel espace t’attend.')
                        })
                      }
                    >
                      Tout effacer
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setConfirm(null)
                        setPhrase('')
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button className="danger" disabled={busy} onClick={() => setConfirm('reset')}>
                  <Trash2 size={17} />
                  Effacer les données locales
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </Dialog>
  )
}
