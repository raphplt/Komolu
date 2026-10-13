import type { AppState, Workspace } from './model'
import { NATIVE_SOUNDS } from './presets'
import { MAX_TRACKS } from './limits'
import { validatePortable, validateState, type PortableFile } from './schema'
import {
  validatePortable as validateLegacyPortable,
  validateState as validateLegacyState,
  type LegacyState,
  type LegacyWorkspace,
} from './schema-v1'

/** Preserve existing mixes exactly; complete their library without enabling new sounds. */
function migrateWorkspace(workspace: LegacyWorkspace, focusMode = false): Workspace {
  const previous = structuredClone(workspace)
  const tracks = previous.audio.tracks
  for (const sound of NATIVE_SOUNDS) {
    if (tracks.length >= MAX_TRACKS) break
    if (tracks.some((track) => track.source === sound.source)) continue
    let id = sound.source as string
    let suffix = 0
    while (tracks.some((track) => track.id === id)) id = `native-${sound.source}-${++suffix}`
    tracks.push({ ...sound, id, enabled: false })
  }
  return {
    ...previous,
    version: 2,
    // Generated copy was not an editable preference in the original app.
    description: [
      'De l’espace pour tes idées.',
      'Un refuge, juste pour toi.',
      'Le calme des heures bleues.',
    ].includes(previous.description)
      ? ''
      : previous.description,
    palette: previous.background.scene,
    focusMode,
    background: {
      ...previous.background,
      solidColor: previous.background.scene === 'deep' ? '#18242c' : '#e9ede4',
      gradient: { from: '#ebe7dd', to: '#b9cbbf', angle: 135 },
      tintOpacity: 0.09,
    },
  }
}

function migrateLegacyState(previous: LegacyState): AppState {
  const state = structuredClone(previous)
  const { focusMode, ...preferences } = state.preferences
  return {
    ...state,
    schemaVersion: 2,
    preferences,
    workspaces: state.workspaces.map((workspace) =>
      migrateWorkspace(workspace, workspace.id === state.activeWorkspaceId && focusMode),
    ),
  }
}

/** Validate before migration. Unknown future schemas must never be silently rewritten. */
export function migrateState(value: unknown): AppState {
  if (value && typeof value === 'object' && 'schemaVersion' in value && value.schemaVersion === 1) {
    validateLegacyState(value)
    const migrated = migrateLegacyState(value)
    validateState(migrated)
    return migrated
  }
  validateState(value)
  return structuredClone(value)
}

export function migratePortable(value: unknown): PortableFile {
  if (value && typeof value === 'object' && 'version' in value && value.version === 1) {
    validateLegacyPortable(value)
    const migrated: PortableFile =
      value.format === 'komolu-backup'
        ? { ...value, version: 2, state: migrateLegacyState(value.state) }
        : { ...value, version: 2, workspace: migrateWorkspace(value.workspace) }
    validatePortable(migrated)
    return migrated
  }
  validatePortable(value)
  return value
}
