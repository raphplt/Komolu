import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { TimerState } from '../src/core/model.ts'
import { createTimer, reconcileTimer, transitionTimer } from '../src/core/timer.ts'
import {
  ERROR_MESSAGES,
  ROOM_LIMITS,
  parseClientMessage,
  shownStatus,
  type ChatMessage,
  type ClientMessage,
  type EndReason,
  type ErrorCode,
  type PresenceStatus,
  type RoomSettings,
  type RoomView,
  type ServerMessage,
} from '../src/collab/protocol.ts'
import { TokenBucket, WindowCounter } from './rate-limit.ts'

/** Transport-agnostic connection, implemented by the WebSocket layer and by tests. */
export interface Connection {
  readonly address: string
  send(message: ServerMessage): void
  close(code: number, reason: string): void
}

export interface RoomManagerOptions {
  maxRooms: number
  maxMembers: number
  /** How long a disconnected member keeps their seat (and host role) for a reconnect. */
  reconnectGraceMs: number
  roomsPerAddressPerHour: number
  /** Repeated invalid or excessive messages beyond this count close the socket. */
  maxViolations: number
}

export const DEFAULT_ROOM_OPTIONS: RoomManagerOptions = {
  maxRooms: 500,
  maxMembers: ROOM_LIMITS.members,
  reconnectGraceMs: 2 * 60_000,
  roomsPerAddressPerHour: 10,
  maxViolations: 20,
}

interface Member {
  id: string
  token: string
  name: string
  status: PresenceStatus
  joinedAt: number
  connection: Connection | null
  disconnectedAt: number | null
}
interface Room {
  id: string
  createdAt: number
  members: Map<string, Member>
  hostId: string
  timer: TimerState
  settings: RoomSettings
  invite: { code: string; expiresAt: number }
  history: ChatMessage[]
}
interface Session {
  roomId: string | null
  memberId: string | null
  general: TokenBucket
  chat: TokenBucket
  violations: number
}

export function randomId(bytes: number): string {
  return randomBytes(bytes).toString('base64url')
}
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Authoritative, in-memory state of every room. No message, pseudonym or
 * address is ever written to disk or logs; a restart deletes all rooms.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>()
  private readonly sessions = new Map<Connection, Session>()
  private readonly creations: WindowCounter
  private readonly options: RoomManagerOptions
  private readonly clock: () => number

  constructor(options: Partial<RoomManagerOptions> = {}, clock: () => number = Date.now) {
    this.options = { ...DEFAULT_ROOM_OPTIONS, ...options }
    this.clock = clock
    this.creations = new WindowCounter(this.options.roomsPerAddressPerHour, 60 * 60_000)
  }

  stats() {
    let members = 0
    for (const room of this.rooms.values()) members += room.members.size
    return { rooms: this.rooms.size, members, connections: this.sessions.size }
  }

  connect(connection: Connection): void {
    const now = this.clock()
    this.sessions.set(connection, {
      roomId: null,
      memberId: null,
      general: new TokenBucket(30, 200, now),
      chat: new TokenBucket(8, 2_000, now),
      violations: 0,
    })
  }

  disconnect(connection: Connection): void {
    const session = this.sessions.get(connection)
    this.sessions.delete(connection)
    if (!session) return
    const located = this.locate(session)
    if (!located || located.member.connection !== connection) return
    located.member.connection = null
    located.member.disconnectedAt = this.clock()
    this.broadcast(located.room)
  }

  receive(connection: Connection, raw: string): void {
    const session = this.sessions.get(connection)
    if (!session) return
    const now = this.clock()
    if (!session.general.take(now)) return this.violation(connection, session, 'rate_limited')
    const message = parseClientMessage(raw)
    if (!message) return this.violation(connection, session, 'invalid')
    this.handle(connection, session, message, now)
  }

  /** Called periodically: advances shared timers and removes stale members and rooms. */
  tick(): void {
    const now = this.clock()
    for (const room of [...this.rooms.values()]) {
      let changed = false
      const timer = reconcileTimer(room.timer, now)
      if (timer !== room.timer) {
        room.timer = timer
        changed = true
      }
      for (const member of [...room.members.values()])
        if (
          member.connection === null &&
          member.disconnectedAt !== null &&
          now - member.disconnectedAt >= this.options.reconnectGraceMs
        ) {
          this.removeMember(room, member.id)
          changed = true
        }
      if (!this.rooms.has(room.id)) continue
      if (changed) this.broadcast(room)
    }
    this.creations.sweep(now)
  }

  /** Graceful shutdown: tell everyone the room is gone instead of silently dropping it. */
  closeAll(): void {
    for (const room of this.rooms.values())
      for (const member of room.members.values()) this.end(member, 'closed')
    this.rooms.clear()
  }

  private handle(
    connection: Connection,
    session: Session,
    message: ClientMessage,
    now: number,
  ): void {
    if (message.type === 'ping')
      return connection.send({ type: 'pong', t: message.t, serverNow: now })
    if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
      if (session.roomId) return this.error(connection, 'invalid', false)
      if (message.type === 'create') return this.create(connection, session, message, now)
      if (message.type === 'join') return this.join(connection, session, message, now)
      return this.resume(connection, session, message)
    }
    const located = this.locate(session)
    if (!located || located.member.connection !== connection)
      return this.error(connection, 'state', true)
    const { room, member } = located
    const host = room.hostId === member.id
    switch (message.type) {
      case 'presence':
        if (message.status) member.status = message.status
        if (message.name) member.name = message.name
        return this.broadcast(room)
      case 'timer':
        if (!host && room.settings.timerControl !== 'everyone')
          return this.error(connection, 'forbidden', false)
        room.timer =
          message.action === 'stop'
            ? { ...createTimer(room.timer.profile, now), revision: room.timer.revision + 1 }
            : // Private tasks are never shared: the room timer has no task.
              { ...transitionTimer(room.timer, message.action, now, null), taskId: null }
        return this.broadcast(room)
      case 'timerProfile':
        if (!host) return this.error(connection, 'forbidden', false)
        room.timer = { ...createTimer(message.profile, now), revision: room.timer.revision + 1 }
        return this.broadcast(room)
      case 'chat': {
        if (!session.chat.take(now)) return this.violation(connection, session, 'rate_limited')
        const chat: ChatMessage = {
          id: randomId(9),
          memberId: member.id,
          name: member.name,
          text: message.text,
          at: now,
        }
        room.history.push(chat)
        if (room.history.length > ROOM_LIMITS.chatHistory)
          room.history.splice(0, room.history.length - ROOM_LIMITS.chatHistory)
        for (const other of room.members.values())
          other.connection?.send({ type: 'chat', message: chat })
        return
      }
      case 'kick': {
        if (!host) return this.error(connection, 'forbidden', false)
        const target = room.members.get(message.memberId)
        if (!target || target.id === member.id) return this.error(connection, 'invalid', false)
        const kicked = target.connection
        this.end(target, 'kicked')
        this.removeMember(room, target.id)
        kicked?.close(4001, 'kicked')
        return this.broadcast(room)
      }
      case 'settings':
        if (!host) return this.error(connection, 'forbidden', false)
        room.settings = { ...room.settings, ...message.settings }
        return this.broadcast(room)
      case 'rotateInvite':
        if (!host) return this.error(connection, 'forbidden', false)
        room.invite = { code: randomId(16), expiresAt: now + message.ttlMs }
        return this.broadcast(room)
      case 'leave':
        this.end(member, 'left')
        this.removeMember(room, member.id)
        if (this.rooms.has(room.id)) this.broadcast(room)
        return
    }
  }

  private create(
    connection: Connection,
    session: Session,
    message: Extract<ClientMessage, { type: 'create' }>,
    now: number,
  ): void {
    if (this.rooms.size >= this.options.maxRooms) return this.error(connection, 'capacity', true)
    if (!this.creations.hit(connection.address, now))
      return this.error(connection, 'rate_limited', true)
    let id = randomId(16)
    while (this.rooms.has(id)) id = randomId(16)
    const member = this.newMember(message.name, message.status, now, connection)
    const room: Room = {
      id,
      createdAt: now,
      members: new Map([[member.id, member]]),
      hostId: member.id,
      timer: createTimer(message.profile, now),
      settings: { timerControl: 'host', locked: false },
      invite: { code: randomId(16), expiresAt: now + message.inviteTtlMs },
      history: [],
    }
    this.rooms.set(id, room)
    this.attach(session, room, member)
  }

  private join(
    connection: Connection,
    session: Session,
    message: Extract<ClientMessage, { type: 'join' }>,
    now: number,
  ): void {
    const room = this.rooms.get(message.roomId)
    // Unknown room and wrong code are indistinguishable to avoid probing.
    if (!room || !sameSecret(room.invite.code, message.invite))
      return this.error(connection, 'not_found', true)
    if (now >= room.invite.expiresAt) return this.error(connection, 'expired', true)
    if (room.settings.locked) return this.error(connection, 'locked', true)
    if (room.members.size >= this.options.maxMembers) return this.error(connection, 'full', true)
    const member = this.newMember(message.name, message.status, now, connection)
    room.members.set(member.id, member)
    this.attach(session, room, member)
  }

  private resume(
    connection: Connection,
    session: Session,
    message: Extract<ClientMessage, { type: 'resume' }>,
  ): void {
    const room = this.rooms.get(message.roomId)
    const member =
      room && [...room.members.values()].find((m) => sameSecret(m.token, message.memberToken))
    if (!room || !member) return this.error(connection, 'not_found', true)
    if (member.connection && member.connection !== connection) {
      const previous = member.connection
      const old = this.sessions.get(previous)
      if (old) {
        old.roomId = null
        old.memberId = null
      }
      previous.send({ type: 'ended', reason: 'replaced' })
      previous.close(4000, 'replaced')
    }
    member.connection = connection
    member.disconnectedAt = null
    this.attach(session, room, member)
  }

  private newMember(
    name: string,
    status: PresenceStatus,
    now: number,
    connection: Connection,
  ): Member {
    return {
      id: randomId(9),
      token: randomId(24),
      name,
      status,
      joinedAt: now,
      connection,
      disconnectedAt: null,
    }
  }

  private attach(session: Session, room: Room, member: Member): void {
    session.roomId = room.id
    session.memberId = member.id
    member.connection?.send({
      type: 'welcome',
      you: member.id,
      memberToken: member.token,
      room: this.view(room, member),
      history: room.history,
      serverNow: this.clock(),
    })
    this.broadcast(room, member.id)
  }

  private removeMember(room: Room, memberId: string): void {
    const member = room.members.get(memberId)
    if (!member) return
    room.members.delete(memberId)
    if (member.connection) {
      const session = this.sessions.get(member.connection)
      if (session) {
        session.roomId = null
        session.memberId = null
      }
    }
    if (room.members.size === 0) {
      // Messages and state disappear with the room: nothing is retained.
      this.rooms.delete(room.id)
      return
    }
    if (room.hostId === memberId) {
      const candidates = [...room.members.values()].sort(
        (a, b) =>
          Number(b.connection !== null) - Number(a.connection !== null) || a.joinedAt - b.joinedAt,
      )
      room.hostId = candidates[0].id
    }
  }

  private end(member: Member, reason: EndReason): void {
    member.connection?.send({ type: 'ended', reason })
  }

  private locate(session: Session): { room: Room; member: Member } | null {
    if (!session.roomId || !session.memberId) return null
    const room = this.rooms.get(session.roomId)
    const member = room?.members.get(session.memberId)
    return room && member ? { room, member } : null
  }

  private view(room: Room, viewer: Member): RoomView {
    return {
      id: room.id,
      createdAt: room.createdAt,
      members: [...room.members.values()].map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        shown: shownStatus(m.status, room.timer),
        host: m.id === room.hostId,
        connected: m.connection !== null,
        joinedAt: m.joinedAt,
      })),
      timer: room.timer,
      settings: room.settings,
      invite: viewer.id === room.hostId ? { ...room.invite } : null,
    }
  }

  private broadcast(room: Room, except?: string): void {
    const serverNow = this.clock()
    for (const member of room.members.values())
      if (member.id !== except)
        member.connection?.send({ type: 'room', room: this.view(room, member), serverNow })
  }

  private error(connection: Connection, code: ErrorCode, fatal: boolean): void {
    connection.send({ type: 'error', code, message: ERROR_MESSAGES[code], fatal })
  }

  private violation(connection: Connection, session: Session, code: ErrorCode): void {
    session.violations += 1
    this.error(connection, code, false)
    if (session.violations >= this.options.maxViolations)
      connection.close(1008, 'too many invalid or excessive messages')
  }
}
