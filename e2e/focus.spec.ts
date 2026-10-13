import { expect, test } from '@playwright/test'

test('a paused session and its task survive reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Écrire la première page')
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Écrire la première page', exact: true }),
  ).toBeVisible()
  const timer = page.getByRole('timer')
  const initial = await timer.innerText()
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(timer).not.toHaveText(initial, { timeout: 5_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reprendre', exact: true })).toBeVisible()
  const remaining = await timer.innerText()
  await page.reload()
  await expect(timer).toHaveText(remaining)
  await expect(
    page.getByRole('button', { name: 'Écrire la première page', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('two tabs share start and pause without contradicting state', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
  const second = await context.newPage()
  await second.goto('/')
  await expect(second.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(second.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await second.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reprendre', exact: true })).toBeVisible()
  await expect(second.getByRole('timer')).toHaveText(await page.getByRole('timer').innerText())
  await page.reload()
  await expect(page.getByRole('button', { name: 'Reprendre', exact: true })).toBeVisible()
})

test('a suspended tab reconciles the deadline without starting the break automatically', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.clock.fastForward(26 * 60_000)
  await expect(page.getByRole('timer')).toHaveText('05:00')
  await expect(page.getByRole('button', { name: 'Continuer', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('05:00')
  await page.getByRole('button', { name: 'Continuer', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
})

test('private task survives workspace changes and typing does not start shortcuts', async ({
  page,
}) => {
  await page.goto('/')
  const entry = page.getByRole('textbox', { name: 'Nouvelle tâche' })
  await entry.fill('')
  await entry.pressSequentially('n f une pensée privée')
  await expect(entry).toHaveValue('n f une pensée privée')
  await expect(page.getByRole('button', { name: 'Démarrer', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await page.getByRole('button', { name: 'Minimal', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Deep Work', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'n f une pensée privée', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText('50:00')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'n f une pensée privée', exact: true }),
  ).toBeVisible()
})
