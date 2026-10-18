import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { TIMER_PROFILES } from '../src/core/timer'
import { PROTOCOL_NAME, type ServerMessage } from '../src/collab/protocol'
import { createRoomsServer, originAllowed, type RoomsServer } from './app'
import { loadConfig } from './config'

let running: RoomsServer | null = null
afterEach(async () => {
  await running?.close()
  running = null
})

async function start(env: Record<string, string> = {}) {
  running = createRoomsServer(loadConfig({ PORT: '0', HOST: '127.0.0.1', ...env }))
  await new Promise<void>((resolve) => running!.server.listen(0, '127.0.0.1', resolve))
  const { port } = running.server.address() as AddressInfo
  return port
}

function client(port: number, origin = `http://127.0.0.1:${port}`, protocol = PROTOCOL_NAME) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/rooms`, protocol, { origin })
  const inbox: ServerMessage[] = []
  const waiters: (() => void)[] = []
  ws.on('message', (data) => {
    inbox.push(JSON.parse(data.toString()) as ServerMessage)
    waiters.splice(0).forEach((wake) => wake())
  })
  const next = async <T extends ServerMessage['type']>(type: T) => {
    for (;;) {
      const index = inbox.findIndex((m) => m.type === type)
      if (index >= 0) return inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('unexpected-response', (_req, res) => reject(new Error(String(res.statusCode))))
    ws.once('error', reject)
  })
  return { ws, next, opened, send: (message: object) => ws.send(JSON.stringify(message)) }
}

describe('rooms server', () => {
  it('serves a health endpoint without exposing room data', async () => {
    const port = await start()
    const response = await fetch(`http://127.0.0.1:${port}/healthz`)
    expect(await response.json()).toEqual({ ok: true, protocol: PROTOCOL_NAME })
  })

  it('rejects foreign origins and unknown protocol versions', async () => {
    const port = await start()
    await expect(client(port, 'https://evil.example').opened).rejects.toThrow('403')
    await expect(client(port, undefined, 'komolu.rooms.v0').opened).rejects.toThrow('426')
  })

  it('honours an explicit origin allow-list', async () => {
    const port = await start({ KOMOLU_ALLOWED_ORIGINS: 'https://focus.example' })
    await expect(client(port).opened).rejects.toThrow('403')
    await expect(client(port, 'https://focus.example').opened).resolves.toBeUndefined()
  })

  it('limits simultaneous sockets per address', async () => {
    const port = await start({ KOMOLU_MAX_CONNECTIONS_PER_ADDRESS: '1' })
    const first = client(port)
    await first.opened
    await expect(client(port).opened).rejects.toThrow('429')
  })

  it('runs a complete room session over real sockets', async () => {
    const port = await start()
    const host = client(port)
    await host.opened
    host.send({
      type: 'create',
      name: 'Alex',
      status: 'auto',
      inviteTtlMs: 3_600_000,
      profile: TIMER_PROFILES[0],
    })
    const { room } = await host.next('welcome')
    const guest = client(port)
    await guest.opened
    guest.send({
      type: 'join',
      roomId: room.id,
      invite: room.invite!.code,
      name: 'Sam',
      status: 'auto',
    })
    expect((await guest.next('welcome')).room.members).toHaveLength(2)
    host.send({ type: 'timer', action: 'start' })
    const update = await guest.next('room')
    expect(update.room.timer.status).toBe('running')
    guest.send({ type: 'chat', text: 'Bon courage !' })
    expect((await host.next('chat')).message.text).toBe('Bon courage !')
    guest.send({ type: 'ping', t: 1 })
    expect((await guest.next('pong')).t).toBe(1)
  })

  it('drops oversized frames', async () => {
    const port = await start()
    const c = client(port)
    await c.opened
    const closed = new Promise<number>((resolve) => c.ws.once('close', resolve))
    c.ws.send('x'.repeat(20_000))
    expect(await closed).toBe(1009)
  })
})

describe('origin policy', () => {
  it('matches same host by default, including the port', () => {
    expect(originAllowed('https://a.example', 'a.example', [])).toBe(true)
    expect(originAllowed('http://localhost:8080', 'localhost:8080', [])).toBe(true)
    expect(originAllowed('http://localhost:5173', 'localhost:8080', [])).toBe(false)
    expect(originAllowed(undefined, 'a.example', [])).toBe(false)
    expect(originAllowed('null', 'a.example', [])).toBe(false)
  })
})
