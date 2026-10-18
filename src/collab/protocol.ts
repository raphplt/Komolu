/**
 * Wire contract between the static Komolu frontend and the optional rooms service.
 *
 * This file is executed by the browser (through Vite) and by Node's native type
 * stripping on the server: keep it free of enums, namespaces, parameter
 * properties and runtime imports without an explicit `.ts` extension.
 */
import type { TimerProfile, TimerState } from '../core/model.ts'
import { validateProfile } from '../core/timer.ts'

export const PROTOCOL_VERSION = 1
/** Negotiated through `Sec-WebSocket-Protocol`; any other value is refused. */
export const PROTOCOL_NAME = `komolu.rooms.v${PROTOCOL_VERSION}`

export const ROOM_LIMITS = {
  nameLength: 32,
  chatLength: 500,
  chatHistory: 100,
  members: 16,
  roomIdLength: 22,
  inviteCodeLength: 22,
  memberTokenLength: 32,
  messageBytes: 16 * 1024,
  inviteTtlMinMs: 15 * 60_000,
  inviteTtlMaxMs: 7 * 24 * 60 * 60_000,
} as const

export const INVITE_TTL_CHOICES = [
  { label: '1 heure', ms: 60 * 60_000 },
  { label: '24 heures', ms: 24 * 60 * 60_000 },
  { label: '7 jours', ms: 7 * 24 * 60 * 60_000 },
] as const

/** `auto` follows the shared timer: running work phase → focus, break → pause. */
export type PresenceStatus = 'auto' | 'focus' | 'break' | 'available'
export type ShownStatus = 'focus' | 'break' | 'available'
export type TimerControl = 'host' | 'everyone'
export type RoomTimerAction = 'start' | 'pause' | 'stop' | 'skip'

export interface MemberView {
  id: string
  name: string
  status: PresenceStatus
  shown: ShownStatus
  host: boolean
  connected: boolean
  joinedAt: number
}
export interface RoomSettings {
  timerControl: TimerControl
  /** A locked room refuses new members even with a valid invitation. */
  locked: boolean
}
export interface InviteView {
  code: string
  expiresAt: number
}
export interface RoomView {
  id: string
  createdAt: number
  members: MemberView[]
  timer: TimerState
  settings: RoomSettings
  /** Only sent to the host. */
  invite: InviteView | null
}
export interface ChatMessage {
  id: string
  memberId: string
  name: string
  text: string
  at: number
}

export type ClientMessage =
  | {
      type: 'create'
      name: string
      status: PresenceStatus
      inviteTtlMs: number
      profile: TimerProfile
    }
  | { type: 'join'; roomId: string; invite: string; name: string; status: PresenceStatus }
  | { type: 'resume'; roomId: string; memberToken: string }
  | { type: 'presence'; status?: PresenceStatus; name?: string }
  | { type: 'timer'; action: RoomTimerAction }
  | { type: 'timerProfile'; profile: TimerProfile }
  | { type: 'chat'; text: string }
  | { type: 'kick'; memberId: string }
  | { type: 'settings'; settings: Partial<RoomSettings> }
  | { type: 'rotateInvite'; ttlMs: number }
  | { type: 'leave' }
  | { type: 'ping'; t: number }

export type ErrorCode =
  | 'invalid'
  | 'not_found'
  | 'expired'
  | 'full'
  | 'locked'
  | 'forbidden'
  | 'rate_limited'
  | 'capacity'
  | 'state'

export type EndReason = 'left' | 'kicked' | 'closed' | 'replaced'

export type ServerMessage =
  | {
      type: 'welcome'
      you: string
      memberToken: string
      room: RoomView
      history: ChatMessage[]
      serverNow: number
    }
  | { type: 'room'; room: RoomView; serverNow: number }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'pong'; t: number; serverNow: number }
  | { type: 'error'; code: ErrorCode; message: string; fatal: boolean }
  | { type: 'ended'; reason: EndReason }

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid: 'Message refusé par la salle.',
  not_found: 'Cette salle n’existe pas ou l’invitation n’est plus valable.',
  expired: 'Cette invitation a expiré. Demande un nouveau lien à l’hôte.',
  full: 'Cette salle est complète.',
  locked: 'L’hôte a fermé la salle aux nouvelles arrivées.',
  forbidden: 'Seul l’hôte peut faire cela.',
  rate_limited: 'Doucement : trop de messages en peu de temps.',
  capacity: 'Le service de salles est saturé. Réessaie plus tard.',
  state: 'Tu n’as pas encore rejoint de salle.',
}

const STATUSES: readonly PresenceStatus[] = ['auto', 'focus', 'break', 'available']
const TIMER_ACTIONS: readonly RoomTimerAction[] = ['start', 'pause', 'stop', 'skip']
const ID_PATTERN = /^[A-Za-z0-9_-]+$/

// C0/C1 control characters (tab, LF and CR are handled by each sanitizer) and
// bidi overrides that can be used to spoof names or hide content.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g

function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') : text
}
/** Single-line pseudonym, at most `nameLength` code points; empty when unusable. */
export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return clip(
    value.normalize('NFC').replace(CONTROL, '').replace(/\s+/g, ' ').trim(),
    ROOM_LIMITS.nameLength,
  )
}
/** Chat text keeps line breaks (at most two in a row) and is rendered as plain text. */
export function sanitizeChat(value: unknown): string {
  if (typeof value !== 'string') return ''
  return clip(
    value
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL, '')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    ROOM_LIMITS.chatLength,
  )
}
function isId(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && ID_PATTERN.test(value)
}
function isStatus(value: unknown): value is PresenceStatus {
  return STATUSES.includes(value as PresenceStatus)
}
function isTtl(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= ROOM_LIMITS.inviteTtlMinMs &&
    value <= ROOM_LIMITS.inviteTtlMaxMs
  )
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
/** Rebuilds a profile from known keys only so unknown fields never reach other members. */
export function sanitizeProfile(value: unknown): TimerProfile | null {
  if (!isObject(value) || !Array.isArray(value.phases) || value.phases.length > 20) return null
  const phases = value.phases.map((phase) =>
    isObject(phase)
      ? {
          id: typeof phase.id === 'string' ? phase.id.slice(0, 40) : '',
          label: sanitizeName(phase.label) || 'Phase',
          kind: phase.kind,
          durationMs: phase.durationMs,
        }
      : null,
  )
  if (phases.some((phase) => phase === null)) return null
  const profile = {
    id: typeof value.id === 'string' ? value.id.slice(0, 40) : 'room',
    name: sanitizeName(value.name) || 'Minuterie de la salle',
    mode: value.mode,
    phases,
    repeats: value.repeats,
    autoAdvance: value.autoAdvance,
    // The completion chime is a personal preference, never imposed by a room.
    sound: false,
  } as TimerProfile
  try {
    return validateProfile(profile) ? profile : null
  } catch {
    return null
  }
}

/** Strict parser: returns null for anything that is not an exact, bounded client message. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > ROOM_LIMITS.messageBytes) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(data) || typeof data.type !== 'string') return null
  switch (data.type) {
    case 'create': {
      const name = sanitizeName(data.name)
      const profile = sanitizeProfile(data.profile)
      if (!name || !isStatus(data.status) || !isTtl(data.inviteTtlMs) || !profile) return null
      return { type: 'create', name, status: data.status, inviteTtlMs: data.inviteTtlMs, profile }
    }
    case 'join': {
      const name = sanitizeName(data.name)
      if (
        !name ||
        !isStatus(data.status) ||
        !isId(data.roomId, ROOM_LIMITS.roomIdLength) ||
        !isId(data.invite, ROOM_LIMITS.inviteCodeLength)
      )
        return null
      return { type: 'join', roomId: data.roomId, invite: data.invite, name, status: data.status }
    }
    case 'resume':
      if (
        !isId(data.roomId, ROOM_LIMITS.roomIdLength) ||
        !isId(data.memberToken, ROOM_LIMITS.memberTokenLength)
      )
        return null
      return { type: 'resume', roomId: data.roomId, memberToken: data.memberToken }
    case 'presence': {
      const message: { type: 'presence'; status?: PresenceStatus; name?: string } = {
        type: 'presence',
      }
      if (data.status !== undefined) {
        if (!isStatus(data.status)) return null
        message.status = data.status
      }
      if (data.name !== undefined) {
        const name = sanitizeName(data.name)
        if (!name) return null
        message.name = name
      }
      return message.status || message.name ? message : null
    }
    case 'timer':
      return TIMER_ACTIONS.includes(data.action as RoomTimerAction)
        ? { type: 'timer', action: data.action as RoomTimerAction }
        : null
    case 'timerProfile': {
      const profile = sanitizeProfile(data.profile)
      return profile ? { type: 'timerProfile', profile } : null
    }
    case 'chat': {
      const text = sanitizeChat(data.text)
      return text ? { type: 'chat', text } : null
    }
    case 'kick':
      return typeof data.memberId === 'string' && data.memberId.length <= 64
        ? { type: 'kick', memberId: data.memberId }
        : null
    case 'settings': {
      if (!isObject(data.settings)) return null
      const settings: Partial<RoomSettings> = {}
      const { timerControl, locked } = data.settings
      if (timerControl !== undefined) {
        if (timerControl !== 'host' && timerControl !== 'everyone') return null
        settings.timerControl = timerControl
      }
      if (locked !== undefined) {
        if (typeof locked !== 'boolean') return null
        settings.locked = locked
      }
      return Object.keys(settings).length ? { type: 'settings', settings } : null
    }
    case 'rotateInvite':
      return isTtl(data.ttlMs) ? { type: 'rotateInvite', ttlMs: data.ttlMs } : null
    case 'leave':
      return { type: 'leave' }
    case 'ping':
      return typeof data.t === 'number' && Number.isFinite(data.t)
        ? { type: 'ping', t: data.t }
        : null
    default:
      return null
  }
}

/** Status displayed to others; `auto` mirrors the shared timer phase. */
export function shownStatus(status: PresenceStatus, timer: TimerState): ShownStatus {
  if (status !== 'auto') return status
  if (timer.status !== 'running') return 'available'
  return timer.profile.phases[timer.phaseIndex]?.kind === 'break' ? 'break' : 'focus'
}

/** Invitation links keep their secret in the fragment, which browsers never send to servers. */
export function inviteLink(base: string, roomId: string, code: string): string {
  const url = new URL(base)
  url.hash = `join=${roomId}.${code}`
  return url.toString()
}
export function parseInvite(input: string): { roomId: string; invite: string } | null {
  const match = /(?:^|[#&?\s])join=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(input.trim())
  if (!match) return null
  const [, roomId, invite] = match
  return isId(roomId, ROOM_LIMITS.roomIdLength) && isId(invite, ROOM_LIMITS.inviteCodeLength)
    ? { roomId, invite }
    : null
}
