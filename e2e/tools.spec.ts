import { expect, test } from '@playwright/test'

test('notes keep the latest rapid edit after blur and across spaces', async ({ page }) => {
  await page.goto('/')
  const notes = page.getByRole('textbox', { name: 'Bloc-notes', exact: true })
  await notes.fill('Premier jet')
  await notes.press('Tab')
  await notes.fill('Premier jet, puis la version à conserver')
  await notes.press('Tab')
  await expect(notes).toHaveValue('Premier jet, puis la version à conserver')
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré ici' })).toBeVisible()
  await page.getByRole('button', { name: 'Minimal', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Cozy .+/ })
    .click()
  await expect(notes).toHaveValue('Premier jet, puis la version à conserver')
  await page.reload()
  await expect(notes).toHaveValue('Premier jet, puis la version à conserver')
})

test('thought shortcut opens capture outside fields and converts it to a task', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('timer')).toBeVisible()
  await page.locator('h1').click()
  await page.keyboard.press('n')
  const capture = page.getByRole('textbox', { name: 'Nouvelle pensée', exact: true })
  await expect(capture).toBeFocused()
  await capture.pressSequentially('n f penser au prochain chapitre')
  await expect(capture).toHaveValue('n f penser au prochain chapitre')
  await page.getByRole('button', { name: /Déposer et revenir/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Capturer une pensée' }).click()
  const thought = page
    .getByRole('dialog')
    .getByRole('listitem')
    .filter({ hasText: 'n f penser au prochain chapitre' })
  await thought.getByRole('button', { name: 'En tâche', exact: true }).click()
  await expect(thought).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'n f penser au prochain chapitre', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'n f penser au prochain chapitre', exact: true }),
  ).toBeVisible()
})

test('audio activation, track toggles, mute and levels persist without autoplay', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir les ambiances' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Écouter', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pause audio', exact: true })).toBeVisible()
  const master = dialog.getByRole('slider', { name: 'Volume maître', exact: true })
  await master.focus()
  await page.keyboard.press('ArrowRight')
  await expect(master).toHaveValue('0.41')
  await dialog.getByRole('button', { name: 'Pluie douce', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Pluie douce', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const rain = dialog.getByRole('slider', { name: 'Volume Pluie douce', exact: true })
  await rain.focus()
  await page.keyboard.press('ArrowRight')
  await expect(rain).toHaveValue('0.36')
  await dialog.getByRole('button', { name: 'Couper le son', exact: true }).click()
  await expect(
    dialog.getByRole('button', { name: 'Rétablir le son', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(master).toHaveValue('0.41')
  await expect(rain).toHaveValue('0.36')
  await page.reload()
  await page.getByRole('button', { name: 'Ouvrir les ambiances' }).click()
  await expect(dialog.getByRole('button', { name: 'Écouter', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Rétablir le son', exact: true })).toBeVisible()
  await expect(master).toHaveValue('0.41')
  await expect(rain).toHaveValue('0.36')
})
