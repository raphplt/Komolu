import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('the initial focus space has no serious accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
})

for (const scene of ['Cozy', 'Deep Work']) {
  test(`${scene} has no WCAG accessibility violations`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Minimal', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${scene} .+`) }).click()
    await expect(page.getByRole('button', { name: scene, exact: true })).toBeVisible()
    const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
  })
}

test('Studio and timer dialog expose accessible controls', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Studio', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Studio de personnalisation' })).toBeVisible()
  let report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
  await page.getByRole('button', { name: 'Fermer le Studio' }).click()
  await page.getByRole('button', { name: 'Régler la minuterie' }).click()
  report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(report.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
})

test('mobile focus remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Une intention mobile')
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Une intention mobile', exact: true })).toBeVisible()
})
