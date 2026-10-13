import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AmbientAudio,
  AUDIO_RESUME_TIMEOUT_MS,
  armCompletionSound,
  completionSoundIsArmed,
  generateSound,
  playCompletionSound,
} from './audio'
import type { AudioProfile, SoundId } from './model'
const { getMedia } = vi.hoisted(() => ({ getMedia: vi.fn() }))
vi.mock('./storage', () => ({ db: { media: { get: getMedia } } }))
class Parameter {
  value = 0
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value
  })
  cancelScheduledValues = vi.fn()
}
class Node {
  connect = vi.fn()
  disconnect = vi.fn()
}
class Gain extends Node {
  gain = new Parameter()
}
class Source extends Node {
  buffer: Buffer | null = null
  loop = false
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
}
class Buffer {
  sampleRate = 1000
  getChannelData = () => new Float32Array(100)
  length = 100
  numberOfChannels = 1
  duration = 1
  copyToChannel = vi.fn()
}
class Context {
  static instances: Context[] = []
  static resumeImplementation: ((context: Context) => Promise<void>) | undefined
  state = 'suspended'
  sampleRate = 1000
  currentTime = 1
  destination = new Node()
  sources: Source[] = []
  gains: Gain[] = []
  constructor() {
    Context.instances.push(this)
  }
  resume = vi.fn(async () => {
    if (Context.resumeImplementation) return Context.resumeImplementation(this)
    this.state = 'running'
  })
  suspend = vi.fn(async () => {
    this.state = 'suspended'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  createGain() {
    const gain = new Gain()
    this.gains.push(gain)
    return gain
  }
  createDynamicsCompressor() {
    return Object.assign(new Node(), {
      threshold: new Parameter(),
      ratio: new Parameter(),
      knee: new Parameter(),
    })
  }
  createBuffer() {
    return new Buffer()
  }
  createBufferSource() {
    const source = new Source()
    this.sources.push(source)
    return source
  }
  decodeAudioData = vi.fn(async () => new Buffer())
}
function profile(): AudioProfile {
  return {
    master: 0.4,
    muted: false,
    tracks: [
      { id: 'brown', source: 'brown', name: 'Bruit brun', enabled: true, volume: 0.5 },
      { id: 'rain', source: 'rain', name: 'Pluie', enabled: true, volume: 0.25 },
    ],
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  Context.instances = []
  Context.resumeImplementation = undefined
  vi.stubGlobal('AudioContext', Context)
  getMedia.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('original ambient textures', () => {
  it('produces finite bounded audio with silent seams and distinct textures', () => {
    const outputs = (['brown', 'rain', 'wind', 'fire', 'waves'] as SoundId[]).map((kind) => {
      let seed = 7
      const random = () => {
        seed = (seed * 16807) % 2147483647
        return seed / 2147483647
      }
      const samples = generateSound(kind, 8000, 2, random)
      expect(samples).toHaveLength(16000)
      expect(Math.abs(samples[0])).toBe(0)
      expect(Math.abs(samples.at(-1)!)).toBe(0)
      expect(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) <= 0.801)).toBe(
        true,
      )
      return samples.reduce((sum, sample) => sum + sample * sample, 0)
    })
    expect(new Set(outputs).size).toBe(5)
    expect(outputs.every((energy) => energy > 0.01)).toBe(true)
  })
})
describe('audio lifecycle', () => {
  it('does not create a context on configuration, starts multiple tracks only on explicit play and preserves gains on mute', async () => {
    const engine = new AmbientAudio(),
      mix = profile()
    await engine.update(mix)
    expect(Context.instances).toHaveLength(0)
    await engine.play(mix)
    const context = Context.instances[0]
    expect(context.sources).toHaveLength(2)
    expect(context.sources.every((source) => source.start.mock.calls.length === 1)).toBe(true)
    await engine.update({ ...mix, muted: true })
    expect(context.gains[0].gain.value).toBe(0)
    expect(context.gains[1].gain.value).toBe(0.5)
    await engine.update(mix)
    expect(context.gains[0].gain.value).toBe(0.4)
    const pause = engine.pause()
    await vi.advanceTimersByTimeAsync(300)
    await pause
    expect(context.state).toBe('suspended')
    expect(engine.playing).toBe(false)
    await engine.dispose()
    expect(context.state).toBe('closed')
  })
  it('a stale pause cannot suspend a newer play request', async () => {
    const engine = new AmbientAudio()
    await engine.play(profile())
    const pause = engine.pause()
    await engine.play(profile())
    await vi.advanceTimersByTimeAsync(300)
    await pause
    expect(Context.instances[0].state).toBe('running')
    expect(engine.playing).toBe(true)
    await engine.dispose()
  })
  it('suspends after pause even when gains change during the fade', async () => {
    const engine = new AmbientAudio()
    await engine.play(profile())
    const pause = engine.pause()
    await engine.update({ ...profile(), muted: true })
    await vi.advanceTimersByTimeAsync(300)
    await pause
    expect(Context.instances[0].state).toBe('suspended')
    await engine.dispose()
  })
  it('ignores decoding which finishes after stop', async () => {
    let resolve!: (value: { kind: 'audio'; blob: Blob }) => void
    getMedia.mockReturnValue(
      new Promise((value) => {
        resolve = value
      }),
    )
    const engine = new AmbientAudio(),
      mix = profile()
    mix.tracks = [
      { id: 'local', source: 'media', mediaId: 'one', name: 'Local', volume: 1, enabled: true },
    ]
    const play = engine.play(mix)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    const stop = engine.stop()
    await vi.advanceTimersByTimeAsync(300)
    await stop
    resolve({ kind: 'audio', blob: new Blob(['x']) })
    await play
    expect(Context.instances[0].sources).toHaveLength(0)
    expect(engine.playing).toBe(false)
    await engine.dispose()
  })
  it('reports missing media while preserving available synthetic tracks', async () => {
    getMedia.mockResolvedValue(undefined)
    const engine = new AmbientAudio(),
      mix = profile()
    mix.tracks.push({
      id: 'gone',
      source: 'media',
      mediaId: 'missing',
      name: 'Mon son',
      enabled: true,
      volume: 1,
    })
    await expect(engine.play(mix)).rejects.toThrow('Mon son : fichier local introuvable')
    expect(Context.instances[0].sources).toHaveLength(2)
    await engine.dispose()
  })
})

describe('unavailable audio output', () => {
  it('rejects a resume that never settles within eight seconds and releases the failed context', async () => {
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const engine = new AmbientAudio()
    const play = engine.play(profile())
    const rejected = expect(play).rejects.toThrow('La sortie audio est indisponible')
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await rejected
    const context = Context.instances[0]
    expect(engine.playing).toBe(false)
    expect(context.sources).toHaveLength(0)
    expect(context.close).toHaveBeenCalledOnce()
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not start stale audio after a timed-out resume resolves, and a new explicit retry works', async () => {
    let resolve!: () => void
    Context.resumeImplementation = (context) =>
      new Promise<void>((done) => {
        resolve = () => {
          context.state = 'running'
          done()
        }
      })
    const engine = new AmbientAudio(),
      first = engine.play(profile())
    const rejected = expect(first).rejects.toThrow('sortie audio')
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await rejected
    Context.resumeImplementation = undefined
    await engine.play(profile())
    resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(Context.instances).toHaveLength(2)
    expect(Context.instances[0].sources).toHaveLength(0)
    expect(Context.instances[0].gains[0].disconnect).toHaveBeenCalledOnce()
    expect(Context.instances[1].sources).toHaveLength(2)
    expect(engine.playing).toBe(true)
    await engine.dispose()
  })
  it('an older pending resume cannot stop a newer successful play on the same context', async () => {
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const engine = new AmbientAudio(),
      first = engine.play(profile())
    Context.resumeImplementation = undefined
    await engine.play(profile())
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await first
    expect(Context.instances[0].close).not.toHaveBeenCalled()
    expect(Context.instances[0].state).toBe('running')
    expect(engine.playing).toBe(true)
    await engine.dispose()
  })
  it('suspends a canceled resume that resolves after the pause fade, with no sources started', async () => {
    let resolve!: () => void
    Context.resumeImplementation = (context) =>
      new Promise<void>((done) => {
        resolve = () => {
          context.state = 'running'
          done()
        }
      })
    const engine = new AmbientAudio(),
      playing = engine.play(profile())
    const paused = engine.pause()
    await vi.advanceTimersByTimeAsync(300)
    await paused
    resolve()
    await playing
    expect(Context.instances[0].state).toBe('suspended')
    expect(Context.instances[0].sources).toHaveLength(0)
    expect(engine.playing).toBe(false)
    await engine.dispose()
  })
  it('keeps profile edits silent during a pending resume and applies the latest gains on success', async () => {
    let resolve!: () => void
    Context.resumeImplementation = (context) =>
      new Promise<void>((done) => {
        resolve = () => {
          context.state = 'running'
          done()
        }
      })
    const engine = new AmbientAudio(),
      playing = engine.play(profile())
    await engine.update({ ...profile(), master: 0.15 })
    expect(Context.instances[0].sources).toHaveLength(0)
    resolve()
    await playing
    expect(Context.instances[0].gains[0].gain.value).toBe(0.15)
    expect(Context.instances[0].sources).toHaveLength(2)
    await engine.dispose()
  })
  it('reports the timeout even when releasing the unavailable device never completes', async () => {
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const engine = new AmbientAudio(),
      playing = engine.play(profile())
    Context.instances[0].close.mockImplementation(() => new Promise<void>(() => undefined))
    const rejected = expect(playing).rejects.toThrow('sortie audio')
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await rejected
    expect(engine.playing).toBe(false)
    expect(Context.instances[0].gains[0].disconnect).toHaveBeenCalledOnce()
  })
  it('does not revive a disposed engine when an outstanding resume times out', async () => {
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const engine = new AmbientAudio(),
      playing = engine.play(profile())
    await engine.dispose()
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await playing
    expect(Context.instances[0].close).toHaveBeenCalledOnce()
    expect(Context.instances[0].sources).toHaveLength(0)
    expect(engine.playing).toBe(false)
  })
  it('times out chime activation without arming, then permits an explicit retry', async () => {
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const arming = armCompletionSound(),
      rejected = expect(arming).rejects.toThrow('sortie audio')
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await rejected
    expect(completionSoundIsArmed()).toBe(false)
    expect(Context.instances[0].close).toHaveBeenCalledOnce()
    Context.resumeImplementation = undefined
    await armCompletionSound()
    expect(completionSoundIsArmed()).toBe(true)
    Context.resumeImplementation = () => new Promise<void>(() => undefined)
    const chime = playCompletionSound(),
      chimeRejected = expect(chime).rejects.toThrow('sortie audio')
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS)
    await chimeRejected
    expect(completionSoundIsArmed()).toBe(false)
    expect(Context.instances[1].close).toHaveBeenCalledOnce()
  })
})
