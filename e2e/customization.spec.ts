import { chooseOption } from './select-helper'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import legacy from '../src/core/fixtures/v1-backup.json' with { type: 'json' }

async function openStudio(page: Page) {
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  return page.getByRole('complementary', { name: 'Studio de personnalisation' })
}
async function readState(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('komolu')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = db.transaction('state').objectStore('state').get('app')
        request.onsuccess = () => resolve(request.result.data)
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  })
}

test('scenes, independent palette, solid and gradient settings survive reload', async ({
  page,
}) => {
  await page.goto('./')
  const studio = await openStudio(page)
  await studio.getByRole('button', { name: 'Décor', exact: true }).click()
  await chooseOption(studio.getByRole('combobox', { name: 'Scène', exact: true }), 'cozy')
  await expect(studio.getByRole('combobox', { name: 'Scène', exact: true })).toHaveAttribute(
    'data-value',
    'cozy',
  )
  await expect(studio.getByRole('combobox', { name: 'Palette des widgets' })).toHaveAttribute(
    'data-value',
    'minimal',
  )
  await chooseOption(studio.getByRole('combobox', { name: 'Palette des widgets' }), 'deep')
  await expect(page.locator('main.app')).toHaveClass(/scene-deep/)
  await chooseOption(studio.getByRole('combobox', { name: 'Type de fond' }), 'solid')
  await studio.getByLabel('Couleur du fond', { exact: true }).fill('#abcdef')
  await expect(page.locator('.generated-background')).toHaveCSS(
    'background-color',
    'rgb(171, 205, 239)',
  )
  await chooseOption(studio.getByRole('combobox', { name: 'Type de fond' }), 'gradient')
  await studio.getByLabel('Première couleur du dégradé').fill('#123456')
  await expect(page.locator('.generated-background')).toHaveCSS(
    'background-image',
    /rgb\(18, 52, 86\)/,
  )
  await studio.getByLabel('Seconde couleur du dégradé').fill('#789abc')
  await expect(page.locator('.generated-background')).toHaveCSS(
    'background-image',
    /rgb\(120, 154, 188\)/,
  )
  await studio.getByRole('slider', { name: 'Angle du dégradé' }).focus()
  await page.keyboard.press('End')
  await expect(studio.getByRole('slider', { name: 'Angle du dégradé' })).toHaveValue('360')
  await page.keyboard.press('ArrowLeft')
  await expect(studio.getByRole('slider', { name: 'Angle du dégradé' })).toHaveValue('355')
  await studio.getByRole('slider', { name: 'Intensité du voile' }).focus()
  await page.keyboard.press('Home')
  await expect(page.locator('.background-tint')).toHaveCSS('opacity', '0')
  await page.reload()
  await openStudio(page)
  await studio.getByRole('button', { name: 'Décor', exact: true }).click()
  await expect(studio.getByRole('combobox', { name: 'Scène', exact: true })).toHaveAttribute(
    'data-value',
    'cozy',
  )
  await expect(studio.getByRole('combobox', { name: 'Palette des widgets' })).toHaveAttribute(
    'data-value',
    'deep',
  )
  await expect(studio.getByRole('combobox', { name: 'Type de fond' })).toHaveAttribute(
    'data-value',
    'gradient',
  )
  await expect(studio.getByLabel('Couleur du fond', { exact: true })).toHaveCount(0)
  await expect(studio.getByLabel('Première couleur du dégradé')).toHaveValue('#123456')
  await expect(studio.getByLabel('Seconde couleur du dégradé')).toHaveValue('#789abc')
  await expect(studio.getByRole('slider', { name: 'Angle du dégradé' })).toHaveValue('355')
  await expect(studio.getByRole('slider', { name: 'Intensité du voile' })).toHaveValue('0')
})

test('clock colour and shadow persist and the theme colour can be restored', async ({ page }) => {
  await page.goto('./')
  const studio = await openStudio(page)
  await studio.getByRole('button', { name: /^Horloge/ }).click()
  await studio.getByLabel('Couleur de l’horloge', { exact: true }).fill('#804020')
  const clock = page
    .getByRole('article', { name: 'Horloge', exact: true })
    .locator('.clock-content')
  await expect(clock).toHaveCSS('color', 'rgb(128, 64, 32)')
  await chooseOption(studio.getByRole('combobox', { name: 'Ombre de l’horloge' }), 'strong')
  await expect(clock.locator('.clock-time')).not.toHaveCSS('text-shadow', 'none')
  await page.reload()
  await expect(clock).toHaveCSS('color', 'rgb(128, 64, 32)')
  await openStudio(page)
  await studio.getByRole('button', { name: /^Horloge/ }).click()
  await expect(studio.getByRole('combobox', { name: 'Ombre de l’horloge' })).toHaveAttribute(
    'data-value',
    'strong',
  )
  await studio.getByRole('button', { name: 'Couleur du thème' }).click()
  await expect(clock).not.toHaveCSS('color', 'rgb(128, 64, 32)')
})

test('Focus belongs to each workspace and retains a visible start/pause control with the timer hidden', async ({
  page,
}) => {
  await page.goto('./')
  const studio = await openStudio(page)
  await page.getByRole('button', { name: 'Masquer Minuterie', exact: true }).click()
  await studio.getByRole('button', { name: 'Fermer le Studio' }).click()
  await page.getByRole('button', { name: 'Activer le mode Focus', exact: true }).click()
  const navigation = page.getByRole('navigation', { name: 'Commandes du mode Focus' })
  await expect(navigation).toBeVisible()
  await expect(page.getByRole('article', { name: 'Minuterie', exact: true })).toHaveCount(0)
  await navigation.getByRole('button', { name: /Démarrer/ }).click()
  await expect(navigation.getByRole('button', { name: 'Suspendre la session' })).toBeVisible()
  await page.reload()
  await expect(navigation).toBeVisible()
  await navigation.getByRole('button', { name: 'Suspendre la session' }).click()
  // Switch through the keyboard-accessible workspace chooser while staying in Focus.
  await navigation.getByRole('button', { name: /Changer d’espace/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Cozy/ }).click()
  await expect(page.locator('main.app')).not.toHaveClass(/focus-mode/)
  await page.getByRole('button', { name: 'Cozy', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Minimal/ })
    .click()
  await expect(navigation).toBeVisible()
})

test('a real v1 browser database upgrades without losing private text, media or saved options', async ({
  page,
}) => {
  await page.route('**/legacy-seed', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Migration fixture</title>' }),
  )
  await page.goto('./legacy-seed')
  await page.evaluate(async (fixture) => {
    const request = indexedDB.open('komolu', 10) // Dexie v1 maps to native IndexedDB version 10.
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('state', { keyPath: 'id' })
      const media = db.createObjectStore('media', { keyPath: 'id' })
      media.createIndex('kind', 'kind')
      media.createIndex('createdAt', 'createdAt')
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const state = fixture.state
    state.timer.status = 'paused'
    Object.assign(state.timer, { deadline: null, startedAt: null, remainingMs: 900000 })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['state', 'media'], 'readwrite')
      transaction.objectStore('state').put({ id: 'app', data: state })
      for (const item of fixture.media) {
        const { data, ...record } = item
        const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
        transaction
          .objectStore('media')
          .put({ ...record, blob: new Blob([bytes], { type: item.mimeType }) })
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  }, legacy)
  await page.goto('./')
  await expect(page.getByRole('navigation', { name: 'Commandes du mode Focus' })).toBeVisible()
  await expect(page.getByRole('timer')).toContainText('15:00')
  const state = await readState(page)
  expect(state.schemaVersion).toBe(2)
  expect(state.privateData).toEqual(legacy.state.privateData)
  expect(state.dataEpoch).toBe('retained-epoch')
  await page.getByRole('button', { name: 'Quitter le mode Focus', exact: true }).click()
  await page.getByRole('button', { name: 'Préférences', exact: true }).click()
  await page.getByRole('button', { name: 'Sauvegarde et données', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exporter une sauvegarde', exact: true }).click()
  const download = await downloadPromise
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(exported.version).toBe(2)
  expect(exported.state.privateData).toEqual(legacy.state.privateData)
  expect(exported.media.map((item: { data: string }) => item.data).sort()).toEqual(
    legacy.media.map((item) => item.data).sort(),
  )
})

test('storage persistence denial remains informative and never claims a backup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persisted', { value: async () => false })
    Object.defineProperty(navigator.storage, 'persist', { value: async () => false })
  })
  await page.goto('./')
  await page.getByRole('button', { name: 'Préférences', exact: true }).click()
  await page.getByRole('button', { name: 'Sauvegarde et données', exact: true }).click()
  await page.getByText('Protection du stockage local', { exact: true }).click()
  await page.getByRole('button', { name: 'Demander la protection', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Protection non accordée.' }),
  ).toBeVisible()
  await expect(page.getByText(/ne remplace pas une sauvegarde/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Exporter une sauvegarde', exact: true }),
  ).toBeEnabled()
})

test('essential controls reflow at desktop, tablet, phone and a 200 percent zoom equivalent', async ({
  page,
}) => {
  await page.goto('./')
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    // Full-page zoom at 200% on 1366x768 exposes 683x384 CSS pixels.
    // This tests that reflow geometry, not an OS/browser zoom gesture.
    { width: 683, height: 384 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
    await page.getByRole('button', { name: 'Activer le mode Focus', exact: true }).click()
    const toolbar = page.getByRole('navigation', { name: 'Commandes du mode Focus' })
    await expect(toolbar).toBeVisible()
    const bounds = await toolbar.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
    await toolbar.getByRole('button', { name: 'Quitter le mode Focus', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Studio', exact: true })).toBeVisible()
  }
})
