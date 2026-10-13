import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// A fresh, disposable context: never reads a person's browser profile.
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'fr-FR',
})
const page = await context.newPage()
await mkdir('docs/screenshots', { recursive: true })
await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080/')
await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
for (const title of [
  'Dessiner les premières idées',
  'Prendre le temps de relire',
  'Faire une pause dehors',
]) {
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill(title)
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
}
await page.getByRole('button', { name: 'Prendre le temps de relire', exact: true }).click()
await page
  .getByRole('textbox', { name: 'Bloc-notes' })
  .fill(
    'Une idée à la fois.\n\nGarder de la place pour ce qui compte.\nCommencer petit, et laisser venir la suite.',
  )
await page.getByRole('heading', { level: 1 }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'docs/screenshots/minimal.png', fullPage: true })
await page.getByRole('button', { name: 'Minimal', exact: true }).click()
await page
  .getByRole('dialog')
  .getByRole('button', { name: /^Cozy .+/ })
  .click()
await expect(page.getByRole('dialog')).toHaveCount(0)
await expect(page.locator('main.app')).toHaveClass(/scene-cozy/)
await page.screenshot({ path: 'docs/screenshots/cozy.png', fullPage: true })
await page.getByRole('button', { name: 'Cozy', exact: true }).click()
await page
  .getByRole('dialog')
  .getByRole('button', { name: /^Deep Work .+/ })
  .click()
await expect(page.getByRole('dialog')).toHaveCount(0)
await expect(page.locator('main.app')).toHaveClass(/scene-deep/)
await page.screenshot({ path: 'docs/screenshots/deep.png', fullPage: true })
await page.getByRole('button', { name: 'Deep Work', exact: true }).click()
await page
  .getByRole('dialog')
  .getByRole('button', { name: /^Minimal .+/ })
  .click()
await page.getByRole('button', { name: 'Studio', exact: true }).click()
await page
  .getByRole('complementary', { name: 'Studio de personnalisation' })
  .getByRole('button', { name: /^Horloge/ })
  .click()
await page.screenshot({ path: 'docs/screenshots/studio.png', fullPage: true })
await page.getByRole('button', { name: 'Studio', exact: true }).click()
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true })
await browser.close()
