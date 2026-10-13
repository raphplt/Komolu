/** Ambient generators are original synthetic sounds; no network or copyrighted samples. */
export class AmbientAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  async start(volume = 0.2): Promise<void> {
    this.context ??= new AudioContext()
    await this.context.resume()
    if (!this.master) { this.master = this.context.createGain(); this.master.gain.value = 0; this.master.connect(this.context.destination) }
    if (!this.source) {
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 8, this.context.sampleRate)
      const data = buffer.getChannelData(0)
      let last = 0
      for (let i = 0; i < data.length; i++) { last = (last + Math.random() * 0.04 - 0.02) / 1.02; data[i] = last * 3.5 }
      // Taper the seam to avoid a hard discontinuity in the loop.
      const fade = Math.floor(this.context.sampleRate * 0.05)
      for (let i = 0; i < fade; i++) { data[i] *= i / fade; data[data.length - 1 - i] *= i / fade }
      this.source = this.context.createBufferSource(); this.source.buffer = buffer; this.source.loop = true; this.source.connect(this.master); this.source.start()
    }
    this.volume(volume)
  }
  volume(value: number): void { if (this.master && this.context) this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), this.context.currentTime, 0.15) }
  pause(): void { this.volume(0) }
  async dispose(): Promise<void> { this.source?.stop(); this.source = null; await this.context?.close(); this.context = null; this.master = null }
}
export const ambientAudio = new AmbientAudio()
