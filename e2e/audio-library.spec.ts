import { expect, test } from '@playwright/test'

test('bundled field recordings decode as exact loops with consistent levels in this browser', async ({
  page,
}) => {
  await page.goto('./')
  const measurements = await page.evaluate(async () => {
    const definitions = (await (await fetch('./audio/manifest.json')).json()) as {
      id: string
      asset: string
    }[]
    const results = []
    for (const definition of definitions) {
      const response = await fetch(`./${definition.asset}`)
      if (!response.ok) throw new Error(`Missing ${definition.id}`)
      const buffer = await new OfflineAudioContext(2, 1, 32_000).decodeAudioData(
        await response.arrayBuffer(),
      )
      let square = 0,
        peak = 0,
        edgeSquare = 0
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel)
        for (let index = 0; index < samples.length; index++) {
          square += samples[index] ** 2
          peak = Math.max(peak, Math.abs(samples[index]))
          if (index < 320 || index >= samples.length - 320) edgeSquare += samples[index] ** 2
        }
      }
      const mean = square / (buffer.length * buffer.numberOfChannels)
      results.push({
        id: definition.id,
        frames: buffer.length,
        channels: buffer.numberOfChannels,
        rate: buffer.sampleRate,
        rms: 10 * Math.log10(mean),
        peak,
        edgeDb: 10 * Math.log10(edgeSquare / (640 * buffer.numberOfChannels)),
      })
    }
    return results
  })
  expect(measurements).toHaveLength(7)
  for (const sound of measurements) {
    expect(sound.frames, sound.id).toBe(640_000)
    expect(sound.channels, sound.id).toBe(2)
    expect(sound.rate, sound.id).toBe(32_000)
    expect(sound.rms, sound.id).toBeCloseTo(-22, 1)
    expect(sound.peak, sound.id).toBeLessThanOrEqual(0.501)
    expect(sound.edgeDb, sound.id).toBeGreaterThan(-36)
  }
})

test('nine enabled native tracks all start after the user gesture, without external audio requests', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as Window & { komoluStartedSources: number }
    state.komoluStartedSources = 0
    const original = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function () {
      const source = original.call(this),
        start = source.start.bind(source)
      source.start = (...args) => {
        state.komoluStartedSources++
        start(...args)
      }
      return source
    }
  })
  const recordings: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('.flac')) recordings.push(request.url())
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Ouvrir les ambiances' }).click()
  const dialog = page.getByRole('dialog')
  const names = [
    'Bruit brun',
    'Bruit blanc',
    'Pluie',
    'Tonnerre',
    'Vent',
    'Feu',
    'Forêt',
    'Café',
    'Vagues',
  ]
  for (const name of names) {
    const button = dialog.getByRole('button', { name, exact: true })
    if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  expect(recordings).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Écouter', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause audio', exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { komoluStartedSources: number }).komoluStartedSources,
      ),
    )
    .toBe(9)
  expect(recordings).toHaveLength(7)
  const origin = new URL(page.url()).origin
  expect(recordings.every((url) => new URL(url).origin === origin)).toBe(true)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Arrêter les sons' }).click()
  await expect(dialog.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible()
})

test('a failed replacement mix returns the transport to listen and supports retry', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Ouvrir les ambiances' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Écouter', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause audio', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Bruit brun', exact: true }).click()
  await page.route('**/audio/rain.flac', (route) => route.fulfill({ status: 404 }))
  await dialog.getByRole('button', { name: 'Pluie', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('enregistrement indisponible')
  await expect(dialog.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible()
  await page.unroute('**/audio/rain.flac')
  await dialog.getByRole('button', { name: 'Réessayer les sons', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause audio', exact: true })).toBeVisible()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Arrêter les sons' }).click()
})
