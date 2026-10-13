import { expect, test } from '@playwright/test'

test('custom sequence skips safely and running profile stays unchanged until reset', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Nouvelle tâche' }).fill('Rester maître de ma tâche')
  await page.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
  await page.getByRole('button', { name: 'Régler la minuterie' }).click()
  const settings = page.getByRole('dialog', { name: 'Profil de minuterie', exact: true })
  await settings.getByRole('spinbutton', { name: 'Minutes de la phase 1' }).fill('1')
  await settings.getByRole('spinbutton', { name: 'Minutes de la phase 2' }).fill('1')
  await settings.getByRole('spinbutton', { name: /Répétitions/ }).fill('1')
  await expect(
    settings.getByRole('checkbox', { name: 'Enchaîner les phases automatiquement' }),
  ).not.toBeChecked()
  await settings.getByRole('button', { name: 'Enregistrer le profil' }).click()
  await expect(page.getByRole('timer')).toHaveText('01:00')
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await page.getByRole('button', { name: 'Passer à la phase suivante' }).click()
  await expect(page.getByRole('article', { name: 'Minuterie', exact: true })).toContainText('Pause')
  await page.getByRole('button', { name: 'Passer à la phase suivante' }).click()
  await expect(page.getByRole('article', { name: 'Minuterie', exact: true })).toContainText(
    'Session terminée',
  )
  await expect(
    page.getByRole('button', { name: 'Terminer Rester maître de ma tâche', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await page.getByRole('button', { name: 'Régler la minuterie' }).click()
  await settings.getByRole('button', { name: '50 / 10', exact: true }).click()
  await settings.getByRole('button', { name: 'Enregistrer le profil' }).click()
  await expect(page.getByRole('timer')).toHaveText(/^0[01]:\d{2}$/)
  await page.getByRole('button', { name: 'Réinitialiser la session' }).click()
  await expect(page.getByRole('timer')).toHaveText('50:00')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText('50:00')
})

test('tasks can be renamed reordered and deleted while active', async ({ page }) => {
  await page.goto('/')
  const tasks = page.getByRole('article', { name: 'Tâches', exact: true })
  for (const title of ['Premier petit pas', 'Deuxième petit pas']) {
    await tasks.getByRole('textbox', { name: 'Nouvelle tâche' }).fill(title)
    await tasks.getByRole('button', { name: 'Ajouter la tâche', exact: true }).click()
    await expect(tasks.getByRole('button', { name: title, exact: true })).toBeVisible()
  }
  await tasks.getByRole('button', { name: 'Options de Deuxième petit pas' }).click()
  await tasks.getByRole('button', { name: 'Renommer Deuxième petit pas', exact: true }).click()
  await tasks.getByRole('textbox', { name: 'Renommer la tâche' }).fill('Un pas renommé')
  await tasks.getByRole('button', { name: 'Enregistrer la tâche', exact: true }).click()
  await tasks.getByRole('button', { name: 'Options de Un pas renommé' }).click()
  await tasks.getByRole('button', { name: 'Monter Un pas renommé' }).click()
  await expect(
    tasks
      .getByRole('listitem')
      .first()
      .getByRole('button', { name: 'Un pas renommé', exact: true }),
  ).toBeVisible()
  await tasks.getByRole('button', { name: 'Un pas renommé', exact: true }).click()
  await expect(tasks.getByRole('button', { name: 'Un pas renommé', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Démarrer', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Minuterie', exact: true })).toContainText(
    'Un pas renommé',
  )
  await tasks.getByRole('button', { name: 'Supprimer Un pas renommé', exact: true }).click()
  await expect(tasks.getByRole('button', { name: 'Un pas renommé', exact: true })).toHaveCount(0)
  await expect(page.getByRole('article', { name: 'Minuterie', exact: true })).not.toContainText(
    'Un pas renommé',
  )
  await page.reload()
  await expect(tasks.getByRole('listitem')).toHaveCount(1)
  await expect(tasks.getByRole('button', { name: 'Premier petit pas', exact: true })).toBeVisible()
})
