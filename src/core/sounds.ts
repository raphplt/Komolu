import type { SoundId } from './model'

export const RECORDING_SAMPLE_RATE = 32_000
export const RECORDING_FRAMES = 640_000
export interface SoundDefinition {
  id: SoundId
  name: string
  kind: 'noise' | 'recording'
  volume: number
}
/** Stable IDs survive portable spaces and migrations. Recordings are shipped with the app. */
export const SOUND_CATALOG: readonly SoundDefinition[] = [
  { id: 'brown', name: 'Bruit brun', kind: 'noise', volume: 0.35 },
  { id: 'white', name: 'Bruit blanc', kind: 'noise', volume: 0.2 },
  { id: 'rain', name: 'Pluie', kind: 'recording', volume: 0.45 },
  { id: 'thunder', name: 'Tonnerre', kind: 'recording', volume: 0.25 },
  { id: 'wind', name: 'Vent', kind: 'recording', volume: 0.35 },
  { id: 'fire', name: 'Feu', kind: 'recording', volume: 0.4 },
  { id: 'forest', name: 'Forêt', kind: 'recording', volume: 0.35 },
  { id: 'cafe', name: 'Café', kind: 'recording', volume: 0.25 },
  { id: 'waves', name: 'Vagues', kind: 'recording', volume: 0.4 },
]
export const SOUND_NAMES = Object.fromEntries(
  SOUND_CATALOG.map(({ id, name }) => [id, name]),
) as Record<SoundId, string>
export const recordingUrl = (id: SoundId) => `${import.meta.env.BASE_URL}audio/${id}.flac`
