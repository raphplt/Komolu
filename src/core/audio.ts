import type { AudioProfile, AudioTrack, SoundId } from './model'
import { db } from './storage'
import { MAX_DECODED_AUDIO_BYTES, MAX_MEDIA_BYTES, validateDecodedAudio } from './media'

import { SOUND_CATALOG, RECORDING_FRAMES, RECORDING_SAMPLE_RATE, recordingUrl } from './sounds'
export { SOUND_NAMES } from './sounds'

export const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
/** Only white/brown noise is synthesized. Natural ambiences use licensed recordings. */
export function generateSound(
  kind: 'brown' | 'white',
  sampleRate: number,
  seconds = 12,
  random = Math.random,
): Float32Array<ArrayBuffer> {
  const data = new Float32Array(Math.floor(sampleRate * seconds))
  let brown = 0
  for (let i = 0; i < data.length; i++) {
    const noise = random() * 2 - 1
    brown = (brown + noise * 0.018) / 1.018
    data[i] = kind === 'white' ? noise * 0.1375 : brown * 1.5
  }
  // Match the low-frequency baseline over 50 ms, without a periodic fade to silence.
  if (kind === 'brown') {
    const fade = Math.min(Math.floor(sampleRate * 0.05), data.length)
    const offset = data[data.length - 1] - data[0]
    for (let i = 0; i < fade; i++) data[i] += offset * (1 - i / fade)
  }
  return data
}
export const AUDIO_LOAD_TIMEOUT_MS = 15_000
const MIX_LIMIT_ERROR =
  'mix trop volumineux (64 Mio maximum) : désactive une piste ou choisis un son personnel plus court'
interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  signature: string
  bytes: number
}
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const signature = (track: AudioTrack) => `${track.source}:${track.mediaId ?? ''}`
export const AUDIO_RESUME_TIMEOUT_MS = 8_000
const AUDIO_OUTPUT_ERROR =
  'La sortie audio est indisponible ou le navigateur bloque le son. Vérifie la sortie audio de ton appareil et les autorisations du site, puis réessaie avec Écouter.'
/** Some browsers leave resume pending when no output device is available. */
async function resumeAudio(context: AudioContext): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      context.resume(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(AUDIO_OUTPUT_ERROR)), AUDIO_RESUME_TIMEOUT_MS)
      }),
    ])
  } catch {
    throw new Error(AUDIO_OUTPUT_ERROR)
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}
/** One-shot AudioBufferSourceNodes are recreated on stop; gain ramps avoid discontinuities.
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
 * https://developer.mozilla.org/en-US/docs/Web/API/GainNode
 */
export class AmbientAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private voices = new Map<string, Voice>()
  private loading: AbortController | null = null
  private retiring = new Set<Voice>()
  private pendingDecodeBytes = 0
  private revision = 0
  private transportRevision = 0
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
    this.profile = structuredClone(profile)
    ++this.revision
    const transport = ++this.transportRevision
    // resume is called synchronously in the original click gesture, before decoding.
    try {
      await resumeAudio(context)
    } catch (error) {
      if (transport !== this.transportRevision || context !== this.context) {
        if (context === this.context && !this.desired) void this.dispose().catch(() => undefined)
        return
      }
      // Disconnect synchronously; closing a broken device must not delay the visible error.
      void this.dispose().catch(() => undefined)
      throw error
    }
    if (transport !== this.transportRevision || context !== this.context || !this.desired) {
      if (context === this.context && !this.desired && context.state === 'running')
        await context.suspend()
      return
    }
    await this.update(this.profile)
  }
  async update(profile: AudioProfile): Promise<void> {
    this.profile = structuredClone(profile)
    const revision = ++this.revision
    this.loading?.abort()
    if (!this.desired || !this.context || this.context.state !== 'running') return
    const task = this.queue.catch(() => undefined).then(() => this.sync(revision))
    this.queue = task
    return task
  }
  private retire(id: string, immediately = false): void {
    const voice = this.voices.get(id)
    if (!voice || !this.context) return
    this.voices.delete(id)
    this.retiring.add(voice)
    const now = this.context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0, now, 0.06)
    voice.source.onended = () => {
      this.retiring.delete(voice)
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
    const tracks = profile.tracks.filter((track) => track.enabled)
    for (const [id, voice] of this.voices)
      if (!tracks.some((track) => track.id === id && signature(track) === voice.signature))
        this.retire(id)
    const errors: string[] = []
    for (const track of tracks) {
      if (revision !== this.revision || !this.desired || context !== this.context) return
      let voice = this.voices.get(track.id)
      if (!voice) {
        try {
          let buffer: AudioBuffer
          if (track.source === 'media') {
            const media = await db.media.get(track.mediaId ?? '')
            if (!media || media.kind !== 'audio') throw new Error('fichier local introuvable')
            if (revision !== this.revision || !this.desired || context !== this.context) return
            if (media.blob.size > MAX_MEDIA_BYTES) throw new Error('fichier audio trop volumineux')
            buffer = await this.loadBuffer(async (signal) => {
              const url = URL.createObjectURL(media.blob)
              const metadata = document.createElement('audio')
              try {
                const duration = await new Promise<number>((resolve, reject) => {
                  metadata.preload = 'metadata'
                  metadata.onloadedmetadata = () => resolve(metadata.duration)
                  metadata.onerror = () => reject(new Error('fichier audio illisible'))
                  signal.addEventListener('abort', () => reject(new Error('chargement annulé')), {
                    once: true,
                  })
                  metadata.src = url
                })
                if (!Number.isFinite(duration) || duration <= 0 || duration > 120)
                  throw new Error('durée audio invalide (2 minutes maximum)')
                this.checkBudget(Math.ceil(duration * RECORDING_SAMPLE_RATE) * 2 * 4)
                if (signal.aborted) throw new Error('chargement annulé')
                const decoded = await this.decodeBuffer(
                  await media.blob.arrayBuffer(),
                  Math.ceil(duration * RECORDING_SAMPLE_RATE) * 2 * 4,
                )
                validateDecodedAudio(decoded)
                return decoded
              } finally {
                metadata.onloadedmetadata = null
                metadata.onerror = null
                metadata.removeAttribute('src')
                metadata.load()
                URL.revokeObjectURL(url)
              }
            })
          } else if (track.source === 'brown' || track.source === 'white') {
            this.checkBudget(Math.floor(context.sampleRate * 12) * 4)
            const samples = generateSound(track.source, context.sampleRate)
            buffer = context.createBuffer(1, samples.length, context.sampleRate)
            buffer.copyToChannel(samples, 0)
          } else {
            if (
              !SOUND_CATALOG.some(
                (sound) => sound.id === track.source && sound.kind === 'recording',
              )
            )
              throw new Error('son inconnu')
            this.checkBudget(RECORDING_FRAMES * 2 * 4)
            buffer = await this.loadBuffer(async (signal) => {
              const response = await fetch(recordingUrl(track.source as SoundId), { signal })
              if (!response.ok)
                throw new Error('enregistrement indisponible ; réessaie avec une connexion active')
              const declaredBytes = Number(response.headers?.get('Content-Length'))
              if (declaredBytes > 4 * 1024 * 1024) throw new Error('enregistrement invalide')
              const encoded = await response.arrayBuffer()
              if (encoded.byteLength > 4 * 1024 * 1024) throw new Error('enregistrement invalide')
              if (signal.aborted) throw new Error('chargement annulé')
              const decoded = await this.decodeBuffer(encoded, RECORDING_FRAMES * 2 * 4)
              if (
                decoded.length !== RECORDING_FRAMES ||
                decoded.numberOfChannels !== 2 ||
                decoded.sampleRate !== RECORDING_SAMPLE_RATE
              )
                throw new Error('enregistrement incompatible ou corrompu')
              return decoded
            })
          }
          if (revision !== this.revision || !this.desired || context !== this.context) return
          const bytes = buffer.length * buffer.numberOfChannels * 4
          this.checkBudget(bytes)
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
          if (revision !== this.revision || !this.desired || context !== this.context) return
          errors.push(
            `${track.name} : ${error instanceof Error ? error.message : 'lecture impossible'}.`,
          )
          continue
        }
      }
      voice.gain.gain.setTargetAtTime(clampVolume(track.volume), context.currentTime, 0.12)
    }
    if (errors.length) {
      if (!this.voices.size) {
        this.desired = false
        void context.suspend().catch(() => undefined)
      }
      throw new Error(errors.join(' '))
    }
  }
  private async decodeBuffer(encoded: ArrayBuffer, reserveBytes: number): Promise<AudioBuffer> {
    this.checkBudget(reserveBytes)
    this.pendingDecodeBytes += reserveBytes
    try {
      // decodeAudioData cannot be canceled: keep its reservation even after timeout or dispose.
      return await new OfflineAudioContext(2, 1, RECORDING_SAMPLE_RATE).decodeAudioData(encoded)
    } finally {
      this.pendingDecodeBytes -= reserveBytes
    }
  }
  private async loadBuffer(
    load: (signal: AbortSignal) => Promise<AudioBuffer>,
  ): Promise<AudioBuffer> {
    const controller = new AbortController()
    this.loading = controller
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        load(controller.signal),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error('chargement trop long ; vérifie ta connexion puis réessaie'))
            controller.abort()
          }, AUDIO_LOAD_TIMEOUT_MS)
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error('chargement annulé')),
            { once: true },
          )
        }),
      ])
    } finally {
      clearTimeout(timeout)
      if (this.loading === controller) this.loading = null
    }
  }
  private checkBudget(bytes: number): void {
    const allocated = Array.from(this.voices.values()).reduce(
      (sum, voice) => sum + voice.bytes,
      Array.from(this.retiring).reduce((sum, voice) => sum + voice.bytes, this.pendingDecodeBytes),
    )
    if (allocated + bytes > MAX_DECODED_AUDIO_BYTES) throw new Error(MIX_LIMIT_ERROR)
  }
  async pause(): Promise<void> {
    this.loading?.abort()
    ++this.transportRevision
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
    this.loading?.abort()
    ++this.transportRevision
    this.desired = false
    ++this.revision
    const context = this.context
    for (const id of this.voices.keys()) this.retire(id, true)
    for (const voice of this.retiring) {
      voice.source.disconnect()
      voice.gain.disconnect()
      voice.source.buffer = null
    }
    this.retiring.clear()
    this.master?.disconnect()
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
function abandonChimeContext(context: AudioContext): void {
  chimeArmed = false
  chimeContext = null
  ++chimeVersion
  // No oscillators were started before resume succeeded; do not await a faulty device.
  void context.close().catch(() => undefined)
}
export async function armCompletionSound(): Promise<void> {
  if (typeof AudioContext === 'undefined') return
  chimeContext ??= new AudioContext()
  const context = chimeContext,
    version = ++chimeVersion
  try {
    await resumeAudio(context)
  } catch (error) {
    if (version !== chimeVersion || context !== chimeContext) return
    abandonChimeContext(context)
    throw error
  }
  if (version !== chimeVersion || context !== chimeContext) return
  chimeArmed = true
  await context.suspend()
}
export function completionSoundIsArmed(): boolean {
  return chimeArmed
}
export async function playCompletionSound(): Promise<void> {
  if (!chimeArmed || !chimeContext) return
  const context = chimeContext,
    version = ++chimeVersion
  try {
    await resumeAudio(context)
  } catch (error) {
    if (version !== chimeVersion || context !== chimeContext) return
    abandonChimeContext(context)
    throw error
  }
  if (version !== chimeVersion || context !== chimeContext) return
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
