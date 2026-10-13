import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

test('the served app starts a session and audio without external requests or browser errors', async ({
  page,
  baseURL,
}) => {
  const externalRequests: string[] = []
  const browserErrors: string[] = []
  const expectedOrigin = new URL(baseURL!).origin
  page.on('request', (request) => {
    const url = new URL(request.url())
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== expectedOrigin)
      externalRequests.push(request.url())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  await page.addInitScript(() => {
    const target = window as Window & { __cspViolations: string[] }
    target.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      target.__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`)
    })
  })
  // Relative navigation also verifies deployments hosted beneath /Komolu/.
  const response = await page.goto('./')
  expect(response?.status()).toBe(200)
  await page
    .getByRole('textbox', { name: 'Nouvelle tâche', exact: true })
    .fill('Une session entièrement locale')
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Une session entièrement locale', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir les ambiances', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Écouter', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Pause audio', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Arrêter les sons', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Écouter', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await page.waitForLoadState('networkidle')
  expect(externalRequests).toEqual([])
  expect(browserErrors).toEqual([])
  expect(
    await page.evaluate(() => (window as Window & { __cspViolations: string[] }).__cspViolations),
  ).toEqual([])
})

test('local video loops silently and pauses when reduced motion is saved and reloaded', async ({
  page,
  baseURL,
}) => {
  const externalRequests: string[] = []
  const expectedOrigin = new URL(baseURL!).origin
  page.on('request', (request) => {
    const url = new URL(request.url())
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== expectedOrigin)
      externalRequests.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Décor', exact: true }).click()
  await page
    .getByLabel('Importer une image ou vidéo', { exact: true })
    .setInputFiles(fileURLToPath(new URL('./fixtures/quiet-sage.webm', import.meta.url)))
  const video = page.locator('video.local-background-media')
  await expect(video).toBeVisible()
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2)
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused))
    .toBe(false)
  expect(await video.evaluate((element) => (element as HTMLVideoElement).muted)).toBe(true)
  expect(await video.evaluate((element) => (element as HTMLVideoElement).loop)).toBe(true)
  const firstTime = await video.evaluate((element) => (element as HTMLVideoElement).currentTime)
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime))
    .not.toBe(firstTime)
  await page.getByRole('button', { name: 'Fermer le Studio', exact: true }).click()
  await page.getByRole('button', { name: 'Préférences', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Réduire les mouvements', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Réduire les mouvements', exact: true }),
  ).toBeChecked()
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused))
    .toBe(true)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(video).toBeVisible()
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2)
  await expect
    .poll(() => video.evaluate((element) => (element as HTMLVideoElement).paused))
    .toBe(true)
  await page.getByRole('button', { name: 'Préférences', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Réduire les mouvements', exact: true }),
  ).toBeChecked()
  expect(externalRequests).toEqual([])
})
