import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TIMER_PROFILES, createTimer } from '../core/timer'
import { RoomClient } from './client'
import type { RoomView, ServerMessage } from './protocol'

class FakeSocket {
  static all: FakeSocket[] = []
  readyState = 0
  sent: Record<string, unknown>[] = []
  closed = false
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly url: string
  readonly protocol: string
  constructor(url: string, protocol: string) {
    this.url = url
    this.protocol = protocol
    FakeSocket.all.push(this)
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent)
  }
  drop() {
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }
}

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
}

const ROOM_ID = 'r'.repeat(22)
const TOKEN = 't'.repeat(32)
function room(): RoomView {
  return {
    id: ROOM_ID,
    createdAt: 0,
    members: [
      {
        id: 'me',
        name: 'Alex',
        status: 'auto',
        shown: 'available',
        host: true,
        connected: true,
        joinedAt: 0,
      },
    ],
    timer: createTimer(TIMER_PROFILES[0], 0),
    settings: { timerControl: 'host', locked: false },
    invite: { code: 'c'.repeat(22), expiresAt: 10 },
  }
}

let now = 10_000
let storage: MemoryStorage
function makeClient() {
  return new RoomClient('ws://test/rooms', {
    createSocket: (url, protocol) => new FakeSocket(url, protocol),
    storage,
    now: () => now,
    pingMs: 60_000,
  })
}
const latest = () => FakeSocket.all[FakeSocket.all.length - 1]
function welcome(socket: FakeSocket, serverNow = now + 5_000) {
  socket.receive({
    type: 'welcome',
    you: 'me',
    memberToken: TOKEN,
    room: room(),
    history: [],
    serverNow,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.all = []
  storage = new MemoryStorage()
  now = 10_000
})
afterEach(() => vi.useRealTimers())

describe('RoomClient', () => {
  it('negotiates the protocol, sends the intent and stores the seat per tab', () => {
    const client = makeClient()
    client.create('Alex', 3_600_000, TIMER_PROFILES[0], 'auto')
    expect(client.getSnapshot().phase).toBe('connecting')
    const socket = latest()
    expect(socket.protocol).toBe('komolu.rooms.v1')
    socket.open()
    expect(socket.sent[0]).toMatchObject({ type: 'create', name: 'Alex' })
    welcome(socket)
    expect(client.getSnapshot()).toMatchObject({ phase: 'joined', you: 'me', offset: 5_000 })
    expect(JSON.parse(storage.getItem('komolu.room.session')!)).toEqual({
      roomId: ROOM_ID,
      memberToken: TOKEN,
    })
    expect(socket.sent[1]).toMatchObject({ type: 'ping', t: 10_000 })
  })

  it('refines the clock offset from the fastest ping', () => {
    const client = makeClient()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().open()
    welcome(latest())
    now = 10_400
    latest().receive({ type: 'pong', t: 10_000, serverNow: 12_000 })
    expect(client.getSnapshot().offset).toBe(12_000 + 200 - 10_400)
    now = 20_000
    latest().receive({ type: 'pong', t: 19_000, serverNow: 0 })
    expect(client.getSnapshot().offset).toBe(1_800)
  })

  it('reconnects with the member token, not the invitation', () => {
    const client = makeClient()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().open()
    welcome(latest())
    latest().drop()
    expect(client.getSnapshot().phase).toBe('reconnecting')
    expect(client.getSnapshot().room).not.toBeNull()
    vi.advanceTimersByTime(1_000)
    latest().open()
    expect(latest().sent[0]).toEqual({ type: 'resume', roomId: ROOM_ID, memberToken: TOKEN })
    welcome(latest())
    expect(client.getSnapshot().phase).toBe('joined')
  })

  it('resumes a saved seat after reload and forgets it when the room is gone', () => {
    storage.setItem('komolu.room.session', JSON.stringify({ roomId: ROOM_ID, memberToken: TOKEN }))
    const client = makeClient()
    expect(client.resumeSaved()).toBe(true)
    latest().open()
    latest().receive({ type: 'error', code: 'not_found', message: '', fatal: true })
    expect(client.getSnapshot()).toMatchObject({ phase: 'idle', room: null })
    expect(client.getSnapshot().error).toMatch(/n’existe pas/)
    expect(storage.getItem('komolu.room.session')).toBeNull()
    expect(client.resumeSaved()).toBe(false)
  })

  it('reports a failed first connection instead of retrying forever', () => {
    const client = makeClient()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().drop()
    expect(client.getSnapshot()).toMatchObject({ phase: 'idle' })
    expect(client.getSnapshot().error).toMatch(/impossible/)
    expect(FakeSocket.all).toHaveLength(1)
  })

  it('counts unread messages from others only', () => {
    const client = makeClient()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().open()
    welcome(latest())
    const message = (memberId: string) =>
      latest().receive({
        type: 'chat',
        message: { id: memberId + now++, memberId, name: 'x', text: 'hi', at: now },
      })
    message('me')
    message('other')
    message('other')
    expect(client.getSnapshot().unread).toBe(2)
    expect(client.getSnapshot().messages).toHaveLength(3)
    client.markRead()
    expect(client.getSnapshot().unread).toBe(0)
  })

  it('ends cleanly when kicked and when leaving', () => {
    const client = makeClient()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().open()
    welcome(latest())
    latest().receive({ type: 'ended', reason: 'kicked' })
    expect(client.getSnapshot()).toMatchObject({ phase: 'idle', room: null, ended: 'kicked' })
    expect(storage.getItem('komolu.room.session')).toBeNull()
    client.join(ROOM_ID, 'c'.repeat(22), 'Sam', 'auto')
    latest().open()
    welcome(latest())
    client.leave()
    expect(latest().sent.at(-1)).toEqual({ type: 'leave' })
    expect(latest().closed).toBe(true)
    expect(client.getSnapshot()).toMatchObject({ phase: 'idle', error: null, ended: 'left' })
  })

  it('refuses room actions while not joined', () => {
    const client = makeClient()
    expect(client.send({ type: 'chat', text: 'hi' })).toBe(false)
  })
})
