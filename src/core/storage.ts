import Dexie, { type EntityTable } from 'dexie'
import type { AppState, MediaRecord, StateRecord } from './model'
import { createInitialState } from './presets'
import { assertStateLimits } from './limits'
import { migrateState } from './migrations'

export class KomoluDatabase extends Dexie {
  state!: EntityTable<StateRecord, 'id'>
  media!: EntityTable<MediaRecord, 'id'>
  constructor(name = 'komolu') {
    super(name)
    this.version(1).stores({ state: 'id', media: 'id, kind, createdAt' })
    this.version(2)
      .stores({ state: 'id', media: 'id, kind, createdAt' })
      .upgrade(async (transaction) => {
        const state = transaction.table('state')
        const record = (await state.get('app')) as { id: 'app'; data: unknown } | undefined
        if (record) await state.put({ id: 'app', data: migrateState(record.data) })
      })
  }
}
export const db = new KomoluDatabase()
export async function initializeDatabase(database = db): Promise<void> {
  await database.transaction('rw', database.state, async () => {
    if (!(await database.state.get('app')))
      await database.state.put({ id: 'app', data: createInitialState() })
  })
}
/** All state writes serialize across tabs. Never await external work in this transaction. */
export async function mutateState(mutate: (state: AppState) => void, database = db): Promise<void> {
  await database.transaction('rw', database.state, async () => {
    const record = await database.state.get('app')
    const state = record?.data ?? createInitialState()
    mutate(state)
    assertStateLimits(state)
    state.updatedAt = Date.now()
    await database.state.put({ id: 'app', data: state })
  })
}
export const storageMessage = (error: unknown) =>
  error instanceof Error && /quota/i.test(`${error.name} ${error.message}`)
    ? 'Le stockage est plein. Exporte tes données et supprime un média volumineux.'
    : 'La sauvegarde locale est indisponible. Vérifie les autorisations de stockage du navigateur.'
