import { describe, expect, it } from 'vitest'
import { TIMER_PROFILES, createTimer, transitionTimer } from '../core/timer'
import {
  inviteLink,
  parseClientMessage,
  parseInvite,
  sanitizeChat,
  sanitizeName,
  sanitizeProfile,
  shownStatus,
} from './protocol'
import { buildDefaults, parseInstanceConfig, socketUrl } from './config'

const ROOM = 'a'.repeat(22)
const CODE = 'B-_'.repeat(7) + 'c'

describe('protocol validation', () => {
  it('accepts exact messages and rejects unknown or malformed ones', () => {
    expect(parseClientMessage('{"type":"leave"}')).toEqual({ type: 'leave' })
    expect(parseClientMessage('{"type":"timer","action":"start"}')).toEqual({
      type: 'timer',
      action: 'start',
    })
    for (const raw of [
      'not json',
      '[]',
      '{"type":"timer","action":"explode"}',
      '{"type":"chat","text":"   "}',
      '{"type":"join","roomId":"short","invite":"x","name":"A","status":"auto"}',
      '{"type":"settings","settings":{"locked":"yes"}}',
      '{"type":"rotateInvite","ttlMs":1000}',
      '{"type":"presence"}',
      '{"type":"admin"}',
      JSON.stringify({ type: 'chat', text: 'x'.repeat(20_000) }),
    ])
      expect(parseClientMessage(raw), raw).toBeNull()
  })

  it('drops unknown keys so they never reach other members', () => {
    const parsed = parseClientMessage(
      JSON.stringify({ type: 'join', roomId: ROOM, invite: CODE, name: 'A', status: 'auto', x: 1 }),
    )
    expect(parsed).toEqual({ type: 'join', roomId: ROOM, invite: CODE, name: 'A', status: 'auto' })
  })

  it('sanitizes names and chat text', () => {
    expect(sanitizeName('  Zoé\u202e \n\t Ä ')).toBe('Zoé Ä')
    expect(sanitizeName('é'.repeat(40))).toHaveLength(32)
    expect(sanitizeName('\u0000')).toBe('')
    expect(sanitizeChat('a\r\nb\n\n\n\nc\u0000')).toBe('a\nb\n\nc')
    expect(Array.from(sanitizeChat('🙂'.repeat(600)))).toHaveLength(500)
  })

  it('rebuilds profiles from known keys and never imposes a sound', () => {
    const profile = sanitizeProfile({ ...TIMER_PROFILES[0], sound: true, extra: 'x' })
    expect(profile).toEqual({ ...TIMER_PROFILES[0], sound: false })
    expect(sanitizeProfile({ ...TIMER_PROFILES[0], phases: [] })).toBeNull()
    expect(sanitizeProfile({ ...TIMER_PROFILES[0], phases: [null] })).toBeNull()
    expect(sanitizeProfile('nope')).toBeNull()
  })

  it('derives the shown status from the shared timer', () => {
    const idle = createTimer(TIMER_PROFILES[0], 0)
    const running = transitionTimer(idle, 'start', 0)
    const onBreak = transitionTimer(running, 'skip', 1)
    expect(shownStatus('auto', idle)).toBe('available')
    expect(shownStatus('auto', running)).toBe('focus')
    expect(shownStatus('auto', onBreak)).toBe('break')
    expect(shownStatus('available', running)).toBe('available')
  })
})

describe('invitation links', () => {
  it('keeps the secret in the fragment and round-trips', () => {
    const link = inviteLink('https://komolu.example/app/?x=1#old', ROOM, CODE)
    expect(link).toBe(`https://komolu.example/app/?x=1#join=${ROOM}.${CODE}`)
    expect(new URL(link).search).toBe('?x=1')
    expect(parseInvite(link)).toEqual({ roomId: ROOM, invite: CODE })
    expect(parseInvite(`#join=${ROOM}.${CODE}`)).toEqual({ roomId: ROOM, invite: CODE })
  })

  it('rejects malformed links', () => {
    expect(parseInvite('https://komolu.example/#join=abc.def')).toBeNull()
    expect(parseInvite('nothing here')).toBeNull()
  })
})

describe('instance configuration', () => {
  it('stays local-only unless explicitly enabled', () => {
    expect(parseInstanceConfig(null).collaboration.enabled).toBe(false)
    expect(parseInstanceConfig({ version: 1 }).collaboration.enabled).toBe(false)
    expect(parseInstanceConfig({ collaboration: { enabled: true } }).collaboration).toEqual({
      enabled: true,
      url: 'rooms',
    })
  })

  it('validates the service URL', () => {
    const parse = (url: unknown) =>
      parseInstanceConfig({ collaboration: { enabled: true, url } }).collaboration.url
    expect(parse('wss://rooms.example/rooms')).toBe('wss://rooms.example/rooms')
    expect(parse('/rooms')).toBe('/rooms')
    expect(parse('javascript:alert(1)')).toBe('rooms')
    expect(parse('//evil.example')).toBe('rooms')
  })

  it('uses the build-time URL as a development default the file can override', () => {
    const defaults = buildDefaults('rooms')
    expect(defaults.collaboration.enabled).toBe(true)
    expect(parseInstanceConfig({ version: 1 }, defaults).collaboration.enabled).toBe(true)
    expect(
      parseInstanceConfig({ collaboration: { enabled: false } }, defaults).collaboration.enabled,
    ).toBe(false)
    expect(buildDefaults(undefined).collaboration.enabled).toBe(false)
  })

  it('resolves socket URLs relative to the page, including sub-paths', () => {
    expect(socketUrl('rooms', 'https://a.example/Komolu/#join=x')).toBe(
      'wss://a.example/Komolu/rooms',
    )
    expect(socketUrl('/rooms', 'http://localhost:5173/')).toBe('ws://localhost:5173/rooms')
    expect(socketUrl('wss://b.example/r', 'https://a.example/')).toBe('wss://b.example/r')
  })
})
