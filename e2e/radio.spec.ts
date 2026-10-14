import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Deterministic transport: no network and no sound; browser output is also muted.
    class SilentRadio {
      src = ''
      volume = 1
      preload = ''
      onplaying: (() => void) | null = null
      onwaiting: (() => void) | null = null
      onstalled: (() => void) | null = null
      onerror: (() => void) | null = null
      onended: (() => void) | null = null
      play() {
        queueMicrotask(() => this.onplaying?.())
        return Promise.resolve()
      }
      pause() {}
      load() {}
      removeAttribute() {
        this.src = ''
      }
    }
    Object.assign(window, { Audio: SilentRadio })
  })
})

test('radio stays opt-in, stops on station change, keeps preferences but not playback', async ({
  page,
  baseURL,
}) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith(new URL(baseURL!).origin))
      external.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('À l’arrêt')
  await page.getByRole('button', { name: 'Radio Swiss Classic' }).click()
  await expect(page.getByRole('button', { name: 'Écouter la radio', exact: true })).toBeVisible()
  expect(external).toEqual([])
  await page.getByRole('button', { name: 'Écouter la radio', exact: true }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('En direct')
  await page.getByRole('slider', { name: 'Volume radio' }).fill('17')
  await page.getByRole('button', { name: 'neoFM' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('À l’arrêt')
  await page.getByRole('button', { name: 'Écouter la radio', exact: true }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('En direct')
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('À l’arrêt')
  await expect(page.getByRole('button', { name: 'neoFM' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Volume radio' })).toHaveValue('17')
})

test('transport remains accessible in Focus and survives closing the panel', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la radio' }).click()
  await page.getByRole('button', { name: 'Écouter la radio', exact: true }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('En direct')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Radio active')).toBeVisible()
  await page.getByRole('button', { name: 'Activer le mode Focus' }).click()
  await page.getByRole('button', { name: 'Ouvrir la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('En direct')
  await page.getByRole('button', { name: 'Arrêter la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('À l’arrêt')
})

test('failed stream exposes retry, cancellation releases a pending connection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let tries = 0
    const Base = window.Audio
    window.Audio = class extends Base {
      play() {
        tries++
        if (tries === 1) return Promise.reject(new Error('offline'))
        // A pending connection; explicit stop must leave a stopped UI.
        return new Promise<void>(() => {})
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la radio' }).click()
  await page.getByRole('button', { name: 'Écouter la radio', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('La lecture n’a pas démarré')
  await page.getByRole('button', { name: 'Réessayer la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('Connexion…')
  await page.getByRole('button', { name: 'Arrêter la radio' }).click()
  await expect(page.locator('.radio-now [role=status]')).toHaveText('À l’arrêt')
})
