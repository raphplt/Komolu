import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SOUND_CATALOG, RECORDING_FRAMES, RECORDING_SAMPLE_RATE } from './sounds'

interface ManifestEntry {
  id: string
  asset: string
  assetSha256: string
  sourceSha256: string
  page: string
  author: string
  license: string[]
  frames: number
  sampleRate: number
  channels: number
}
const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8')) as ManifestEntry[]
describe('redistributed audio catalogue', () => {
  it('ships every recorded source with an exact checksum and its author license evidence', () => {
    const recordings = SOUND_CATALOG.filter((sound) => sound.kind === 'recording')
    expect(SOUND_CATALOG).toHaveLength(9)
    expect(new Set(SOUND_CATALOG.map((sound) => sound.id)).size).toBe(9)
    expect(new Set(manifest.map((item) => item.id))).toEqual(
      new Set(recordings.map((sound) => sound.id)),
    )
    for (const item of manifest) {
      const bytes = readFileSync(`public/${item.asset}`)
      expect(bytes.subarray(0, 4).toString()).toBe('fLaC')
      expect(bytes.length).toBeLessThan(4 * 1024 * 1024)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.assetSha256)
      expect(item.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
      expect(item.page).toMatch(/^https:\/\/(beta\.)?freesound\.org\/people\//)
      expect(item.author.length).toBeGreaterThan(0)
      expect(
        item.license.some((url) => url.endsWith('creativecommons.org/publicdomain/zero/1.0/')),
      ).toBe(true)
      expect(item.frames).toBe(RECORDING_FRAMES)
      expect(item.sampleRate).toBe(RECORDING_SAMPLE_RATE)
      expect(item.channels).toBe(2)
    }
  })
})
