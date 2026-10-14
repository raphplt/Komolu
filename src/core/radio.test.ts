import { afterEach, describe, expect, it, vi } from 'vitest'
import { RadioPlayer, RADIO_STATIONS } from './radio'
class MockAudio {
  src = ''
  volume = 1
  preload = ''
  onplaying: (() => void) | null = null
  onwaiting: (() => void) | null = null
  onstalled: (() => void) | null = null
  onerror: (() => void) | null = null
  onended: (() => void) | null = null
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  load = vi.fn()
  removeAttribute = vi.fn(() => {
    this.src = ''
  })
}
function setup() {
  const elements: MockAudio[] = []
  const player = new RadioPlayer(() => {
    const audio = new MockAudio()
    elements.push(audio)
    return audio as unknown as HTMLAudioElement
  })
  return { player, elements }
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('radio', () => {
  it('never loads any remote media before explicit playback, including station changes', () => {
    const { player, elements } = setup()
    player.select('neofm')
    player.setVolume(0.7)
    expect(elements).toHaveLength(0)
    expect(player.getSnapshot().status).toBe('stopped')
  })
  it('releases stream on stop and rejects late events/promises', async () => {
    const { player, elements } = setup()
    player.play()
    const audio = elements[0]
    const latePlaying = audio.onplaying
    player.stop()
    latePlaying?.()
    await Promise.resolve()
    expect(player.getSnapshot().status).toBe('stopped')
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.src).toBe('')
  })
  it('switches station without autoplay and ignores old errors', () => {
    const { player, elements } = setup()
    player.play()
    const lateError = elements[0].onerror
    player.select('neofm')
    lateError?.()
    expect(elements).toHaveLength(1)
    expect(player.getSnapshot()).toMatchObject({
      stationId: 'neofm',
      status: 'stopped',
      error: null,
    })
    player.dispose()
  })
  it('times out buffering even when repeated stalled events arrive, then retries', () => {
    vi.useFakeTimers()
    const { player, elements } = setup()
    player.play()
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(4000)
      elements[0].onstalled?.()
    }
    expect(player.getSnapshot().status).toBe('error')
    expect(elements[0].src).toBe('')
    player.play()
    elements[1].onplaying?.()
    vi.advanceTimersByTime(16000)
    expect(player.getSnapshot().status).toBe('playing')
    player.dispose()
  })
  it('bounds volume and handles rejected play without unhandled rejection', async () => {
    const audio = new MockAudio()
    audio.play.mockRejectedValueOnce(new Error('blocked'))
    const player = new RadioPlayer(() => audio as unknown as HTMLAudioElement)
    player.setVolume(5)
    player.play()
    await Promise.resolve()
    expect(audio.volume).toBe(1)
    expect(player.getSnapshot().status).toBe('error')
    player.setVolume(NaN)
    expect(player.getSnapshot().volume).toBe(1)
  })
  it('restores only valid settings, never playing, and resets preferences with data', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ stationId: 'neofm', volume: 0.8, status: 'playing' }),
      setItem: vi.fn(),
    })
    const { player, elements } = setup()
    expect(player.getSnapshot()).toMatchObject({
      stationId: 'neofm',
      volume: 0.8,
      status: 'stopped',
    })
    expect(elements).toHaveLength(0)
    player.reset()
    expect(player.getSnapshot()).toMatchObject({ stationId: 'chillhop', volume: 0.35 })
    player.dispose()
  })
  it('has a true classical station and HTTPS sources only', () => {
    expect(RADIO_STATIONS.some((s) => s.genre.startsWith('Classique'))).toBe(true)
    for (const s of RADIO_STATIONS) expect(s.url).toMatch(/^https:\/\//)
  })
})
