import { DEFAULT_ROOM_OPTIONS, type RoomManagerOptions } from './rooms.ts'

export interface ServerConfig {
  host: string
  port: number
  path: string
  /** Exact origins allowed to open a socket; empty means "same host as the request". */
  allowedOrigins: string[]
  /** Read the client address from `X-Forwarded-For` (only behind a trusted reverse proxy). */
  trustProxy: boolean
  maxConnectionsPerAddress: number
  heartbeatMs: number
  tickMs: number
  rooms: RoomManagerOptions
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} doit être un entier entre ${min} et ${max}.`)
  return value
}

function origins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error(`Origine invalide dans KOMOLU_ALLOWED_ORIGINS : ${value}`)
      return url.origin
    })
}

/** Fails fast on invalid values so a misconfigured instance never starts half-open. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const path = env.KOMOLU_ROOMS_PATH || '/rooms'
  if (!/^\/[A-Za-z0-9/_-]*$/.test(path)) throw new Error('KOMOLU_ROOMS_PATH invalide.')
  return {
    host: env.HOST || '0.0.0.0',
    port: integer(env, 'PORT', 8787, 0, 65_535),
    path,
    allowedOrigins: origins(env.KOMOLU_ALLOWED_ORIGINS),
    trustProxy: env.KOMOLU_TRUST_PROXY === '1' || env.KOMOLU_TRUST_PROXY === 'true',
    maxConnectionsPerAddress: integer(env, 'KOMOLU_MAX_CONNECTIONS_PER_ADDRESS', 20, 1, 10_000),
    heartbeatMs: 30_000,
    tickMs: 500,
    rooms: {
      maxRooms: integer(env, 'KOMOLU_MAX_ROOMS', DEFAULT_ROOM_OPTIONS.maxRooms, 1, 100_000),
      maxMembers: integer(env, 'KOMOLU_MAX_MEMBERS', DEFAULT_ROOM_OPTIONS.maxMembers, 2, 50),
      reconnectGraceMs:
        integer(
          env,
          'KOMOLU_RECONNECT_GRACE_SECONDS',
          DEFAULT_ROOM_OPTIONS.reconnectGraceMs / 1_000,
          5,
          3_600,
        ) * 1_000,
      roomsPerAddressPerHour: integer(
        env,
        'KOMOLU_ROOMS_PER_HOUR',
        DEFAULT_ROOM_OPTIONS.roomsPerAddressPerHour,
        1,
        10_000,
      ),
      maxViolations: DEFAULT_ROOM_OPTIONS.maxViolations,
    },
  }
}
