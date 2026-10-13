import { db, type KomoluDatabase } from './storage'

export const notesEpoch = (epoch?: string) => epoch ?? ''
/** Epoch comparison happens in the same transaction as the write, across all tabs. */
export async function persistNotes(
  text: string,
  epoch: string,
  database: KomoluDatabase = db,
): Promise<boolean> {
  return database.transaction('rw', database.state, async () => {
    const record = await database.state.get('app')
    if (!record || notesEpoch(record.data.dataEpoch) !== epoch) return false
    record.data.privateData.notes = text.slice(0, 100_000)
    record.data.updatedAt = Date.now()
    await database.state.put(record)
    return true
  })
}
interface NotesSnapshot {
  text: string
  status: string
}
type NotesWriter = (text: string, epoch: string) => Promise<boolean>
const drafts = new Set<NoteDraft>()
const pendingWrites = new Set<Promise<void>>()

/** A small draft controller keeps async persistence independent of React unmounts. */
export class NoteDraft {
  private snapshot: NotesSnapshot
  private listeners = new Set<() => void>()
  private persisted: string
  private dirty = false
  private revision = 0
  private timeout: ReturnType<typeof setTimeout> | undefined
  private inFlight: Promise<void> | null = null
  constructor(
    text: string,
    private epoch: string,
    private writer: NotesWriter = persistNotes,
  ) {
    this.persisted = text
    this.snapshot = { text, status: '' }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  private publish(text: string, status: string) {
    this.snapshot = { text, status }
    this.listeners.forEach((listener) => listener())
  }
  private clearTimer() {
    if (this.timeout !== undefined) clearTimeout(this.timeout)
    this.timeout = undefined
  }
  receive(text: string, epoch: string): void {
    if (epoch !== this.epoch) {
      this.cancel()
      this.epoch = epoch
      this.persisted = text
      this.publish(text, '')
    } else if (!this.dirty && text !== this.persisted) {
      this.persisted = text
      this.publish(text, '')
    }
  }
  edit(text: string): void {
    this.revision++
    this.dirty = true
    this.publish(text.slice(0, 100_000), 'Enregistrement…')
    this.clearTimer()
    this.timeout = setTimeout(() => {
      void this.flush().catch(() => {
        /* The snapshot exposes failure and an explicit retry. */
      })
    }, 450)
  }
  /** Cancellation disarms debounce and unmount saves; already queued writes still have the epoch guard. */
  cancel(): void {
    this.clearTimer()
    this.revision++
    this.dirty = false
  }
  async flush(): Promise<void> {
    this.clearTimer()
    if (this.inFlight) {
      await this.inFlight
      return this.flush()
    }
    if (!this.dirty) return
    const revision = this.revision,
      text = this.snapshot.text,
      epoch = this.epoch
    const write = this.writer(text, epoch)
      .then((accepted) => {
        if (revision !== this.revision) return
        this.dirty = false
        if (accepted) {
          this.persisted = text
          this.publish(text, 'Enregistré ici')
        } else
          this.publish(
            text,
            'Le carnet a changé dans un autre onglet. Ce brouillon n’a pas remplacé les nouvelles données.',
          )
      })
      .catch((error) => {
        if (revision === this.revision) this.publish(text, 'Non enregistré · réessaie ci-dessous')
        throw error
      })
    this.inFlight = write
    pendingWrites.add(write)
    try {
      await write
    } finally {
      pendingWrites.delete(write)
      if (this.inFlight === write) this.inFlight = null
    }
    // A user may have typed again while IndexedDB was saving the previous revision.
    if (this.dirty && revision !== this.revision) await this.flush()
  }
}
export function registerNoteDraft(draft: NoteDraft): () => void {
  drafts.add(draft)
  return () => {
    drafts.delete(draft)
  }
}
/** Awaited by exports/import merging. Includes writes initiated by a just-unmounted widget. */
export async function flushNotes(): Promise<void> {
  await Promise.all(Array.from(drafts, (draft) => draft.flush()))
  while (pendingWrites.size) await Promise.all(Array.from(pendingWrites))
}
/** Call only after a successful data replacement; failed transactions must retain the draft. */
export function cancelNoteDrafts(): void {
  drafts.forEach((draft) => draft.cancel())
}
