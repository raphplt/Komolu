export const RADIO_STATIONS = [
  {
    id: 'chillhop',
    name: 'Chillhop',
    genre: 'Lofi · hip-hop',
    url: 'https://channels.fluxfm.de/chillhop/externalembedflxhp/stream.mp3',
    source: 'https://www.fluxfm.de/channels/chillhop',
  },
  {
    id: 'swiss-classic',
    name: 'Radio Swiss Classic',
    genre: 'Classique · orchestral',
    url: 'https://stream.srg-ssr.ch/srgssr/rsc_de/mp3/128',
    source: 'https://www.radioswissclassic.ch/de/empfang/internet',
  },
  {
    id: 'neofm',
    name: 'neoFM',
    genre: 'Néoclassique · piano',
    url: 'https://channels.fluxfm.de/neofm/externalembedflxhp/stream.mp3',
    source: 'https://www.fluxfm.de/channels/neofm',
  },
  {
    id: 'electronic-chillout',
    name: 'Electronic Chillout',
    genre: 'Chill · ambient',
    url: 'https://channels.fluxfm.de/electronic-chillout/externalembedflxhp/stream.mp3',
    source: 'https://www.fluxfm.de/flux-musik-streams',
  },
] as const
export type RadioStatus = 'stopped' | 'loading' | 'playing' | 'error'
export interface RadioSnapshot {
  stationId: string
  volume: number
  status: RadioStatus
  error: string | null
}
const KEY = 'komolu-radio-v1'
export class RadioPlayer {
  private element: HTMLAudioElement | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private revision = 0
  private listeners = new Set<() => void>()
  private snapshot: RadioSnapshot
  constructor(private createAudio: () => HTMLAudioElement = () => new Audio()) {
    let stationId: string = 'chillhop'
    let volume = 0.35
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (saved && RADIO_STATIONS.some((s) => s.id === saved.stationId)) stationId = saved.stationId
      if (saved && typeof saved.volume === 'number' && Number.isFinite(saved.volume))
        volume = Math.max(0, Math.min(1, saved.volume))
    } catch {
      /* Preferences are optional, never a reason to fail playback. */
    }
    this.snapshot = { stationId, volume, status: 'stopped', error: null }
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(patch: Partial<RadioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.forEach((listener) => listener())
  }
  private save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ stationId: this.snapshot.stationId, volume: this.snapshot.volume }),
      )
    } catch {
      /* Optional preferences. */
    }
  }
  private release() {
    this.revision++
    clearTimeout(this.timer)
    this.timer = undefined
    const element = this.element
    this.element = null
    if (element) {
      element.onplaying =
        element.onwaiting =
        element.onstalled =
        element.onerror =
        element.onended =
          null
      element.pause()
      element.removeAttribute('src')
      element.load()
    }
  }
  stop = () => {
    this.release()
    this.update({ status: 'stopped', error: null })
  }
  select = (id: string) => {
    if (!RADIO_STATIONS.some((station) => station.id === id) || id === this.snapshot.stationId)
      return
    this.stop()
    this.update({ stationId: id })
    this.save()
  }
  setVolume = (volume: number) => {
    if (!Number.isFinite(volume)) return
    volume = Math.max(0, Math.min(1, volume))
    if (this.element) this.element.volume = volume
    this.update({ volume })
    this.save()
  }
  play = () => {
    this.release()
    const revision = this.revision
    const element = this.createAudio()
    this.element = element
    const current = () => this.element === element && this.revision === revision
    const fail = (message: string) => {
      if (!current()) return
      this.release()
      this.update({ status: 'error', error: message })
    }
    const deadline = () => {
      if (this.timer !== undefined) return
      this.timer = setTimeout(
        () => fail('La station ne répond pas. Réessaie ou change de station.'),
        15000,
      )
    }
    element.preload = 'none'
    element.volume = this.snapshot.volume
    element.onplaying = () => {
      if (current()) {
        clearTimeout(this.timer)
        this.timer = undefined
        this.update({ status: 'playing', error: null })
      }
    }
    element.onwaiting = element.onstalled = () => {
      if (current()) {
        this.update({ status: 'loading' })
        deadline()
      }
    }
    element.onerror = () =>
      fail('Lecture indisponible. Vérifie ta connexion ou essaie une autre station.')
    element.onended = () => fail('Le flux a été interrompu.')
    element.src = RADIO_STATIONS.find((station) => station.id === this.snapshot.stationId)!.url
    this.update({ status: 'loading', error: null })
    deadline()
    try {
      void element.play().catch(() => fail('La lecture n’a pas démarré. Réessaie.'))
    } catch {
      fail('La lecture n’a pas démarré. Réessaie.')
    }
  }
  reset = () => {
    this.stop()
    this.update({ stationId: 'chillhop', volume: 0.35 })
    this.save()
  }
  dispose = () => {
    this.release()
    this.listeners.clear()
  }
}
