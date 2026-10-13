import type { AppState } from './model'

/** Shared admission bounds keep locally created data valid for export and import. */
export const MAX_WORKSPACES = 100
export const MAX_WIDGETS = 50
export const MAX_TRACKS = 50
export const MAX_TASKS = 10_000
export const MAX_THOUGHTS = 10_000
export const MAX_MEDIA_COUNT = 500
export const MAX_NAME_LENGTH = 200

export class StateLimitError extends Error { override name = 'StateLimitError' }

export function assertStateLimits(state: AppState): void {
  if (state.workspaces.length > MAX_WORKSPACES) throw new StateLimitError(`Tu peux conserver au maximum ${MAX_WORKSPACES} espaces. Supprime un espace avant d’en ajouter un autre.`)
  if (state.privateData.tasks.length > MAX_TASKS) throw new StateLimitError(`La liste est limitée à ${MAX_TASKS} tâches. Supprime quelques tâches avant de continuer.`)
  if (state.privateData.thoughts.length > MAX_THOUGHTS) throw new StateLimitError(`La boîte est limitée à ${MAX_THOUGHTS} pensées. Supprime quelques pensées avant de continuer.`)
  for (const workspace of state.workspaces) {
    if (workspace.widgets.length > MAX_WIDGETS) throw new StateLimitError(`Un espace peut contenir au maximum ${MAX_WIDGETS} widgets.`)
    if (workspace.audio.tracks.length > MAX_TRACKS) throw new StateLimitError(`Un mix peut contenir au maximum ${MAX_TRACKS} pistes.`)
    if (workspace.name.length > MAX_NAME_LENGTH) throw new StateLimitError(`Le nom d’un espace est limité à ${MAX_NAME_LENGTH} caractères.`)
  }
}
