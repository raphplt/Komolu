import { describe, expect, it } from 'vitest'
import { TIMER_PROFILES } from '../src/core/timer'
import type { ServerMessage } from '../src/collab/protocol'
import { RoomManager, type Connection } from './rooms'

class FakeConnection implements Connection {
  readonly address: string
  readonly inbox: ServerMessage[] = []
  closed: { code: number; reason: string } | null = null
  constructor(address = '203.0.113.1') {
    this.address = address
  }
  send(message: ServerMessage) {
    this.inbox.push(structuredClone(message))
  }
  close(code: number, reason: string) {
    this.closed = { code, reason }
  }
  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> {
    const found = [...this.inbox].reverse().find((m) => m.type === type)
    if (!found) throw new Error(`no ${type} message`)
    return found as Extract<ServerMessage, { type: T }>
  }
  has(type: ServerMessage['type']) {
    return this.inbox.some((m) => m.type === type)
  }
}

const HOUR = 60 * 60_000
function setup(options: ConstructorParameters<typeof RoomManager>[0] = {}) {
  let now = 1_000_000
  const manager = new RoomManager(options, () => now)
  const open = (address?: string) => {
    const connection = new FakeConnection(address)
    manager.connect(connection)
    return connection
  }
  const send = (connection: Connection, message: object) =>
    manager.receive(connection, JSON.stringify(message))
  const create = (name = 'Alex', ttl = HOUR) => {
    const host = open()
    send(host, {
      type: 'create',
      name,
      status: 'auto',
      inviteTtlMs: ttl,
      profile: TIMER_PROFILES[0],
    })
    const welcome = host.last('welcome')
    return { host, welcome, room: welcome.room, invite: welcome.room.invite! }
  }
  const join = (roomId: string, invite: string, name = 'Sam', address?: string) => {
    const guest = open(address)
    send(guest, { type: 'join', roomId, invite, name, status: 'auto' })
    return guest
  }
  return {
    manager,
    open,
    send,
    create,
    join,
    advance: (ms: number) => {
      now += ms
    },
    now: () => now,
  }
}

describe('room lifecycle', () => {
  it('creates a room with unpredictable identifiers and the host privileges', () => {
    const { create } = setup()
    const { welcome, room, invite } = create()
    expect(room.id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(invite.code).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(invite.code).not.toBe(room.id)
    expect(welcome.memberToken).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(room.members).toEqual([
      expect.objectContaining({ name: 'Alex', host: true, connected: true, shown: 'available' }),
    ])
    expect(room.timer.status).toBe('idle')
    expect(room.timer.profile.sound).toBe(false)
  })

  it('lets guests join with the invitation and hides the invitation from them', () => {
    const { create, join } = setup()
    const { host, room, invite } = create()
    const guest = join(room.id, invite.code)
    const welcome = guest.last('welcome')
    expect(welcome.room.invite).toBeNull()
    expect(welcome.room.members.map((m) => m.name)).toEqual(['Alex', 'Sam'])
    expect(host.last('room').room.members).toHaveLength(2)
  })

  it('refuses wrong codes and unknown rooms identically', () => {
    const { create, join } = setup()
    const { room } = create()
    const wrong = join(room.id, 'x'.repeat(22))
    const unknown = join('y'.repeat(22), 'x'.repeat(22))
    expect(wrong.last('error')).toEqual(unknown.last('error'))
    expect(wrong.last('error')).toMatchObject({ code: 'not_found', fatal: true })
  })

  it('expires invitations, but lets the host rotate them', () => {
    const { create, join, send, advance } = setup()
    const { host, room, invite } = create('Alex', 15 * 60_000)
    advance(15 * 60_000)
    expect(join(room.id, invite.code).last('error').code).toBe('expired')
    send(host, { type: 'rotateInvite', ttlMs: HOUR })
    const fresh = host.last('room').room.invite!
    expect(fresh.code).not.toBe(invite.code)
    expect(join(room.id, invite.code).last('error').code).toBe('not_found')
    expect(join(room.id, fresh.code).has('welcome')).toBe(true)
  })

  it('enforces locking and capacity', () => {
    const { create, join, send } = setup({ maxMembers: 2 })
    const { host, room, invite } = create()
    join(room.id, invite.code)
    expect(join(room.id, invite.code).last('error').code).toBe('full')
    send(host, { type: 'settings', settings: { locked: true } })
    expect(host.last('room').room.settings.locked).toBe(true)
  })

  it('refuses new members in a locked room', () => {
    const { create, join, send } = setup()
    const { host, room, invite } = create()
    send(host, { type: 'settings', settings: { locked: true } })
    expect(join(room.id, invite.code).last('error').code).toBe('locked')
  })
})

describe('shared timer', () => {
  it('is controlled by the host only unless opened to everyone', () => {
    const { create, join, send } = setup()
    const { host, room, invite } = create()
    const guest = join(room.id, invite.code)
    send(guest, { type: 'timer', action: 'start' })
    expect(guest.last('error').code).toBe('forbidden')
    send(host, { type: 'settings', settings: { timerControl: 'everyone' } })
    send(guest, { type: 'timer', action: 'start' })
    expect(host.last('room').room.timer.status).toBe('running')
  })

  it('keeps an authoritative deadline and advances it server-side', () => {
    const { create, join, send, advance, manager, now } = setup()
    const { host, room, invite } = create()
    const guest = join(room.id, invite.code)
    send(host, { type: 'timer', action: 'start' })
    const started = guest.last('room').room.timer
    expect(started.deadline).toBe(now() + 25 * 60_000)
    expect(started.taskId).toBeNull()
    expect(guest.last('room').room.members.every((m) => m.shown === 'focus')).toBe(true)
    advance(25 * 60_000)
    manager.tick()
    const after = guest.last('room').room.timer
    expect(after.status).toBe('waiting')
    expect(after.phaseIndex).toBe(1)
    expect(after.completedPhases).toBe(1)
  })

  it('never lets a private task identifier reach the room', () => {
    const { create, send } = setup()
    const { host } = create()
    send(host, { type: 'timer', action: 'start', taskId: 'secret' })
    expect(host.last('room').room.timer.taskId).toBeNull()
  })

  it('accepts only valid profiles from the host and resets the timer', () => {
    const { create, send } = setup()
    const { host } = create()
    send(host, { type: 'timerProfile', profile: { ...TIMER_PROFILES[1], sound: true } })
    const timer = host.last('room').room.timer
    expect(timer.profile.id).toBe('deep')
    expect(timer.profile.sound).toBe(false)
    send(host, { type: 'timerProfile', profile: { ...TIMER_PROFILES[1], repeats: -1 } })
    expect(host.last('error').code).toBe('invalid')
  })
})

describe('presence, chat and moderation', () => {
  it('broadcasts presence and chat as plain sanitized text', () => {
    const { create, join, send } = setup()
    const { host, room, invite } = create()
    const guest = join(room.id, invite.code)
    send(guest, { type: 'presence', status: 'break', name: '  Sam\u202e  the\nbest ' })
    const member = host.last('room').room.members.find((m) => !m.host)!
    expect(member).toMatchObject({ name: 'Sam the best', status: 'break', shown: 'break' })
    send(guest, { type: 'chat', text: '<img src=x onerror=alert(1)>\n\n\n\nhi\u0007' })
    expect(host.last('chat').message).toMatchObject({
      name: 'Sam the best',
      text: '<img src=x onerror=alert(1)>\n\nhi',
    })
  })

  it('keeps a bounded history delivered to newcomers', () => {
    const { create, join, send, advance } = setup()
    const { host, room, invite } = create()
    for (let i = 0; i < 120; i++) {
      send(host, { type: 'chat', text: `m${i}` })
      advance(2_000)
    }
    const history = join(room.id, invite.code).last('welcome').history
    expect(history).toHaveLength(100)
    expect(history[0].text).toBe('m20')
  })

  it('rate limits chat floods and closes abusive sockets', () => {
    const { create, send } = setup()
    const { host } = create()
    for (let i = 0; i < 8; i++) send(host, { type: 'chat', text: 'spam' })
    send(host, { type: 'chat', text: 'spam' })
    expect(host.last('error').code).toBe('rate_limited')
    for (let i = 0; i < 25; i++) send(host, { type: 'nope' })
    expect(host.closed?.code).toBe(1008)
  })

  it('lets the host kick a member, who is told and disconnected', () => {
    const { create, join, send } = setup()
    const { host, room, invite } = create()
    const guest = join(room.id, invite.code)
    const guestId = guest.last('welcome').you
    send(guest, { type: 'kick', memberId: host.last('welcome').you })
    expect(guest.last('error').code).toBe('forbidden')
    send(host, { type: 'kick', memberId: guestId })
    expect(guest.last('ended').reason).toBe('kicked')
    expect(guest.closed?.code).toBe(4001)
    expect(host.last('room').room.members).toHaveLength(1)
    send(guest, { type: 'chat', text: 'still here?' })
    expect(guest.last('error').code).toBe('state')
  })

  it('limits room creation per address', () => {
    const { open, send } = setup({ roomsPerAddressPerHour: 2 })
    const results = Array.from({ length: 3 }, () => {
      const connection = open('198.51.100.7')
      send(connection, {
        type: 'create',
        name: 'A',
        status: 'auto',
        inviteTtlMs: HOUR,
        profile: TIMER_PROFILES[0],
      })
      return connection.has('welcome')
    })
    expect(results).toEqual([true, true, false])
  })
})

describe('reconnection and cleanup', () => {
  it('keeps the seat during the grace period and resumes with the member token', () => {
    const { create, join, open, send, manager, advance } = setup({ reconnectGraceMs: 60_000 })
    const { room, invite } = create()
    const guest = join(room.id, invite.code)
    const { memberToken, you } = guest.last('welcome')
    manager.disconnect(guest)
    advance(30_000)
    manager.tick()
    const again = open()
    send(again, { type: 'resume', roomId: room.id, memberToken })
    const welcome = again.last('welcome')
    expect(welcome.you).toBe(you)
    expect(welcome.room.members.find((m) => m.id === you)?.connected).toBe(true)
  })

  it('replaces an older socket using the same member token', () => {
    const { create, open, send } = setup()
    const { host, room, welcome } = create()
    const second = open()
    send(second, { type: 'resume', roomId: room.id, memberToken: welcome.memberToken })
    expect(host.last('ended').reason).toBe('replaced')
    expect(second.last('welcome').room.members[0].host).toBe(true)
  })

  it('transfers the host role and deletes empty rooms with their messages', () => {
    const { create, join, open, send, manager, advance } = setup({ reconnectGraceMs: 10_000 })
    const { host, room, invite, welcome } = create()
    const guest = join(room.id, invite.code)
    send(host, { type: 'chat', text: 'secret' })
    manager.disconnect(host)
    advance(10_000)
    manager.tick()
    const view = guest.last('room').room
    expect(view.members).toHaveLength(1)
    expect(view.members[0].host).toBe(true)
    expect(view.invite).not.toBeNull()
    send(guest, { type: 'leave' })
    expect(guest.last('ended').reason).toBe('left')
    expect(manager.stats().rooms).toBe(0)
    const late = open()
    send(late, { type: 'resume', roomId: room.id, memberToken: welcome.memberToken })
    expect(late.last('error').code).toBe('not_found')
  })

  it('answers pings with the server clock for drift correction', () => {
    const { open, send, now } = setup()
    const connection = open()
    send(connection, { type: 'ping', t: 42 })
    expect(connection.last('pong')).toEqual({ type: 'pong', t: 42, serverNow: now() })
  })
})
