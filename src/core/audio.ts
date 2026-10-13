import type { AudioProfile, AudioTrack, SoundId } from './model'
import { db } from './storage'
import { MAX_DECODED_AUDIO_BYTES, validateDecodedAudio } from './media'

export const SOUND_NAMES: Record<SoundId, string> = {
  brown: 'Bruit brun',
  rain: 'Pluie douce',
  wind: 'Vent dans les arbres',
  fire: 'Feu de bois',
  waves: 'Vagues lentes',
}
export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
/** Original procedural textures, generated locally. A tapered seam prevents loop clicks. */
export function generateSound(
  kind: SoundId,
  sampleRate: number,
  seconds = 12,
  random = Math.random,
): Float32Array<ArrayBuffer> {
  const data = new Float32Array(Math.floor(sampleRate * seconds))
  let brown = 0,
    low = 0,
    crackle = 0
  for (let i = 0; i < data.length; i++) {
    const noise = random() * 2 - 1,
      t = i / sampleRate
    brown = (brown + noise * 0.018) / 1.018
    low += 0.06 * (noise - low)
    let value = brown * 3
    if (kind === 'rain') value = noise * 0.18 + low * 0.28
    if (kind === 'wind')
      value = (brown * 2 + low * 0.25) * (0.45 + Math.sin((t * Math.PI) / 6) ** 2 * 0.45)
    if (kind === 'waves')
      value = (low * 0.8 + noise * 0.04) * (0.16 + Math.sin((t * Math.PI) / 6) ** 4 * 1.4)
    if (kind === 'fire') {
      if (random() < 0.00012) crackle = random() * 0.6
      crackle *= 0.996
      value = brown * 1.2 + noise * crackle
    }
    data[i] = Math.max(-0.8, Math.min(0.8, value))
  }
  const fade = Math.min(Math.floor(sampleRate * 0.06), Math.floor(data.length / 2))
  for (let i = 0; i < fade; i++) {
    data[i] *= i / fade
    data[data.length - 1 - i] *= i / fade
  }
  return data
}
interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  signature: string
  bytes: number
}
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const signature = (track: AudioTrack) => `${track.source}:${track.mediaId ?? ''}`
/** One-shot AudioBufferSourceNodes are recreated on stop; gain ramps avoid discontinuities.
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
 * https://developer.mozilla.org/en-US/docs/Web/API/GainNode
 */
export class AmbientAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private voices = new Map<string, Voice>()
  private revision = 0
  private desired = false
  private queue: Promise<void> = Promise.resolve()
  private profile: AudioProfile = { master: 0.25, muted: false, tracks: [] }
  get playing() {
    return this.desired
  }
  private initialize(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      if (typeof AudioContext === 'undefined')
        throw new Error('Ce navigateur ne prend pas en charge les ambiances audio.')
      this.context = new AudioContext()
      this.master = this.context.createGain()
      this.master.gain.value = 0
      const limiter = this.context.createDynamicsCompressor()
      limiter.threshold.value = -12
      limiter.ratio.value = 10
      limiter.knee.value = 8
      this.master.connect(limiter)
      limiter.connect(this.context.destination)
    }
    return this.context
  }
  async play(profile: AudioProfile): Promise<void> {
    const context = this.initialize()
    this.desired = true
    const revision = ++this.revision
    // resume is called synchronously in the original click gesture, before decoding.
    try {
      await context.resume()
    } catch {
      this.desired = false
      throw new Error('Le navigateur a bloqué le son. Réessaie avec le bouton Écouter.')
    }
    if (revision !== this.revision) return
    await this.update(profile)
  }
  async update(profile: AudioProfile): Promise<void> {
    this.profile = structuredClone(profile)
    const revision = ++this.revision
    if (!this.desired || !this.context) return
    const task = this.queue.catch(() => undefined).then(() => this.sync(revision))
    this.queue = task
    return task
  }
  private retire(id: string, immediately = false): void {
    const voice = this.voices.get(id)
    if (!voice || !this.context) return
    this.voices.delete(id)
    const now = this.context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0, now, 0.06)
    voice.source.onended = () => {
      voice.source.disconnect()
      voice.gain.disconnect()
      voice.source.buffer = null
    }
    voice.source.stop(immediately ? now : now + 0.3)
  }
  private async sync(revision: number): Promise<void> {
    const context = this.context
    if (!context || !this.master || revision !== this.revision || !this.desired) return
    const profile = this.profile
    this.master.gain.setTargetAtTime(
      profile.muted ? 0 : clampVolume(profile.master),
      context.currentTime,
      0.12,
    )
    const tracks = profile.tracks.filter((track) => track.enabled).slice(0, 8)
    for (const [id, voice] of this.voices)
      if (!tracks.some((track) => track.id === id && signature(track) === voice.signature))
        this.retire(id)
    const errors: string[] = []
    for (const track of tracks) {
      if (revision !== this.revision || !this.desired) return
      let voice = this.voices.get(track.id)
      if (!voice) {
        try {
          let buffer: AudioBuffer
          if (track.source === 'media') {
            const media = await db.media.get(track.mediaId ?? '')
            if (!media || media.kind !== 'audio') throw new Error('fichier local introuvable')
            buffer = await context.decodeAudioData(await media.blob.arrayBuffer())
            validateDecodedAudio(buffer)
            const fade = Math.min(
              Math.floor(buffer.sampleRate * 0.03),
              Math.floor(buffer.length / 2),
            )
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const samples = buffer.getChannelData(channel)
              for (let i = 0; i < fade; i++) {
                samples[i] *= i / fade
                samples[samples.length - 1 - i] *= i / fade
              }
            }
          } else {
            const samples = generateSound(track.source, context.sampleRate)
            buffer = context.createBuffer(1, samples.length, context.sampleRate)
            buffer.copyToChannel(samples, 0)
          }
          if (revision !== this.revision || !this.desired || context !== this.context) return
          const bytes = buffer.length * buffer.numberOfChannels * 4
          if (
            Array.from(this.voices.values()).reduce((sum, item) => sum + item.bytes, 0) + bytes >
            MAX_DECODED_AUDIO_BYTES
          )
            throw new Error('mix trop volumineux : désactive une piste importée')
          const gain = context.createGain()
          gain.gain.value = 0
          gain.connect(this.master)
          const source = context.createBufferSource()
          source.buffer = buffer
          source.loop = true
          source.connect(gain)
          source.start()
          voice = { source, gain, signature: signature(track), bytes }
          this.voices.set(track.id, voice)
        } catch (error) {
          errors.push(
            `${track.name} : ${error instanceof Error ? error.message : 'lecture impossible'}.`,
          )
          continue
        }
      }
      voice.gain.gain.setTargetAtTime(clampVolume(track.volume), context.currentTime, 0.12)
    }
    if (errors.length) throw new Error(errors.join(' '))
  }
  async pause(): Promise<void> {
    this.desired = false
    ++this.revision
    const context = this.context
    this.master?.gain.setTargetAtTime(0, context?.currentTime ?? 0, 0.06)
    await delay(300)
    if (!this.desired && context === this.context && context?.state === 'running')
      await context.suspend()
  }
  async stop(): Promise<void> {
    await this.pause()
    if (this.desired) return
    for (const id of this.voices.keys()) this.retire(id, true)
  }
  async dispose(): Promise<void> {
    this.desired = false
    ++this.revision
    const context = this.context
    for (const id of this.voices.keys()) this.retire(id, true)
    this.context = null
    this.master = null
    if (context && context.state !== 'closed') await context.close()
  }
  // Legacy vertical-slice API, retained until the App integration lands.
  async start(volume = 0.2) {
    await this.play({
      master: volume,
      muted: false,
      tracks: [{ id: 'brown', source: 'brown', name: 'Bruit brun', enabled: true, volume: 1 }],
    })
  }
  volume(value: number) {
    this.profile.master = clampVolume(value)
    this.master?.gain.setTargetAtTime(value, this.context?.currentTime ?? 0, 0.12)
  }
}
export const ambientAudio = new AmbientAudio()
let chimeContext: AudioContext | null = null
let chimeArmed = false
let chimeVersion = 0
export async function armCompletionSound(): Promise<void> {
  if (typeof AudioContext === 'undefined') return
  chimeContext ??= new AudioContext()
  await chimeContext.resume()
  chimeArmed = true
  await chimeContext.suspend()
}
export function completionSoundIsArmed(): boolean {
  return chimeArmed
}
export async function playCompletionSound(): Promise<void> {
  if (!chimeArmed || !chimeContext) return
  const context = chimeContext,
    version = ++chimeVersion
  await context.resume()
  for (const [frequency, offset] of [
    [523.25, 0],
    [783.99, 0.18],
  ]) {
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      start = context.currentTime + offset
    oscillator.frequency.value = frequency
    gain.gain.value = 0
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(start)
    oscillator.stop(start + 1.2)
  }
  await delay(1600)
  if (version === chimeVersion && context.state === 'running') await context.suspend()
}
