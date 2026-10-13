import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// A fresh, disposable context: never reads a person's browser profile.
const browser = await chromium.launch({ args: ['--mute-audio'] })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'fr-FR',
})
const page = await context.newPage()
await mkdir('docs/screenshots', { recursive: true })
await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080/')
await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
for (const title of [
  'Relire le chapitre 3',
  'Corriger les exemples',
  'Préparer la bibliographie',
]) {
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill(title)
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
}
await page.getByRole('button', { name: 'Corriger les exemples', exact: true }).click()
await page
  .getByRole('textbox', { name: 'Bloc-notes' })
  .fill(
    'Chapitre 3\n\nVérifier la source du deuxième exemple.\nAjouter une référence en conclusion.',
  )
await page.getByRole('heading', { level: 1 }).click()
await expect(page.getByRole('status').filter({ hasText: 'Enregistré ici' })).toBeVisible()
await page.screenshot({ path: 'docs/screenshots/minimal.png', fullPage: true })
await page.getByRole('button', { name: 'Minimal', exact: true }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Cozy', exact: true }).click()
await expect(page.getByRole('dialog')).toHaveCount(0)
await expect(page.locator('main.app')).toHaveClass(/scene-cozy/)
await page.screenshot({ path: 'docs/screenshots/cozy.png', fullPage: true })
await page.getByRole('button', { name: 'Cozy', exact: true }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Deep Work', exact: true }).click()
await expect(page.getByRole('dialog')).toHaveCount(0)
await expect(page.locator('main.app')).toHaveClass(/scene-deep/)
await page.screenshot({ path: 'docs/screenshots/deep.png', fullPage: true })
await page.getByRole('button', { name: 'Deep Work', exact: true }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Minimal', exact: true }).click()
await page.getByRole('button', { name: 'Studio', exact: true }).click()
await page
  .getByRole('complementary', { name: 'Studio de personnalisation' })
  .getByRole('button', { name: /^Horloge/ })
  .click()
await page.screenshot({ path: 'docs/screenshots/studio.png', fullPage: true })
await page.getByRole('button', { name: 'Fermer le Studio' }).click()
await page.getByRole('button', { name: 'Activer le mode Focus' }).click()
await expect(page.getByRole('navigation', { name: 'Commandes du mode Focus' })).toBeVisible()
await page.screenshot({ path: 'docs/screenshots/focus.png', fullPage: true })
await page.getByRole('button', { name: 'Quitter le mode Focus' }).click()
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: 'docs/screenshots/mobile.png', fullPage: true })
await browser.close()
