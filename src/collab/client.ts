import type { TimerProfile } from '../core/model'
import {
  ERROR_MESSAGES,
  PROTOCOL_NAME,
  ROOM_LIMITS,
  type ChatMessage,
  type ClientMessage,
  type EndReason,
  type PresenceStatus,
  type RoomView,
  type ServerMessage,
} from './protocol'

export type RoomPhase = 'idle' | 'connecting' | 'joined' | 'reconnecting'

export interface RoomSnapshot {
  phase: RoomPhase
  room: RoomView | null
  you: string | null
  messages: ChatMessage[]
  /** Estimated `serverClock - localClock`, used to display shared deadlines. */
  offset: number
  unread: number
  error: string | null
  ended: EndReason | null
}

type Intent =
  | Extract<ClientMessage, { type: 'create' }>
  | Extract<ClientMessage, { type: 'join' }>
  | Extract<ClientMessage, { type: 'resume' }>

export interface SavedSession {
  roomId: string
  memberToken: string
}

type SocketLike = Pick<WebSocket, 'readyState' | 'send' | 'close'> & {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
}

export interface RoomClientOptions {
  createSocket?: (url: string, protocol: string) => SocketLike
  /** Per-tab storage: a reload resumes the same seat, another tab is another member. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  now?: () => number
  pingMs?: number
}

const SESSION_KEY = 'komolu.room.session'
const RECONNECT_STEPS = [1_000, 2_000, 4_000, 8_000, 15_000]

const END_MESSAGES: Record<EndReason, string | null> = {
  left: null,
  kicked: 'L’hôte t’a retiré·e de la salle.',
  closed: 'La salle a été fermée par le service.',
  replaced: 'Cette salle est maintenant ouverte dans un autre onglet.',
}

const EMPTY: RoomSnapshot = {
  phase: 'idle',
  room: null,
  you: null,
  messages: [],
  offset: 0,
  unread: 0,
  error: null,
  ended: null,
}

/** Framework-free room connection, exposed to React through `useSyncExternalStore`. */
export class RoomClient {
  private snapshot: RoomSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  private socket: SocketLike | null = null
  private intent: Intent | null = null
  private attempt = 0
  private retry: ReturnType<typeof setTimeout> | null = null
  private ping: ReturnType<typeof setInterval> | null = null
  private bestRtt = Infinity
  private url: string
  private readonly createSocket: (url: string, protocol: string) => SocketLike
  private readonly storage: RoomClientOptions['storage']
  private readonly now: () => number
  private readonly pingMs: number

  constructor(url: string, options: RoomClientOptions = {}) {
    this.url = url
    this.createSocket =
      options.createSocket ?? ((target, protocol) => new WebSocket(target, protocol))
    this.storage = options.storage === undefined ? safeSessionStorage() : options.storage
    this.now = options.now ?? Date.now
    this.pingMs = options.pingMs ?? 20_000
  }

  setUrl(url: string) {
    this.url = url
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getSnapshot = () => this.snapshot

  savedSession(): SavedSession | null {
    try {
      const value = JSON.parse(this.storage?.getItem(SESSION_KEY) ?? 'null') as unknown
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as SavedSession).roomId === 'string' &&
        typeof (value as SavedSession).memberToken === 'string'
      )
        return value as SavedSession
    } catch {
      // Ignore unreadable storage: the user simply joins again.
    }
    return null
  }

  /** Reconnect after a reload; returns false when there is nothing to resume. */
  resumeSaved(): boolean {
    const saved = this.savedSession()
    if (!saved || this.intent) return false
    this.start({ type: 'resume', ...saved })
    return true
  }

  create(name: string, inviteTtlMs: number, profile: TimerProfile, status: PresenceStatus) {
    this.start({ type: 'create', name, inviteTtlMs, profile, status })
  }

  join(roomId: string, invite: string, name: string, status: PresenceStatus) {
    this.start({ type: 'join', roomId, invite, name, status })
  }

  /** Room actions are dropped while disconnected; the server state stays authoritative. */
  send(message: Exclude<ClientMessage, Intent | { type: 'leave' } | { type: 'ping' }>): boolean {
    if (this.snapshot.phase !== 'joined') return false
    return this.transmit(message)
  }

  leave() {
    this.transmit({ type: 'leave' })
    this.finish('left')
  }

  markRead() {
    if (this.snapshot.unread) this.update({ unread: 0 })
  }

  clearError() {
    if (this.snapshot.error || this.snapshot.ended) this.update({ error: null, ended: null })
  }

  dispose() {
    this.teardown()
    this.listeners.clear()
  }

  private start(intent: Intent) {
    this.teardown()
    this.intent = intent
    this.attempt = 0
    this.bestRtt = Infinity
    this.update({ ...EMPTY, phase: 'connecting' })
    this.open()
  }

  private open() {
    let socket: SocketLike
    try {
      socket = this.createSocket(this.url, PROTOCOL_NAME)
    } catch {
      this.fail('Impossible de joindre le service de salles.')
      return
    }
    this.socket = socket
    socket.onopen = () => {
      if (this.socket === socket && this.intent) this.transmit(this.intent)
    }
    socket.onmessage = (event) => {
      if (this.socket !== socket || typeof event.data !== 'string') return
      let message: ServerMessage
      try {
        message = JSON.parse(event.data) as ServerMessage
      } catch {
        return
      }
      this.receive(message)
    }
    socket.onerror = () => undefined
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.socket = null
      this.stopPing()
      this.scheduleReconnect()
    }
  }

  private receive(message: ServerMessage) {
    switch (message.type) {
      case 'welcome': {
        this.storage?.setItem(
          SESSION_KEY,
          JSON.stringify({ roomId: message.room.id, memberToken: message.memberToken }),
        )
        this.intent = { type: 'resume', roomId: message.room.id, memberToken: message.memberToken }
        this.attempt = 0
        const previous = this.snapshot
        const reconnecting =
          previous.phase === 'reconnecting' && previous.room?.id === message.room.id
        this.update({
          phase: 'joined',
          room: message.room,
          you: message.you,
          messages: message.history.slice(-ROOM_LIMITS.chatHistory),
          offset: reconnecting ? previous.offset : message.serverNow - this.now(),
          unread: reconnecting ? previous.unread : 0,
          error: null,
          ended: null,
        })
        this.startPing()
        return
      }
      case 'room':
        this.update({ room: message.room })
        return
      case 'chat': {
        const messages = [...this.snapshot.messages, message.message].slice(
          -ROOM_LIMITS.chatHistory,
        )
        const own = message.message.memberId === this.snapshot.you
        this.update({ messages, unread: own ? this.snapshot.unread : this.snapshot.unread + 1 })
        return
      }
      case 'pong': {
        const now = this.now()
        const rtt = Math.max(0, now - message.t)
        // Keep the estimate from the fastest exchange: it has the least asymmetry error.
        if (rtt <= this.bestRtt) {
          this.bestRtt = rtt
          this.update({ offset: Math.round(message.serverNow + rtt / 2 - now) })
        }
        return
      }
      case 'error':
        if (message.fatal) {
          if (this.intent?.type === 'resume') this.storage?.removeItem(SESSION_KEY)
          this.fail(ERROR_MESSAGES[message.code] ?? message.message)
        } else this.update({ error: ERROR_MESSAGES[message.code] ?? message.message })
        return
      case 'ended':
        this.finish(message.reason)
        return
    }
  }

  private transmit(message: ClientMessage): boolean {
    const socket = this.socket
    if (!socket || socket.readyState !== 1) return false
    socket.send(JSON.stringify(message))
    return true
  }

  private startPing() {
    this.stopPing()
    const tick = () => this.transmit({ type: 'ping', t: this.now() })
    tick()
    this.ping = setInterval(tick, this.pingMs)
  }

  private stopPing() {
    if (this.ping) clearInterval(this.ping)
    this.ping = null
  }

  private scheduleReconnect() {
    const intent = this.intent
    // Only an established seat is worth retrying; a failed first join is reported.
    if (!intent || intent.type !== 'resume') {
      this.fail('Connexion au service de salles impossible.')
      return
    }
    if (this.attempt >= RECONNECT_STEPS.length * 3) {
      this.fail('Connexion perdue avec la salle.')
      return
    }
    const delay = RECONNECT_STEPS[Math.min(this.attempt, RECONNECT_STEPS.length - 1)]
    this.attempt += 1
    this.update({ phase: 'reconnecting' })
    this.retry = setTimeout(() => {
      this.retry = null
      if (this.intent === intent) this.open()
    }, delay)
  }

  private finish(reason: EndReason) {
    this.storage?.removeItem(SESSION_KEY)
    this.teardown()
    this.update({ ...EMPTY, ended: reason, error: END_MESSAGES[reason] })
  }

  private fail(error: string) {
    this.teardown()
    this.update({ ...EMPTY, error })
  }

  private teardown() {
    this.intent = null
    this.stopPing()
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
    const socket = this.socket
    this.socket = null
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null
      try {
        socket.close(1000, 'bye')
      } catch {
        // Already closed.
      }
    }
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}
