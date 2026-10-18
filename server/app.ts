import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { PROTOCOL_NAME, ROOM_LIMITS, type ServerMessage } from '../src/collab/protocol.ts'
import type { ServerConfig } from './config.ts'
import { RoomManager, type Connection } from './rooms.ts'

export function originAllowed(
  origin: string | undefined,
  host: string | undefined,
  allowed: string[],
): boolean {
  if (!origin) return false
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (allowed.length) return allowed.includes(parsed.origin)
  return !!host && parsed.host === host
}

export function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    // The right-most value is the one appended by our own reverse proxy.
    const forwarded = request.headers['x-forwarded-for']
    const list = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (list.length) return list[list.length - 1]
  }
  return request.socket.remoteAddress ?? 'unknown'
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}

export interface RoomsServer {
  server: Server
  manager: RoomManager
  close(): Promise<void>
}

export function createRoomsServer(config: ServerConfig): RoomsServer {
  const manager = new RoomManager(config.rooms)
  const perAddress = new Map<string, number>()
  const alive = new WeakMap<WebSocket, boolean>()

  const server = createServer((request, response) => {
    const path = request.url?.split('?')[0]
    if (request.method === 'GET' && path === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ ok: true, protocol: PROTOCOL_NAME }))
      return
    }
    response.writeHead(404, { 'content-type': 'text/plain' })
    response.end('Not found')
  })

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: ROOM_LIMITS.messageBytes,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has(PROTOCOL_NAME) ? PROTOCOL_NAME : false),
  })

  server.on('upgrade', (request, socket, head) => {
    socket.on('error', () => socket.destroy())
    if (request.url?.split('?')[0] !== config.path) return reject(socket, 404, 'Not Found')
    if (!originAllowed(request.headers.origin, request.headers.host, config.allowedOrigins))
      return reject(socket, 403, 'Forbidden')
    const offered = (request.headers['sec-websocket-protocol'] ?? '')
      .split(',')
      .map((value) => value.trim())
    if (!offered.includes(PROTOCOL_NAME)) return reject(socket, 426, 'Upgrade Required')
    const address = clientAddress(request, config.trustProxy)
    const count = perAddress.get(address) ?? 0
    if (count >= config.maxConnectionsPerAddress) return reject(socket, 429, 'Too Many Requests')
    perAddress.set(address, count + 1)
    wss.handleUpgrade(request, socket, head, (ws) => {
      const connection: Connection = {
        address,
        send(message: ServerMessage) {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
        },
        close(code, reason) {
          ws.close(code, reason)
        },
      }
      alive.set(ws, true)
      manager.connect(connection)
      ws.on('pong', () => alive.set(ws, true))
      ws.on('message', (data, isBinary) => {
        if (isBinary) return ws.close(1003, 'text only')
        manager.receive(connection, data.toString())
      })
      ws.on('error', () => ws.terminate())
      ws.on('close', () => {
        manager.disconnect(connection)
        const remaining = (perAddress.get(address) ?? 1) - 1
        if (remaining > 0) perAddress.set(address, remaining)
        else perAddress.delete(address)
      })
    })
  })

  const tick = setInterval(() => manager.tick(), config.tickMs)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate()
        continue
      }
      alive.set(ws, false)
      ws.ping()
    }
  }, config.heartbeatMs)
  tick.unref()
  heartbeat.unref()

  return {
    server,
    manager,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(tick)
        clearInterval(heartbeat)
        manager.closeAll()
        for (const ws of wss.clients) ws.close(1001, 'shutdown')
        wss.close()
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}
